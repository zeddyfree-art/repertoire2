import { useCallback, useEffect, useRef, useState } from 'react';
import { Board, moveArrow, type Shape } from './Board';
import { Icon } from './Icon';
import { fenKey, moveFromBoard, playUci, posFromFen, uciToArrow, type Side } from '../lib/chess';
import { useKey } from '../lib/hooks';
import { useApp } from '../lib/store';
import { goalText, LEVEL_LABEL, sectionOf, type Drill } from '../lib/endgames/curriculum';
import { formatMs, PASS_STARS, recordAttempt, starsFor, type Attempt } from '../lib/endgames/progress';
import { randomMatePosition } from '../lib/endgames/random';
import { afterFen, assess, computerMove, flip, toOutcome, type Assessment, type Outcome } from '../lib/endgames/tablebase';
import { playMoveSound, playSound } from '../lib/sound';

type Phase = 'loading' | 'verdict' | 'play' | 'checking' | 'thinking' | 'mistake' | 'done';

interface Result {
  stars: number;
  attempt: Attempt;
  reason: string;
}

const RANK: Record<Outcome, number> = { loss: 0, draw: 1, win: 2 };
const sideName = (s: Side) => (s === 'white' ? 'White' : 'Black');
const turnOf = (fen: string): Side => (fen.split(' ')[1] === 'w' ? 'white' : 'black');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One drill after the other; a drill that was not passed comes back once at the end. */
export function DrillSession({ drills, title, onExit }: { drills: Drill[]; title: string; onExit: () => void }) {
  const [queue, setQueue] = useState<{ drill: Drill; retry: boolean }[]>(() => drills.map((drill) => ({ drill, retry: false })));
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ index: number; drill: Drill; stars: number }[]>([]);
  const requeued = useRef(new Set<number>());
  const item = queue[index];

  // "Try again" finishes the same drill once more: the last result counts.
  const finish = (stars: number) => {
    setResults((r) => [...r.filter((x) => x.index !== index), { index, drill: item.drill, stars }]);
    if (stars < PASS_STARS && !item.retry && !requeued.current.has(index)) {
      requeued.current.add(index);
      setQueue((q) => [...q, { drill: item.drill, retry: true }]);
    }
  };

  if (!item) {
    const clean = results.filter((r) => r.stars >= PASS_STARS).length;
    return (
      <div style={{ maxWidth: 620, margin: '24px auto' }} className="card card-pad stack">
        <h2>{title}: done</h2>
        <div className="stat-row">
          <div className="stat">
            <b style={{ color: 'var(--mine)' }}>{clean}</b>
            <span>passed</span>
          </div>
          <div className="stat">
            <b style={{ color: results.length - clean ? 'var(--gap)' : undefined }}>{results.length - clean}</b>
            <span>missed</span>
          </div>
        </div>
        <div className="eg-result-list">
          {results.map((r, i) => (
            <div key={i} className="row">
              <Stars n={r.stars} />
              <span>{r.drill.title}</span>
              <span className="spacer" />
              <span className="small muted">{sectionOf(r.drill.id)?.title}</span>
            </div>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" onClick={onExit}>
            Back to endgames
          </button>
        </div>
      </div>
    );
  }

  return (
    <DrillPlayer
      key={`${index}-${item.drill.id}`}
      drill={item.drill}
      position={`${index + 1} / ${queue.length}`}
      retry={item.retry}
      onFinished={finish}
      onNext={() => setIndex((i) => i + 1)}
      onExit={onExit}
    />
  );
}

export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="eg-stars" aria-label={`${n} of ${of} stars`} title={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

interface PlayerProps {
  drill: Drill;
  position: string;
  retry: boolean;
  onFinished: (stars: number) => void;
  onNext: () => void;
  onExit: () => void;
}

function DrillPlayer({ drill, position, retry, onFinished, onNext, onExit }: PlayerProps) {
  const updateEndgames = useApp((s) => s.updateEndgames);
  const section = sectionOf(drill.id);
  const target: Outcome = drill.goal === 'draw' ? 'draw' : 'win';

  const [phase, setPhase] = useState<Phase>('loading');
  const [fen, setFen] = useState(drill.fen ?? '4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  const [startFen, setStartFen] = useState<string | null>(drill.fen ?? null);
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad' | 'info'; text: string } | null>(null);
  const [verdictAnswer, setVerdictAnswer] = useState<'win' | 'draw' | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [source, setSource] = useState<'tablebase' | 'engine' | null>(null);

  // Everything the asynchronous steps need, without stale closures.
  const st = useRef({
    fen: drill.fen ?? '',
    here: null as Assessment | null,
    seen: new Map<string, number>(),
    userMoves: 0,
    mistakes: 0,
    hints: 0,
    optimal: undefined as number | undefined,
    startedAt: 0,
    wrongVerdict: false,
    alive: true,
    run: 0,
  });

  useEffect(() => {
    st.current.alive = true;
    return () => {
      st.current.alive = false;
    };
  }, []);

  // The clock.
  useEffect(() => {
    if (phase === 'loading' || phase === 'verdict' || phase === 'done') return;
    const t = setInterval(() => setElapsed(Date.now() - st.current.startedAt), 250);
    return () => clearInterval(t);
  }, [phase]);

  const show = (f: string, uci?: string) => {
    st.current.fen = f;
    setFen(f);
    setLastMove(uci ? uciToArrow(uci) : null);
  };

  const end = useCallback(
    (solved: boolean, reason: string, gaveUp = false) => {
      const s = st.current;
      const attempt: Attempt = {
        mistakes: s.mistakes,
        hints: s.hints,
        wrongVerdict: s.wrongVerdict,
        gaveUp,
        solved,
        ms: Date.now() - s.startedAt,
        moves: s.userMoves,
        optimal: drill.goal === 'mate' ? s.optimal : undefined,
      };
      const stars = starsFor(attempt, drill);
      updateEndgames((p) => ({ ...p, drills: { ...p.drills, [drill.id]: recordAttempt(p.drills[drill.id], stars, attempt.ms) } }));
      setResult({ stars, attempt, reason });
      setPhase('done');
      onFinished(stars);
      playSound(solved && stars >= PASS_STARS ? 'Victory' : 'Defeat');
    },
    [drill, onFinished, updateEndgames],
  );

  /** After any move: is the drill over? */
  const checkEnd = (f: string, byUser: boolean, san?: string): boolean => {
    const s = st.current;
    const pos = posFromFen(f);
    const key = fenKey(f);
    s.seen.set(key, (s.seen.get(key) ?? 0) + 1);
    if (pos.isCheckmate()) {
      if (byUser) end(true, 'Checkmate!');
      else end(false, 'You were mated.');
      return true;
    }
    const repeated = (s.seen.get(key) ?? 0) >= 3;
    if (pos.isStalemate() || pos.isInsufficientMaterial() || repeated || pos.halfmoves >= 100) {
      const why = pos.isStalemate() ? 'Stalemate' : pos.isInsufficientMaterial() ? 'Not enough material to mate' : repeated ? 'Threefold repetition' : 'Fifty-move rule';
      if (drill.goal === 'draw') end(true, `${why}: draw held.`);
      else end(false, `${why}: the win is gone.`);
      return true;
    }
    if (!byUser) return false;
    if ((drill.goal === 'promote' || drill.goal === 'win') && san?.includes('=')) {
      end(true, 'Promoted, and the position is still won.');
      return true;
    }
    if (drill.goal === 'win') {
      const their = drill.side === 'white' ? pos.board.black : pos.board.white;
      const mine = drill.side === 'white' ? pos.board.white : pos.board.black;
      const mating = mine.intersect(pos.board.queen.union(pos.board.rook)).nonEmpty();
      if (their.size() === 1 && mating) {
        end(true, 'Only their king is left: the rest is a basic mate.');
        return true;
      }
    }
    if (drill.goal === 'draw' && s.userMoves >= (drill.hold ?? 12)) {
      end(true, `Held for ${s.userMoves} moves: draw.`);
      return true;
    }
    if (drill.goal === 'mate') {
      const limit = s.optimal ? s.optimal * 2 + 10 : 70;
      if (s.userMoves >= limit) {
        end(false, `No mate after ${s.userMoves} moves — the shortest was ${s.optimal ?? '?'}.`);
        return true;
      }
    }
    return false;
  };

  const userTurn = async (f: string, run: number) => {
    setPhase('checking');
    const a = await assess(f);
    if (!st.current.alive || run !== st.current.run) return;
    st.current.here = a;
    setSource(a.source);
    if (st.current.optimal === undefined && a.dtm) st.current.optimal = Math.ceil(a.dtm / 2);
    setPhase('play');
  };

  const computerTurn = async (f: string, run: number) => {
    setPhase('thinking');
    const started = Date.now();
    const a = await assess(f);
    const uci = await computerMove(f, a);
    if (!st.current.alive || run !== st.current.run) return;
    if (!uci) {
      setMessage({ tone: 'bad', text: 'Neither the tablebase nor the engine answered. Check the connection and restart.' });
      setPhase('play');
      return;
    }
    await wait(Math.max(0, 450 - (Date.now() - started)));
    if (!st.current.alive || run !== st.current.run) return;
    const next = afterFen(f, uci);
    show(next, uci);
    const played = playUci(fenKey(f), uci);
    if (played) playMoveSound(played);
    if (checkEnd(next, false)) return;
    void userTurn(next, run);
  };

  const begin = (f: string) => {
    const s = st.current;
    s.startedAt = Date.now();
    setElapsed(0);
    const run = s.run;
    if (turnOf(f) === drill.side) void userTurn(f, run);
    else void computerTurn(f, run);
  };

  /** Sets the drill up (a fresh random position if it has one), then asks the verdict or starts. */
  const setup = async () => {
    const s = st.current;
    s.run++;
    const run = s.run;
    s.seen = new Map();
    s.userMoves = 0;
    s.mistakes = 0;
    s.hints = 0;
    s.optimal = undefined;
    s.wrongVerdict = false;
    s.here = null;
    setResult(null);
    setMessage(null);
    setShapes([]);
    setVerdictAnswer(null);
    setPhase('loading');
    let f = drill.fen ?? '';
    if (drill.random) {
      // A position worth practising: a real mate in more than a few moves.
      for (let i = 0; i < 6; i++) {
        f = randomMatePosition(drill.random);
        const a = await assess(f, { engineMs: 200 });
        if (a.source === 'engine' || (a.outcome === 'win' && (a.dtm ?? 0) >= 14)) break;
      }
      if (!s.alive || run !== s.run) return;
    }
    setStartFen(f);
    show(f);
    s.seen.set(fenKey(f), 1);
    if (drill.verdict) setPhase('verdict');
    else begin(f);
  };

  useEffect(() => {
    void setup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answerVerdict = (v: 'win' | 'draw') => {
    setVerdictAnswer(v);
    st.current.wrongVerdict = v !== drill.verdict;
  };

  const onMove = async (orig: string, dest: string) => {
    if (phase !== 'play') return;
    const s = st.current;
    const before = s.fen;
    const m = moveFromBoard(fenKey(before), orig, dest);
    if (!m) return;
    const next = afterFen(before, m.uci);
    const run = s.run;
    show(next, m.uci);
    setShapes([]);
    setMessage(null);
    playMoveSound(m);

    // Does the move keep the result? The tablebase already knows; otherwise ask the engine about the new position.
    let mine: Outcome | null = null;
    const tbMove = s.here?.moves?.find((x) => x.uci === m.uci || afterFen(before, x.uci) === next);
    if (tbMove) {
      const o = toOutcome(tbMove.category);
      mine = o ? flip(o) : null;
    }
    if (!mine) {
      setPhase('checking');
      const a = await assess(next);
      if (!s.alive || run !== s.run) return;
      mine = flip(a.outcome);
    }

    if (RANK[mine] < RANK[target]) {
      s.mistakes++;
      const best = s.here?.best;
      const bestSan = best ? s.here?.moves?.find((x) => x.uci === best)?.san : undefined;
      const lost = target === 'win' ? (mine === 'draw' ? 'throws away the win: it is a draw now' : 'loses') : 'loses';
      setMessage({
        tone: 'bad',
        text: `${m.san}? ${lost}.${bestSan ? ` ${bestSan} was the move.` : ''} Try again.`,
      });
      setPhase('mistake');
      playSound('Defeat');
      await wait(1700);
      if (!s.alive || run !== s.run) return;
      show(before);
      setPhase('play');
      return;
    }

    s.userMoves++;
    if (checkEnd(next, true, m.san)) return;
    void computerTurn(next, run);
  };

  const hint = () => {
    if (phase !== 'play') return;
    const s = st.current;
    s.hints++;
    const best = s.here?.best;
    setMessage({ tone: 'info', text: drill.hint });
    if (best) setShapes([moveArrow(best, drill.side, { onTop: true })]);
  };

  const giveUp = () => {
    const best = st.current.here?.best;
    if (best) setShapes([moveArrow(best, drill.side, { onTop: true })]);
    end(false, best ? 'The arrow shows the best move from here.' : 'Given up.', true);
  };

  /** Starting over or stopping after a mistake or a hint is a missed attempt: that keeps "three in a row" honest. */
  const abandon = () => {
    const s = st.current;
    if (phase !== 'done' && (s.mistakes > 0 || s.hints > 0)) {
      updateEndgames((p) => ({ ...p, drills: { ...p.drills, [drill.id]: recordAttempt(p.drills[drill.id], 0, 0) } }));
    }
  };
  const restart = () => {
    abandon();
    void setup();
  };
  const stop = () => {
    abandon();
    onExit();
  };

  useKey(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'h' || e.key === 'H') && phase === 'play') hint();
      else if ((e.key === ' ' || e.key === 'Enter') && phase === 'done' && (e.target as HTMLElement)?.tagName !== 'BUTTON') onNext();
      else return;
      e.preventDefault();
    },
    [phase],
  );

  const movable = phase === 'play' ? drill.side : null;
  const status =
    phase === 'loading'
      ? 'Setting up…'
      : phase === 'thinking'
        ? `${sideName(drill.side === 'white' ? 'black' : 'white')} is thinking…`
        : phase === 'checking'
          ? 'Checking…'
          : phase === 'play'
            ? `Your move (${sideName(drill.side)})`
            : null;

  return (
    <div className="train eg-drill">
      <div className="board-area">
        <div className="eg-strip">
          <div className="eg-strip-row">
            <b>{drill.title}</b>
            <span className="spacer" />
            {phase !== 'verdict' && phase !== 'done' && <span>⏱ {formatMs(elapsed)}{drill.targetSec ? ` / ${formatMs(drill.targetSec * 1000)}` : ''}</span>}
          </div>
          <div className="small">{phase === 'verdict' ? drill.task : `${goalText(drill.goal, drill.side, drill.hold)}. ${drill.task}`}</div>
          {message && phase !== 'done' && <div className={`eg-strip-prompt ${message.tone === 'bad' ? 'bad' : ''}`}>{message.text}</div>}
          <div className="eg-strip-prompt">
            {phase === 'verdict'
              ? 'Win or draw? Answer below the board.'
              : phase === 'done'
                ? result && result.stars >= PASS_STARS
                  ? 'Solved ✓'
                  : 'Not solved'
                : (status ?? '') + (drill.goal === 'draw' ? ` · ${st.current.userMoves} of ${drill.hold ?? 12} moves` : '')}
          </div>
        </div>
        <Board position={fenKey(fen)} orientation={phase === 'verdict' ? stronger(fen) : drill.side} movable={movable} lastMove={lastMove} shapes={shapes} onMove={onMove} />
      </div>
      <div className="stack train-panel">
        <div className="card card-pad stack">
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="small muted">{position}</span>
            {retry && <span className="badge due">again</span>}
            <span className="spacer" />
            {section && <span className={`badge eg-level-${section.level}`}>{LEVEL_LABEL[section.level]}</span>}
          </div>
          <div className="eg-wide-only">
            <div className="small muted">{section?.title}</div>
            <h2 style={{ fontSize: 20, margin: '2px 0 0' }}>{drill.title}</h2>
          </div>
          {phase !== 'verdict' && (
            <div className="eg-goal eg-wide-only">
              <Icon name="target" size={16} /> {goalText(drill.goal, drill.side, drill.hold)}
            </div>
          )}
          <div className="muted eg-wide-only">{drill.task}</div>

          {phase === 'verdict' && (
            <div className="stack eg-verdict" style={{ gap: 10 }}>
              <b>With best play from both sides: win or draw?</b>
              {!verdictAnswer ? (
                <div className="row">
                  <button className="btn" onClick={() => answerVerdict('win')}>
                    {sideName(stronger(fen))} wins
                  </button>
                  <button className="btn" onClick={() => answerVerdict('draw')}>
                    Draw
                  </button>
                </div>
              ) : (
                <>
                  <div className={`feedback ${verdictAnswer === drill.verdict ? 'good' : 'bad'}`}>
                    {verdictAnswer === drill.verdict ? 'Right. ' : 'Not quite. '}
                    {drill.verdict === 'win' ? 'It is a win.' : 'It is a draw.'} {section?.rule.split('. ')[0]}.
                  </div>
                  <div>
                    <button className="btn primary" onClick={() => begin(st.current.fen)}>
                      Now play it <Icon name="next" size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {phase !== 'verdict' && phase !== 'done' && (
            <div className="eg-meters eg-wide-only">
              <span title="Time">⏱ {formatMs(elapsed)}{drill.targetSec ? ` / ${formatMs(drill.targetSec * 1000)}` : ''}</span>
              <span title="Your moves">
                {st.current.userMoves} {st.current.userMoves === 1 ? 'move' : 'moves'}
                {drill.goal === 'mate' && st.current.optimal ? ` · mate in ${st.current.optimal} possible` : ''}
                {drill.goal === 'draw' ? ` of ${drill.hold ?? 12}` : ''}
              </span>
              {st.current.mistakes > 0 && <span className="badge gap">{st.current.mistakes} mistake{st.current.mistakes > 1 ? 's' : ''}</span>}
            </div>
          )}

          {status && phase !== 'done' && <div className="small muted eg-wide-only">{status}</div>}
          {message && <div className={`feedback ${message.tone}`}>{message.text}</div>}

          {phase === 'done' && result && (
            <div className="stack" style={{ gap: 8 }}>
              <div className={`feedback ${result.stars >= PASS_STARS ? 'good' : 'bad'}`}>
                <div className="row">
                  <Stars n={result.stars} />
                  <span>{result.reason}</span>
                </div>
              </div>
              <div className="small muted">
                {formatMs(result.attempt.ms)}
                {drill.targetSec ? ` (target ${formatMs(drill.targetSec * 1000)})` : ''} · {result.attempt.moves} moves
                {result.attempt.optimal && drill.goal === 'mate' ? ` (shortest ${result.attempt.optimal})` : ''}
                {result.attempt.mistakes ? ` · ${result.attempt.mistakes} taken back` : ''}
                {result.attempt.hints ? ` · ${result.attempt.hints} hint${result.attempt.hints > 1 ? 's' : ''}` : ''}
                {result.attempt.wrongVerdict ? ' · wrong call' : ''}
              </div>
              <div className="small">{starExplanation(result.stars)}</div>
            </div>
          )}

          <div className="row wrap train-choices">
            {phase === 'done' ? (
              <>
                <button className="btn primary" onClick={onNext} autoFocus>
                  Next <Icon name="next" size={14} />
                </button>
                <button className="btn" onClick={restart}>
                  <Icon name="refresh" size={14} /> Try again
                </button>
              </>
            ) : (
              <>
                <button className="btn" disabled={phase !== 'play'} onClick={hint} title="Hint (H): the idea and an arrow — at most two stars">
                  <Icon name="hint" size={14} /> Hint
                </button>
                <button className="btn" disabled={phase === 'loading'} onClick={restart} title="Start this drill again">
                  <Icon name="refresh" size={14} /> Restart
                </button>
                <button className="btn ghost" disabled={phase === 'loading' || phase === 'verdict'} onClick={giveUp}>
                  Give up
                </button>
              </>
            )}
            <span className="spacer" />
            <button className="btn ghost" onClick={stop}>
              Stop
            </button>
          </div>

          <div className="row wrap small" style={{ gap: 12 }}>
            {startFen && (
              <a href={`https://lichess.org/analysis/standard/${startFen.replace(/ /g, '_')}?color=${drill.side}`} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={12} /> Analyse on Lichess
              </a>
            )}
            {startFen && (
              <a href={`https://lichess.org/editor/${startFen.replace(/ /g, '_')}?color=${drill.side}`} target="_blank" rel="noopener noreferrer" title="Lichess board editor: Continue from here → Play with the machine">
                <Icon name="external" size={12} /> Play it on Lichess
              </a>
            )}
            {source && (
              <span className="faint" title={source === 'tablebase' ? 'Perfect play from the Lichess tablebase (up to 7 pieces)' : 'Stockfish in your browser: more than 7 pieces, or the tablebase could not be reached'}>
                {source === 'tablebase' ? 'Judged by the tablebase' : 'Judged by Stockfish'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The side with more material (White when equal): the one that could win. */
function stronger(fen: string): Side {
  const value: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let white = 0;
  let black = 0;
  for (const ch of fen.split(' ')[0]) {
    const v = value[ch.toLowerCase()];
    if (!v) continue;
    if (ch === ch.toUpperCase()) white += v;
    else black += v;
  }
  return black > white ? 'black' : 'white';
}

function starExplanation(stars: number): string {
  switch (stars) {
    case 3:
      return 'Clean: no mistake, no hint, quick enough. It moves up a box.';
    case 2:
      return 'Solved without a mistake (a hint, or slower than the target). It moves up a box.';
    case 1:
      return 'Solved, but after a mistake or a wrong call. It goes back to the start and comes again.';
    default:
      return 'Not solved. It goes back to the start and comes again.';
  }
}
