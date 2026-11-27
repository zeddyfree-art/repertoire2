import { useEffect, useState } from 'react';
import { CalculationTab } from './CalculationTab';
import { EndgamesView, useEndgameProgress } from './EndgamesView';
import { Icon } from './Icon';
import { SetRunner, type RunSpec } from './SetRunner';
import { TacticsTab, useTactics } from './TacticsTab';
import { useApp, type SkillsTab } from '../lib/store';
import { summary as endgameSummary } from '../lib/endgames/progress';
import { dueReviews, newProgress } from '../lib/tactics/progress';

const TABS: { id: SkillsTab; label: string; icon: string }[] = [
  { id: 'tactics', label: 'Tactics', icon: 'target' },
  { id: 'calculation', label: 'Calculation', icon: 'eye' },
  { id: 'endgames', label: 'Endgames', icon: 'endgame' },
];

/** Tactics, calculation and endgames: the skills next to the opening repertoire. */
export function SkillsView() {
  const tab = useApp((s) => s.skillsTab);
  const setTab = useApp((s) => s.setSkillsTab);
  const tactics = useTactics();
  const endgames = useEndgameProgress();
  const [run, setRun] = useState<RunSpec | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [run, tab]);

  if (run) return <SetRunner spec={run} onExit={() => setRun(null)} />;

  const badge = (id: SkillsTab) => {
    if (id === 'tactics' && tactics) return dueReviews(tactics).length;
    if (id === 'endgames') return endgameSummary(endgames).due;
    return 0;
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="tc-tabs" role="tablist">
        {TABS.map((t) => {
          const n = badge(t.id);
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tc-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon as never} size={16} /> {t.label}
              {n > 0 && <span className="tc-tab-badge">{n}</span>}
            </button>
          );
        })}
      </div>
      {tab === 'endgames' ? (
        <EndgamesView />
      ) : !tactics ? (
        <StartRating />
      ) : tab === 'tactics' ? (
        <TacticsTab progress={tactics} onRun={setRun} />
      ) : (
        <CalculationTab progress={tactics} onRun={setRun} />
      )}
    </div>
  );
}

function StartRating() {
  const update = useApp((s) => s.updateTactics);
  const [rating, setRating] = useState(1500);
  return (
    <section className="card card-pad stack" style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 20 }}>Where do you start?</h2>
      <div className="small" style={{ lineHeight: 1.55 }}>
        Puzzles are picked around your tactics rating, and it moves with every new puzzle you solve or miss. Start with your <b>Lichess puzzle
        rating</b> if you have one. If you only know your rapid rating, add about 200. Not sure? Take 1500 — it settles within a few dozen
        puzzles.
      </div>
      <div className="row wrap" style={{ gap: 10 }}>
        <input className="input" type="number" min={600} max={2800} step={25} value={rating} onChange={(e) => setRating(Number(e.target.value) || 1500)} style={{ width: 120 }} aria-label="Start rating" />
        <button className="btn primary" onClick={() => update(() => newProgress(Math.min(2800, Math.max(600, rating))))}>
          Start with {rating}
        </button>
      </div>
      <div className="small muted">You can change it later in this tab.</div>
    </section>
  );
}
