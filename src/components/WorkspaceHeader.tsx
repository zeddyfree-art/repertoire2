import { useMemo } from 'react';
import { Icon, type IconName } from './Icon';
import { stats, type Repertoire } from '../lib/repertoire';
import { counts } from '../lib/srs';
import { useApp } from '../lib/store';
import { useTodayPlan } from '../lib/today';

export type StudioView = 'build' | 'train' | 'tree' | 'play' | 'games' | 'audit' | 'settings';

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
  const today = useTodayPlan();
  const info = useMemo(() => rep ? { lines: stats(rep).lineEnds, cards: counts(rep).total } : null, [rep]);
  const active = DESCRIPTIONS[view];
  const aboutRep = view === 'build' || view === 'tree' || view === 'audit';
  const total = view === 'train' ? `${today.total} today` : aboutRep ? `${info?.lines ?? 0} lines` : null;

  return (
    <header className="studio-workspace-header">
      <div className="studio-workspace-heading">
        <div className="studio-workspace-eyebrow">{active.eyebrow}</div>
        <h1>{active.title}</h1>
        <p>{active.lead}</p>
      </div>
      <div className="studio-workspace-meta">
        {(aboutRep || (view === 'train' && rep)) && (
          <div className="studio-workspace-chip">
            <span aria-hidden="true">{rep?.side === 'black' ? '♚' : '♔'}</span>
            <b>{rep?.name ?? 'All repertoires'}</b>
          </div>
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
