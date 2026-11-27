import { useEffect, useRef, useState } from 'react';
import { Board, moveArrow, sideCircle, type Shape } from './Board';
import { Icon } from './Icon';
import { fenKey, moveFromBoard, playUci, posFromFen, uciToArrow, type Side } from '../lib/chess';
import { useKey } from '../lib/hooks';
import { useApp } from '../lib/store';
import { LEVEL_LABEL, type PuzzleTest } from '../lib/endgames/curriculum';
import { recordPuzzle, testScore } from '../lib/endgames/progress';
import { lichessPuzzleUrl, nextPuzzle, type Puzzle, type PuzzleDifficulty } from '../lib/endgames/puzzles';
import { afterFen } from '../lib/endgames/tablebase';
import { playMoveSound, playSound } from '../lib/sound';

type Phase = 'loading' | 'error' | 'play' | 'opponent' | 'solved' | 'failed';

/** A puzzle test: `count` Lichess puzzles of one theme. A puzzle counts as solved only at the first try, without
 *  hint — as on Lichess. */
export function PuzzleSession({ test, count, difficulty, onExit }: { test: PuzzleTest; count: number; difficulty: PuzzleDifficulty; onExit: () => void }) {
  const updateEndgames = useApp((s) => s.updateEndgames);
  const record = useApp((s) => s.data.profiles.find((p) => p.id === s.data.activeProfileId)?.endgames?.puzzles[test.theme]);
  const [n, setN] = useState(0);
  const [score, setScore] = useState({ solved: 0, failed: 0 });
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [fen, setFen] = useState('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const st = useRef({ step: 0, failed: false, recorded: false, alive: true, fen: '' });
  const side: Side = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'white' : 'black') : 'white';

  useEffect(() => {
    st.current.alive = true;
    return () => {
      st.current.alive = false;
    };
  }, []);

  const load = async () => {
    setPhase('loading');
    setError(null);
    setNote(null);
    setShapes([]);
    try {
      const p = await nextPuzzle(test.theme, difficulty, undefined, test.filter);
      if (!st.current.alive) return;
      st.current = { ...st.current, step: 0, failed: false, recorded: false, fen: p.fen };
      setPuzzle(p);
      setFen(p.fen);
      setLastMove(p.lastMove ? uciToArrow(p.lastMove) : null);
      setPhase('play');
    } catch (e) {
      if (!st.current.alive) return;
      setError((e as Error).message);
      setPhase('error');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (uci: string) => {
    const before = st.current.fen;
    const played = playUci(fenKey(before), uci);
    const next = afterFen(before, uci);
    st.current.fen = next;
    setFen(next);
    setLastMove(uciToArrow(uci));
    if (played) playMoveSound(played);
  };

  const conclude = (solved: boolean) => {
    if (st.current.recorded) return;
    st.current.recorded = true;
    updateEndgames((p) => ({ ...p, puzzles: { ...p.puzzles, [test.theme]: recordPuzzle(p.puzzles[test.theme], solved) } }));
    setScore((s) => (solved ? { ...s, solved: s.solved + 1 } : { ...s, failed: s.failed + 1 }));
    setPhase(solved ? 'solved' : 'failed');
    playSound(solved ? 'Victory' : 'Defeat');
  };

  /** The opponent's reply (and the end of the puzzle when the solution runs out). */
  const advance = () => {
    const p = puzzle!;
    const s = st.current;
    if (s.step >= p.solution.length) return conclude(!s.failed);
    setPhase('opponent');
    setTimeout(() => {
      if (!st.current.alive) return;
      apply(p.solution[s.step]);
      s.step++;
      if (s.step >= p.solution.length) conclude(!s.failed);
      else setPhase('play');
    }, 420);
  };

  const onMove = (orig: string, dest: string) => {
    if (phase !== 'play' || !puzzle) return;
    const s = st.current;
    const m = moveFromBoard(fenKey(s.fen), orig, dest);
    if (!m) return;
    const expected = puzzle.solution[s.step];
    const right = playUci(fenKey(s.fen), expected);
    const after = afterFen(s.fen, m.uci);
    // Any mate is right, as on Lichess.
    const mates = posFromFen(after).isCheckmate();
    setShapes([]);
    if ((right && right.uci === m.uci) || mates) {
      apply(m.uci);
      s.step++;
      setNote(null);
      if (mates) return conclude(!s.failed);
      return advance();
    }
    // Wrong: the puzzle is failed; show the move and let the rest play out.
    s.failed = true;
    setNote(`${m.san} is not it. The move was ${right?.san ?? expected}.`);
    playSound('Defeat');
    apply(expected);
    s.step++;
    advance();
  };

  const hint = () => {
    if (phase !== 'play' || !puzzle) return;
    st.current.failed = true;
    const from = puzzle.solution[st.current.step].slice(0, 2);
    setShapes([sideCircle(from, side)]);
    setNote('Hint: this piece moves. (A hint counts as not solved at the first try.)');
  };

  const showSolution = () => {
    if (phase !== 'play' || !puzzle) return;
    st.current.failed = true;
    const uci = puzzle.solution[st.current.step];
    setShapes([moveArrow(uci, side, { onTop: true })]);
    setNote('The arrow shows the move. Play it to go on.');
  };

  const next = () => {
    if (n + 1 >= count) setN(count);
    else {
      setN((x) => x + 1);
      void load();
    }
  };

  useKey(
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === ' ' || e.key === 'Enter') && (phase === 'solved' || phase === 'failed') && (e.target as HTMLElement)?.tagName !== 'BUTTON') next();
      else if ((e.key === 'h' || e.key === 'H') && phase === 'play') hint();
      else return;
      e.preventDefault();
    },
    [phase, n],
  );

  const t = testScore(test, record);

  if (n >= count) {
    return (
      <div style={{ maxWidth: 620, margin: '24px auto' }} className="card card-pad stack">
        <h2>{test.title}: done</h2>
        <div className="stat-row">
          <div className="stat">
            <b style={{ color: 'var(--mine)' }}>{score.solved}</b>
            <span>first try</span>
          </div>
          <div className="stat">
            <b style={{ color: score.failed ? 'var(--gap)' : undefined }}>{score.failed}</b>
            <span>missed</span>
          </div>
        </div>
        <div className={`feedback ${t.passed ? 'good' : 'info'}`}>
          {t.passed
            ? `Test passed: ${t.solved} of your last ${t.size} at the first try (${t.need} needed).`
            : t.played < t.size
              ? `${t.solved} of ${t.played} so far. The test counts your last ${t.size} puzzles; ${t.need} must be right at the first try.`
              : `${t.solved} of your last ${t.size} at the first try — ${t.need} needed. Keep going: only the last ${t.size} count.`}
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
    <div className="train eg-drill">
      <div className="board-area">
        <Board position={fenKey(fen)} orientation={side} movable={phase === 'play' ? side : null} lastMove={lastMove} shapes={shapes} onMove={onMove} />
      </div>
      <div className="stack train-panel">
        <div className="card card-pad stack">
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="big-count">{count - n}</span>
            <span className="muted">to go</span>
            <span className="spacer" />
            <span className="badge mine">{score.solved} solved</span>
            <span className="badge gap">{score.failed} missed</span>
          </div>
          <div className="progress">
            <div style={{ width: `${(n / count) * 100}%` }} />
          </div>
          <div>
            <div className="small muted">
              Puzzle test · {LEVEL_LABEL[test.level]}
              {puzzle ? ` · rated ${puzzle.rating}` : ''}
            </div>
            <h2 style={{ fontSize: 20, margin: '2px 0 0' }}>{test.title}</h2>
          </div>
          <div className="muted">{test.about}</div>
          {phase === 'loading' && <div className="small muted">Fetching a puzzle from Lichess…</div>}
          {phase === 'error' && (
            <div className="feedback bad stack" style={{ gap: 8 }}>
              <span>{error}</span>
              <div>
                <button className="btn sm" onClick={() => void load()}>
                  <Icon name="refresh" size={14} /> Try again
                </button>
              </div>
            </div>
          )}
          {(phase === 'play' || phase === 'opponent') && (
            <div className="feedback info">{sideToMove(side)} to move: find the best move.</div>
          )}
          {note && <div className={`feedback ${st.current.failed ? 'bad' : 'info'}`}>{note}</div>}
          {phase === 'solved' && <div className="feedback good">Solved at the first try.</div>}
          {phase === 'failed' && <div className="feedback bad">Not solved at the first try. It counts as a miss.</div>}
          <div className="row wrap train-choices">
            {phase === 'solved' || phase === 'failed' ? (
              <button className="btn primary" onClick={next} autoFocus>
                {n + 1 >= count ? 'Finish' : 'Next puzzle'} <Icon name="next" size={14} />
              </button>
            ) : (
              <>
                <button className="btn" disabled={phase !== 'play'} onClick={hint} title="Hint (H): the piece to move">
                  <Icon name="hint" size={14} /> Hint
                </button>
                <button className="btn ghost" disabled={phase !== 'play'} onClick={showSolution}>
                  Show the move
                </button>
              </>
            )}
            <span className="spacer" />
            <button className="btn ghost" onClick={onExit}>
              Stop
            </button>
          </div>
          {puzzle && (
            <div className="small">
              <a href={lichessPuzzleUrl(puzzle.id)} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={12} /> This puzzle on Lichess
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const sideToMove = (s: Side) => (s === 'white' ? 'White' : 'Black');
