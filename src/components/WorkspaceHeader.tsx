import { useMemo } from 'react';
import { Icon } from './Icon';
import { stats, type Repertoire } from '../lib/repertoire';
import { counts } from '../lib/srs';
import { useApp, type View } from '../lib/store';
import { useTodayPlan } from '../lib/today';

export function WorkspaceHeader({ view, rep }: { view: 'build' | 'train' | 'tree'; rep: Repertoire | null }) {
  const setView = useApp((state) => state.setView);
  const today = useTodayPlan();
  const info = useMemo(() => rep ? { lines: stats(rep).lineEnds, cards: counts(rep).total } : null, [rep]);
  const description: Record<'build' | 'train' | 'tree', { eyebrow: string; title: string; lead: string }> = {
    build: {
      eyebrow: 'OPENING WORKSHOP',
      title: 'Build your repertoire',
      lead: 'Prepare your moves, explore alternatives and refine each line.',
    },
    train: {
      eyebrow: 'PRACTICE STUDIO',
      title: 'Train with purpose',
      lead: 'Turn prepared moves into confident decisions at the board.',
    },
    tree: {
      eyebrow: 'OPENING ATLAS',
      title: 'Explore your repertoire',
      lead: 'See the structure of every variation and find your next idea.',
    },
  };
  const active = description[view];
  return (
    <header className="studio-workspace-header">
      <div className="studio-workspace-heading">
        <div className="studio-workspace-eyebrow">{active.eyebrow}</div>
        <h1>{active.title}</h1>
        <p>{active.lead}</p>
      </div>
      <div className="studio-workspace-meta">
        <div className="studio-workspace-chip">
          <span aria-hidden="true">{rep?.side === 'black' ? '♚' : '♔'}</span>
          <b>{rep?.name ?? 'All repertoires'}</b>
        </div>
        <span className="studio-workspace-count">
          <Icon name={view === 'train' ? 'train' : view === 'tree' ? 'tree' : 'board'} size={15}/>
          {view === 'train' ? `${today.total} today` : `${info?.lines ?? 0} lines`}
        </span>
        <button className="studio-back-home" type="button" onClick={() => setView('home')}>
          <Icon name="home" size={16} /> Home
        </button>
      </div>
    </header>
  );
}
