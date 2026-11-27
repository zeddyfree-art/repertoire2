import { useEffect, useMemo, useRef, useState } from 'react';
import { Board, moveArrow, sideCircle, type Shape } from './Board';
import { Icon } from './Icon';
import { formatLine, playUci, posFromFen, keyToFen, turnOfKey, uciToArrow, type PlayedMove, type Side } from '../lib/chess';
import { useKey } from '../lib/hooks';
import { playMoveSound, playSound } from '../lib/sound';
import { motifByTheme, type Motif } from '../lib/tactics/curriculum';
import { gameLine, lichessPuzzleUrl, type TPuzzle } from '../lib/tactics/lichess';

export interface RunResult {
  id: string;
  rating: number;
  solved: boolean;
  ms: number;
  /** Mix: the motif named correctly. */
  motifOk?: boolean;
}

export interface RunOptions {
  /** Name the puzzle's motif (Learn). */
  showMotif?: Motif;
  /** After each puzzle, ask which of these motifs it was (Mix). */
  askMotif?: Motif[];
  /** The board does not follow the moves: calculate the line (mate ladder, ghost puzzles). */
  frozen?: boolean;
  /** Ghost moves: how many of the game's last moves the board does not show yet. */
  ghostDepth?: (p: TPuzzle) => number;
  /** Go on by itself after a solved puzzle (woodpecker: speed). */
  autoNext?: boolean;
  /** Time target for the whole run (ms). */
  timeTarget?: number | null;
}

interface Props extends RunOptions {
  puzzles: TPuzzle[];
  title: string;
  subtitle?: string;
  onResult: (r: RunResult, p: TPuzzle) => void;
  onDone: (results: RunResult[]) => void;
  onExit: () => void;
}

type Phase = 'ghosts' | 'play' | 'reply' | 'solved' | 'failed' | 'motif';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sideName = (s: Side) => (s === 'white' ? 'White' : 'Black');

export function PuzzleRun(props: Props) {
  const { puzzles, title, subtitle, onResult, onDone, onExit, timeTarget } = props;
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<RunResult[]>([]);
  const totalMs = results.reduce((s, r) => s + r.ms, 0);

  const finishOne = (r: RunResult, p: TPuzzle) => {
    onResult(r, p);
    setResults((x) => [...x, r]);
  };

  const next = () => {
    if (index + 1 >= puzzles.length) onDone(results);
    else setIndex((i) => i + 1);
  };

  const p = puzzles[index];
  if (!p) return null;
  return (
    <OnePuzzle
      key={`${index}-${p.id}`}
      puzzle={p}
      opts={props}
      header={
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="big-count">{puzzles.length - index}</span>
            <span className="muted">to go</span>
            <span className="spacer" />
            <span className="badge mine">{results.filter((r) => r.solved).length} solved</span>
            <span className="badge gap">{results.filter((r) => !r.solved).length} missed</span>
          </div>
          <div className="progress">
            <div style={{ width: `${(index / puzzles.length) * 100}%` }} />
          </div>
          <div>
            {subtitle && <div className="small muted">{subtitle}</div>}
            <h2 style={{ fontSize: 20, margin: '2px 0 0' }}>{title}</h2>
          </div>
        </>
      }
      runMs={totalMs}
      timeTarget={timeTarget ?? null}
      last={index + 1 >= puzzles.length}
      onFinished={finishOne}
      onNext={next}
      onExit={onExit}
    />
  );
}

interface OneProps {
  puzzle: TPuzzle;
  opts: RunOptions;
  header: React.ReactNode;
  runMs: number;
  timeTarget: number | null;
  last: boolean;
  onFinished: (r: RunResult, p: TPuzzle) => void;
  onNext: () => void;
  onExit: () => void;
}

function OnePuzzle({ puzzle, opts, header, runMs, timeTarget, last, onFinished, onNext, onExit }: OneProps) {
  const line = useMemo(() => gameLine(puzzle), [puzzle]);
  const depth = Math.max(0, Math.min(opts.ghostDepth?.(puzzle) ?? 0, (line?.length ?? 1) - 1));
  const frozen = !!opts.frozen || depth > 0;
  const startKey = line?.[line.length - 1]?.to ?? '';
  const ghosts = useMemo(() => (line && depth ? line.slice(line.length - depth) : []), [line, depth]);
  const displayStart = depth && line ? line[line.length - depth].from : startKey;
  const side: Side = startKey ? turnOfKey(startKey) : 'white';

  const [phase, setPhase] = useState<Phase>(ghosts.length ? 'ghosts' : 'play');
  const [display, setDisplay] = useState(displayStart);
  const [lastMove, setLastMove] = useState<[string, string] | null>(
    !depth && line?.length ? uciToArrow(line[line.length - 1].uci) : null,
  );
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [played, setPlayed] = useState<PlayedMove[]>([]);
  const [note, setNote] = useState<{ tone: 'good' | 'bad' | 'info'; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [motifAnswer, setMotifAnswer] = useState<string | null>(null);
  const st = useRef({ real: startKey, step: 0, failed: false, startedAt: 0, alive: true, result: null as RunResult | null, moves: [] as PlayedMove[] });

  useEffect(() => {
    st.current.alive = true;
    return () => {
      st.current.alive = false;
    };
  }, []);

  // Ghost moves: shown one by one as arrows over the frozen board, then you are on.
  const showGhosts = async () => {
    setPhase('ghosts');
    for (const g of ghosts) {
      if (!st.current.alive) return;
      setShapes([ghostArrow(g.uci, turnOfKey(g.from))]);
      await wait(900);
    }
    if (!st.current.alive) return;
    setShapes([]);
    st.current.startedAt = Date.now();
    setPhase('play');
  };

  useEffect(() => {
    if (ghosts.length) void showGhosts();
    else st.current.startedAt = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'play' && phase !== 'reply') return;
    const t = setInterval(() => setElapsed(Date.now() - st.current.startedAt), 250);
    return () => clearInterval(t);
  }, [phase]);

  const conclude = (solved: boolean) => {
    const s = st.current;
    if (s.result) return;
    const r: RunResult = { id: puzzle.id, rating: puzzle.rating, solved: solved && !s.failed, ms: Date.now() - s.startedAt };
    s.result = r;
    setElapsed(r.ms);
    playSound(r.solved ? 'Victory' : 'Defeat');
    if (opts.askMotif?.length) {
      setPhase('motif');
      return;
    }
    onFinished(r, puzzle);
    setPhase(r.solved ? 'solved' : 'failed');
    if (r.solved && opts.autoNext) setTimeout(() => st.current.alive && onNext(), 700);
  };

  /** The frozen board catches up: the whole line with real pieces. */
  const catchUp = async (moves: PlayedMove[]) => {
    const all = [...ghosts, ...moves];
    for (const m of all) {
      if (!st.current.alive) return;
      setDisplay(m.to);
      setLastMove(uciToArrow(m.uci));
      await wait(380);
    }
  };

  const applyReal = (m: PlayedMove, sound = true) => {
    st.current.real = m.to;
    st.current.moves = [...st.current.moves, m];
    setPlayed(st.current.moves);
    if (!frozen) {
      setDisplay(m.to);
      setLastMove(uciToArrow(m.uci));
    } else {
      setShapes([ghostArrow(m.uci, turnOfKey(m.from))]);
    }
    if (sound) playMoveSound(m);
  };

  const finishLine = async (solved: boolean) => {
    const s = st.current;
    // Play out the rest of the solution so the idea is visible.
    const rest: PlayedMove[] = [];
    let key = s.real;
    for (let i = s.step; i < puzzle.solution.length; i++) {
      const m = playUci(key, puzzle.solution[i]);
      if (!m) break;
      rest.push(m);
      key = m.to;
    }
    conclude(solved);
    if (frozen) {
      setShapes([]);
      await catchUp([...s.moves, ...rest]);
    } else {
      for (const m of rest) {
        if (!st.current.alive) return;
        await wait(450);
        applyReal(m);
      }
    }
  };

  const tryMove = (m: PlayedMove) => {
    const s = st.current;
    const expected = playUci(s.real, puzzle.solution[s.step]);
    const mates = posFromFen(keyToFen(m.to)).isCheckmate();
    setSelected(null);
    if ((expected && expected.uci === m.uci) || mates) {
      applyReal(m);
      s.step++;
      setNote(null);
      if (mates || s.step >= puzzle.solution.length) return void finishLine(true);
      // The reply.
      setPhase('reply');
      void (async () => {
        await wait(frozen ? 650 : 420);
        if (!st.current.alive) return;
        const reply = playUci(s.real, puzzle.solution[s.step]);
        if (reply) applyReal(reply);
        s.step++;
        if (s.step >= puzzle.solution.length) return void finishLine(true);
        setPhase('play');
      })();
      return;
    }
    s.failed = true;
    setNote({ tone: 'bad', text: `${m.san} is not it.${expected ? ` The move was ${expected.san}.` : ''}` });
    playSound('Defeat');
    // The rest of the solution plays out (on a moving board it also puts the wrong move back).
    void finishLine(false);
  };

  const onMove = (orig: string, dest: string) => {
    if (phase !== 'play' || frozen) return;
    const m = playUci(st.current.real, orig + dest + promoFor(st.current.real, orig, dest, puzzle.solution[st.current.step]));
    if (m) tryMove(m);
  };

  // Frozen board: click the piece, then where it goes — on the board in your head.
  const onSelect = (sq: string) => {
    if (phase !== 'play' || !frozen) return;
    const real = st.current.real;
    const pos = posFromFen(keyToFen(real));
    if (selected && selected !== sq) {
      const m = playUci(real, selected + sq + promoFor(real, selected, sq, puzzle.solution[st.current.step]));
      if (m) return tryMove(m);
    }
    const piece = pos.board.get(squareIndex(sq));
    if (piece && piece.color === side) {
      setSelected(sq);
      setShapes([sideCircle(sq, side)]);
    } else {
      setSelected(null);
      setShapes([]);
      if (selected) setNote({ tone: 'info', text: 'That move is not possible in the position as it is now. Picture it again.' });
    }
  };

  const hint = () => {
    if (phase !== 'play') return;
    st.current.failed = true;
    setShapes([sideCircle(puzzle.solution[st.current.step].slice(0, 2), side)]);
    setNote({ tone: 'info', text: 'This piece moves. (A hint counts as a miss.)' });
  };

  const showMove = () => {
    if (phase !== 'play') return;
    st.current.failed = true;
    setShapes([moveArrow(puzzle.solution[st.current.step], side, { onTop: true })]);
    setNote({ tone: 'info', text: 'The arrow shows the move. Play it to go on (it counts as a miss).' });
  };

  const answerMotif = (theme: string) => {
    const r = st.current.result!;
    const ok = puzzle.themes.includes(theme);
    setMotifAnswer(theme);
    const full = { ...r, motifOk: ok };
    st.current.result = full;
    onFinished(full, puzzle);
    setPhase(r.solved ? 'solved' : 'failed');
  };

  useKey(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === ' ' || e.key === 'Enter') && (phase === 'solved' || phase === 'failed') && (e.target as HTMLElement)?.tagName !== 'BUTTON') onNext();
      else if ((e.key === 'h' || e.key === 'H') && phase === 'play') hint();
      else return;
      e.preventDefault();
    },
    [phase],
  );

  if (!line || !startKey) {
    return (
      <div className="card card-pad stack" style={{ maxWidth: 560, margin: '24px auto' }}>
        <div className="feedback bad">This puzzle could not be read.</div>
        <div className="row">
          <button className="btn primary" onClick={onNext}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  const boardKey = peek ? st.current.real : display;
  const done = phase === 'solved' || phase === 'failed';
  const ghostText = ghosts.length ? formatLine(ghosts.map((g) => g.san), line.length - ghosts.length) : '';
  const yourText = played.length ? formatLine(played.map((g) => g.san), line.length) : '';
  const motifName = puzzle.themes.map((t) => motifByTheme(t)?.name).filter(Boolean);
  const clock = runMs + (done || phase === 'motif' ? 0 : elapsed);

  return (
    <div className="train eg-drill">
      <div className="board-area">
        <Board
          position={boardKey}
          orientation={side}
          movable={!frozen && phase === 'play' ? side : null}
          lastMove={lastMove}
          shapes={shapes}
          onMove={onMove}
          onSelect={onSelect}
          className={frozen && !done ? 'board-frozen' : undefined}
        />
      </div>
      <div className="stack train-panel">
        <div className="card card-pad stack">
          {header}
          <div className="eg-meters">
            <span title="Time for this run">
              ⏱ {fmt(clock)}
              {timeTarget ? ` / target ${fmt(timeTarget)}` : ''}
            </span>
            <span className="muted">rated {puzzle.rating}</span>
          </div>

          {opts.showMotif && (
            <div className="feedback info">
              <b>{opts.showMotif.name}.</b> {opts.showMotif.lookFor}
            </div>
          )}

          {phase === 'ghosts' && <div className="feedback info">Watch the last {ghosts.length === 1 ? 'move' : `${ghosts.length} moves`}: the board will not show {ghosts.length === 1 ? 'it' : 'them'}.</div>}
          {(phase === 'play' || phase === 'reply') && (
            <div className="feedback info">
              {sideName(side)} to move: find the best move.
              {frozen && ' The board stays as it is: click a piece, then its square.'}
            </div>
          )}

          {frozen && (ghostText || yourText) && (
            <div className="tc-moves small">
              {ghostText && (
                <div>
                  <span className="muted">Not on the board: </span>
                  <b>{ghostText}</b>
                </div>
              )}
              {yourText && (
                <div>
                  <span className="muted">{ghostText ? 'Since then: ' : 'Your line: '}</span>
                  <b>{yourText}</b>
                </div>
              )}
            </div>
          )}

          {note && <div className={`feedback ${note.tone}`}>{note.text}</div>}

          {phase === 'motif' && opts.askMotif && (
            <div className="stack" style={{ gap: 8 }}>
              <b>Which motif was it?</b>
              <div className="row wrap" style={{ gap: 6 }}>
                {opts.askMotif.map((m) => (
                  <button key={m.theme} className="btn sm" onClick={() => answerMotif(m.theme)}>
                    {m.name}
                  </button>
                ))}
                <button className="btn sm ghost" onClick={() => answerMotif('')}>
                  Something else
                </button>
              </div>
            </div>
          )}

          {done && (
            <div className={`feedback ${phase === 'solved' ? 'good' : 'bad'}`}>
              {phase === 'solved' ? 'Solved at the first try.' : 'Not at the first try: it comes back for review.'}
              {motifAnswer !== null && (
                <div className="small" style={{ marginTop: 4 }}>
                  {st.current.result?.motifOk ? 'Motif named right' : 'Motif'}: {motifName.join(', ') || 'none of these'}.
                </div>
              )}
            </div>
          )}

          <div className="row wrap train-choices">
            {done ? (
              <button className="btn primary" onClick={onNext} autoFocus>
                {last ? 'Finish' : 'Next'} <Icon name="next" size={14} />
              </button>
            ) : (
              <>
                <button className="btn" disabled={phase !== 'play'} onClick={hint} title="Hint (H): the piece to move">
                  <Icon name="hint" size={14} /> Hint
                </button>
                <button className="btn ghost" disabled={phase !== 'play'} onClick={showMove}>
                  Show the move
                </button>
                {frozen && (
                  <button
                    className="btn ghost"
                    disabled={phase !== 'play'}
                    onPointerDown={() => {
                      st.current.failed = true;
                      setPeek(true);
                    }}
                    onPointerUp={() => setPeek(false)}
                    onPointerLeave={() => setPeek(false)}
                    title="Hold to see the real position (counts as a miss)"
                  >
                    Peek
                  </button>
                )}
              </>
            )}
            <span className="spacer" />
            <button className="btn ghost" onClick={onExit}>
              Stop
            </button>
          </div>
          <div className="small">
            <a href={lichessPuzzleUrl(puzzle.id)} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={12} /> This puzzle on Lichess
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ghostArrow(uci: string, side: Side): Shape {
  return moveArrow(uci, side, { onTop: true });
}

function squareIndex(sq: string): number {
  return (Number(sq[1]) - 1) * 8 + (sq.charCodeAt(0) - 97);
}

/** The promotion piece: the one in the solution when the squares match, else a queen. */
function promoFor(key: string, orig: string, dest: string, expected: string | undefined): string {
  const pos = posFromFen(keyToFen(key));
  const piece = pos.board.get(squareIndex(orig));
  if (piece?.role !== 'pawn' || !(dest[1] === '8' || dest[1] === '1')) return '';
  if (expected && expected.slice(0, 4) === orig + dest && expected.length === 5) return expected[4];
  return 'q';
}

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
