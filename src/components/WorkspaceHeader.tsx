import { useMemo } from 'react';
import { Icon, type IconName } from './Icon';
import { stats, type Repertoire } from '../lib/repertoire';
import { counts } from '../lib/srs';
import { orderedReps, useApp } from '../lib/store';
import { useTodayPlan } from '../lib/today';

export type StudioView = 'build' | 'train' | 'tree' | 'play' | 'endgames' | 'games' | 'audit' | 'settings';

const DESCRIPTIONS: Record<StudioView, { eyebrow: string; title: string; lead: string; icon: IconName }> = {
  build: {
    eyebrow: 'OPENING WORKSHOP',
    title: 'Build your repertoire',
    lead: 'Prepare your moves, explore alternatives and refine every line.',
    icon: 'board',
  },
  train: {
    eyebrow: 'PRACTICE STUDIO',
    title: 'Train with purpose',
    lead: 'Turn prepared moves into confident decisions at the board.',
    icon: 'train',
  },
  tree: {
    eyebrow: 'OPENING ATLAS',
    title: 'Explore your repertoire',
    lead: 'See the structure of every variation and find your next idea.',
    icon: 'tree',
  },
  play: {
    eyebrow: 'THE PLAYING ROOM',
    title: 'Play against Maia',
    lead: 'Put your preparation to work against a human-like opponent.',
    icon: 'play',
  },
  endgames: {
    eyebrow: 'ENDGAME STUDIO',
    title: 'Know your endgames cold',
    lead: 'Mates, pawn and rook endings: learn each one, then keep it automatic.',
    icon: 'endgame',
  },
  games: {
    eyebrow: 'GAME JOURNAL',
    title: 'Your games & insights',
    lead: 'Learn from real games and turn missed chances into lasting knowledge.',
    icon: 'games',
  },
  audit: {
    eyebrow: 'REPERTOIRE REVIEW',
    title: 'Check your preparation',
    lead: 'Find gaps, examine critical moves and strengthen your opening lines.',
    icon: 'audit',
  },
  settings: {
    eyebrow: 'YOUR STUDIO',
    title: 'Settings & preferences',
    lead: 'Personalize the workspace, manage your players and protect your studies.',
    icon: 'settings',
  },
};

export function WorkspaceHeader({ view, rep }: { view: StudioView; rep: Repertoire | null }) {
  const setView = useApp((state) => state.setView);
  const setActiveRep = useApp((state) => state.setActiveRep);
  const data = useApp((state) => state.data);
  const deck = useApp((state) => state.trainDeck);
  const reps = useMemo(() => orderedReps(data, data.activeProfileId), [data]);
  const today = useTodayPlan();
  const info = useMemo(() => rep ? { lines: stats(rep).lineEnds, cards: counts(rep).total } : null, [rep]);
  const active = DESCRIPTIONS[view];
  const aboutRep = view === 'build' || view === 'tree' || view === 'audit';
  const showSelector = aboutRep || (view === 'train' && deck === 'repertoire');
  const total = view === 'train' ? `${today.total} today` : aboutRep ? `${info?.lines ?? 0} lines` : null;

  return (
    <header className="studio-workspace-header">
      <div className="studio-workspace-heading">
        <div className="studio-workspace-eyebrow">{active.eyebrow}</div>
        <h1>{active.title}</h1>
        <p>{active.lead}</p>
      </div>
      <div className="studio-workspace-meta">
        {showSelector && (
          <label className="studio-workspace-selector">
            <span className="sr-only">Working repertoire</span>
            <select className="input" aria-label="Working repertoire" value={rep?.id ?? ''}
              onChange={(event) => setActiveRep(event.target.value)}>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>{r.side === 'white' ? '♔' : '♚'} {r.name}</option>
              ))}
            </select>
          </label>
        )}
        {total && (
          <span className="studio-workspace-count">
            <Icon name={active.icon} size={15} /> {total}
          </span>
        )}
        <button className="studio-back-home" type="button" onClick={() => setView('home')}>
          <Icon name="home" size={16} /> Home
        </button>
      </div>
    </header>
  );
}
