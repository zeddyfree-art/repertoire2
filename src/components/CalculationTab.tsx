import { Icon } from './Icon';
import type { RunSpec } from './SetRunner';
import { useApp } from '../lib/store';
import { CALC_OFFSET, LADDER_PASS, LADDER_WINDOW, MATE_LADDER, MAX_GHOST_DEPTH } from '../lib/tactics/curriculum';
import { pickPuzzles } from '../lib/tactics/lichess';
import { addMisses, climb, ladderPush, ladderScore, MAX_MATE_RUNG, pickGhostDepth, type TacticsProgress } from '../lib/tactics/progress';

const SESSION = 10;

export function CalculationTab({ progress, onRun }: { progress: TacticsProgress; onRun: (spec: RunSpec) => void }) {
  const update = useApp((s) => s.updateTactics);
  const calc = progress.calc;

  const runMate = (rung: number) => {
    const r = MATE_LADDER[rung];
    onRun({
      title: `${r.title}, board still`,
      subtitle: 'Mate ladder',
      frozen: true,
      build: () => pickPuzzles({ theme: r.theme, rating: progress.rating + CALC_OFFSET, count: SESSION, spread: 250 }),
      onResult: (res) =>
        update((p) => {
          const results = ladderPush(p!.calc.mate[r.theme], res.solved);
          return {
            ...p!,
            reviews: res.solved ? p!.reviews : addMisses(p!.reviews, [res.id]),
            calc: { ...p!.calc, mate: { ...p!.calc.mate, [r.theme]: results }, mateRung: climb(p!.calc.mateRung, rung, results, MAX_MATE_RUNG) },
          };
        }),
      onComplete: () => [`The next rung opens at ${LADDER_PASS} of your last ${LADDER_WINDOW} at the first try.`],
    });
  };

  const runGhost = () => {
    const level = calc.ghostDepth;
    const depths = new Map<string, number>();
    onRun({
      title: `Ghost puzzles · depth ${level}`,
      subtitle: 'Visualisation',
      frozen: true,
      ghostDepth: (p) => {
        if (!depths.has(p.id)) depths.set(p.id, pickGhostDepth(level));
        return depths.get(p.id)!;
      },
      build: () => pickPuzzles({ theme: 'mix', rating: progress.rating + CALC_OFFSET, count: SESSION, spread: 250 }),
      onResult: (res) =>
        update((p) => {
          const d = depths.get(res.id) ?? level;
          const results = ladderPush(p!.calc.ghost[d], res.solved);
          return {
            ...p!,
            calc: { ...p!.calc, ghost: { ...p!.calc.ghost, [d]: results }, ghostDepth: climb(p!.calc.ghostDepth, d, results, MAX_GHOST_DEPTH) },
          };
        }),
      onComplete: () => [`Depth ${Math.min(MAX_GHOST_DEPTH, level + 1)} opens at ${LADDER_PASS} of your last ${LADDER_WINDOW} at depth ${level}. Most puzzles come at your depth, some one easier or harder.`],
    });
  };

  const ghostScore = ladderScore(calc.ghost[calc.ghostDepth]);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="card card-pad stack">
        <div className="studio-overline">WHY</div>
        <div className="small" style={{ lineHeight: 1.55 }}>
          Knowing a pattern is not enough if you cannot see it three moves ahead. Here the board <b>does not move</b>: you hold the position in your
          head. Click a piece and then its square, as on a normal board — but on the board you picture. The mate ladder trains calculating a forcing
          line to the end; ghost puzzles train keeping track of moves you do not see. Puzzles come about {Math.abs(CALC_OFFSET)} below your tactics rating
          ({progress.rating + CALC_OFFSET}); they do not change it.
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="studio-section-heading">
          <div>
            <h2>Mate ladder</h2>
            <span>Find the whole mate with a board that stays still. Every reply shows as an arrow and in the move list.</span>
          </div>
        </div>
        <div className="eg-sections">
          {MATE_LADDER.map((r, i) => {
            const sc = ladderScore(calc.mate[r.theme]);
            const open = i <= calc.mateRung;
            return (
              <div key={r.theme} className={`card card-pad stack eg-section ${sc.passed ? 'done' : ''}`}>
                <div className="row">
                  <h3 style={{ flex: 1 }}>{r.title}</h3>
                  <span className="eg-pct">{sc.passed ? '✓' : open ? `${sc.solved}/${sc.played}` : '🔒'}</span>
                </div>
                <LadderBar results={calc.mate[r.theme]} />
                <div className="row">
                  <span className="small muted">{open ? `${LADDER_PASS} of the last ${LADDER_WINDOW} opens the next` : `Opens after ${MATE_LADDER[i - 1].title}`}</span>
                  <span className="spacer" />
                  <button className={`btn sm ${i === calc.mateRung ? 'primary' : ''}`} disabled={!open} onClick={() => runMate(i)}>
                    <Icon name="play" size={13} /> {SESSION}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="studio-section-heading">
          <div>
            <h2>Ghost puzzles</h2>
            <span>The board stops a few moves before the puzzle. The last moves play as arrows only; then find the best move in the position as it is now.</span>
          </div>
        </div>
        <div className="card card-pad stack">
          <div className="row wrap" style={{ gap: 14 }}>
            <div className="eg-score">
              <b>{calc.ghostDepth}</b>
              <span className="muted">
                ghost {calc.ghostDepth === 1 ? 'move' : 'moves'} · up to {MAX_GHOST_DEPTH}
              </span>
            </div>
            <span className="spacer" />
            <button className="btn primary" onClick={runGhost}>
              <Icon name="play" size={14} /> Train {SESSION}
            </button>
          </div>
          <div className="tc-depths">
            {Array.from({ length: MAX_GHOST_DEPTH }, (_, i) => i + 1).map((d) => {
              const sc = ladderScore(calc.ghost[d]);
              return (
                <span key={d} className={`tc-depth ${d < calc.ghostDepth || sc.passed ? 'passed' : d === calc.ghostDepth ? 'current' : ''}`} title={`Depth ${d}: ${sc.solved}/${sc.played}`}>
                  {d}
                </span>
              );
            })}
          </div>
          <div className="small muted">
            At depth {calc.ghostDepth}: {ghostScore.solved} of the last {ghostScore.played}. {LADDER_PASS} of {LADDER_WINDOW} opens the next depth.
          </div>
        </div>
      </section>
    </div>
  );
}

function LadderBar({ results }: { results?: boolean[] }) {
  const last = (results ?? []).slice(-LADDER_WINDOW);
  return (
    <div className="tc-ladder" aria-hidden>
      {Array.from({ length: LADDER_WINDOW }, (_, i) => {
        const r = last[i];
        return <i key={i} className={r === undefined ? '' : r ? 'ok' : 'miss'} />;
      })}
    </div>
  );
}
