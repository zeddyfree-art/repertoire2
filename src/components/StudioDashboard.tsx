import { useEffect, useMemo, useState } from 'react';
import { Board } from './Board';
import { Icon } from './Icon';
import { formatLine, uciToArrow } from '../lib/chess';
import { ROOT, type Repertoire } from '../lib/repertoire';
import { forStudioScope, mainlinePreview, recentlyPracticed, studioSummary, type StudioScope } from '../lib/studioDashboard';
import type { TodayPlan } from '../lib/today';
import type { View } from '../lib/store';

interface Props {
  repertoires: Repertoire[];
  activeId: string | null;
  plan: TodayPlan;
  onPick: (id: string) => void;
  onOpen: (id: string, view: 'build' | 'train' | 'tree') => void;
  onNavigate: (view: View) => void;
  onTrainToday: () => void;
  onLearnNew: () => void;
  onNewRepertoire: () => void;
}

export function StudioDashboard({ repertoires, activeId, plan, onPick, onOpen, onNavigate, onTrainToday, onLearnNew, onNewRepertoire }: Props) {
  const active = repertoires.find((rep) => rep.id === activeId) ?? repertoires[0] ?? null;
  const frames = useMemo(() => active ? mainlinePreview(active) : [{ key: ROOT }], [active]);
  const [ply, setPly] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  useEffect(() => {
    setAutoplay(false);
    setPly(Math.min(6, frames.length - 1));
  }, [active?.id, frames]);
  const position = Math.min(ply, frames.length - 1);
  useEffect(() => {
    if (!autoplay) return;
    if (position >= frames.length - 1) {
      setAutoplay(false);
      return;
    }
    const timer = window.setTimeout(() => setPly((i) => Math.min(i + 1, frames.length - 1)), 950);
    return () => window.clearTimeout(timer);
  }, [autoplay, position, frames.length]);
  const frame = frames[position];
  const [scope, setScope] = useState<StudioScope>(() => {
    try {
      const saved = localStorage.getItem('repertoire2-dashboard-scope');
      return saved === 'play' || saved === 'study' || saved === 'all' ? saved : 'training';
    } catch { return 'training'; }
  });
  const chooseScope = (next: StudioScope) => {
    setScope(next);
    try { localStorage.setItem('repertoire2-dashboard-scope', next); } catch { /* ignore */ }
  };
  const selectedRepertoires = useMemo(() => forStudioScope(repertoires, scope), [repertoires, scope]);
  const summary = useMemo(() => studioSummary(selectedRepertoires, plan.total), [selectedRepertoires, plan.total]);
  const recent = useMemo(() => recentlyPracticed(selectedRepertoires), [selectedRepertoires]);
  const practiced = recent.some((day) => day.count > 0);
  const max = Math.max(1, ...recent.map((day) => day.count));
  const coords = recent.map((day, index) => ({
    x: 15 + index * 70,
    y: 132 - (day.count / max) * 107,
  }));
  const chartLine = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const chartArea = `M ${coords[0].x} 140 L ${coords.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${coords[coords.length - 1].x} 140 Z`;
  const reviewed = recent.reduce((sum, day) => sum + day.count, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';

  return (
    <div className="studio-dashboard">
      <header className="studio-editorial-head">
        <div className="studio-editorial-copy">
          <h1>{greeting}</h1>
          <p>Continue your training and grow your repertoire.</p>
        </div>
        <div className="studio-royal-mark" aria-hidden="true"><span>♚</span><span>♔</span><strong>♚</strong></div>
      </header>

      <div className="studio-dashboard-flow">
          <section className="studio-training-hero" aria-label="Today's training">
            <div>
              <div className="studio-overline">TODAY</div>
              <h2>Your next chess session</h2>
              <p>{plan.total > 0
                ? `${plan.total} ${plan.total === 1 ? 'position' : 'positions'} in today's session`
                : 'You are all caught up for today.'}</p>
            </div>
            <div className="studio-home-training-actions">
              <button className="studio-training-button" onClick={onTrainToday}>
                <Icon name="train" size={20}/> {plan.total > 0 ? `Review (${plan.total})` : 'Review'}
              </button>
              <button className="studio-training-secondary" onClick={onLearnNew}>
                <Icon name="plus" size={20}/> Learn new moves
              </button>
            </div>
            <div className="studio-leaf-motif" aria-hidden="true">❧</div>
          </section>


        <section className="studio-continue-card">
          <div className="studio-panel-head"><h2>Continue where you left off</h2></div>
          <button className="studio-continue-item" onClick={() => active ? onOpen(active.id, 'build') : onNewRepertoire()}>
            <span className="studio-action-icon"><Icon name="board" size={21}/></span>
            <span><b>Build repertoire</b><small>{active?.name ?? 'Create your first opening'}</small></span>
            <Icon name="next" size={19}/>
          </button>
          <button className="studio-continue-item" onClick={() => onNavigate('play')}>
            <span className="studio-action-icon"><Icon name="play" size={21}/></span>
            <span><b>Play vs. Maia</b><small>Practice against a human-like opponent</small></span>
            <Icon name="next" size={19}/>
          </button>
          <button className="studio-continue-item" onClick={() => onNavigate('games')}>
            <span className="studio-action-icon"><Icon name="games" size={21}/></span>
            <span><b>Analyze a game</b><small>Find and train your mistakes</small></span>
            <Icon name="next" size={19}/>
          </button>
        </section>

        <section className="studio-progress-card">
          <div className="studio-panel-head">
            <h2>Your progress</h2>
            <span>Latest reviews · 7 days</span>
          </div>
          <div className="studio-scope-tabs" role="group" aria-label="Which repertoires to include in progress">
            {([['training', 'Training now'], ['play', 'In play'], ['study', 'Study'], ['all', 'All']] as const).map(([value, label]) => (
              <button type="button" key={value} aria-pressed={scope === value} className={scope === value ? 'on' : ''} onClick={() => chooseScope(value)}>{label}</button>
            ))}
          </div>
          <p className="studio-scope-hint">{scope === 'training' ? 'Includes In play and Study; paused repertoires are excluded.' : scope === 'all' ? 'All repertoires, including those with SRS paused.' : scope === 'play' ? 'Repertoires used to check your played games, including any paused training.' : 'Study-only repertoires, including any paused training.'}</p>
          <div className="studio-progress-content">
            <div className="studio-weekly-chart">
              {practiced ? (
                <>
                  <svg viewBox="0 0 450 150" role="img" aria-label={`${reviewed} repertoire moves have their latest review in the last seven days`}>
                    <defs>
                      <linearGradient id="studio-chart-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity=".28"/>
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity=".02"/>
                      </linearGradient>
                    </defs>
                    <path d="M 15 140 H 435" className="studio-chart-axis"/>
                    <path d={chartArea} fill="url(#studio-chart-fill)"/>
                    <polyline points={chartLine} className="studio-chart-line"/>
                    {coords.map((pt, i) => <circle key={recent[i].key} cx={pt.x} cy={pt.y} r="3" className="studio-chart-dot"/>)}
                  </svg>
                  <div className="studio-chart-labels">{recent.map((day) => <span key={day.key} title={`${day.count} latest reviews`}>{day.label}</span>)}</div>
                </>
              ) : (
                <div className="studio-chart-empty"><Icon name="games" size={29}/><span>Your practice activity will appear here after your first reviews.</span></div>
              )}
              <div className="studio-chart-note">Shows each move's <em>latest</em> review, not the full review history.</div>
            </div>
            <div className="studio-progress-stats">
              <div className="studio-progress-fact"><span><Icon name="check" size={16}/> Reviewed at least once</span><strong>{summary.learned} / {summary.total}</strong></div>
              <div className="studio-progress-fact"><span><Icon name="target" size={16}/> Moves introduced</span><strong>{summary.progress === null ? '—' : `${summary.progress}%`}</strong></div>
              <div className="studio-progress-fact"><span><Icon name="tree" size={16}/> Prepared lines</span><strong>{summary.lines}</strong></div>
              {summary.byRepertoire.map((rep) =>
                <div className="studio-progress-by-rep" key={rep.id}>
                  <div><span title={`${rep.role}${rep.paused ? ', training paused' : ''}`}>{rep.name}{rep.paused ? ' · ⏸' : ''}</span><b>{rep.total ? `${rep.percent}%` : '—'}</b></div>
                  <div className="studio-progress-track"><i style={{ width: `${rep.percent}%` }}/></div>
                </div>
              )}
              {summary.byRepertoire.length === 0 && <div className="studio-progress-empty">No repertoires in this view yet.</div>}
            </div>
          </div>
        </section>


          <div className="studio-kpi-row" aria-label="Training overview">
            <div className="studio-kpi">
              <Icon name="train" size={23}/>
              <strong>{summary.today}</strong>
              <span>Daily session</span>
            </div>
            <div className="studio-kpi">
              <Icon name="target" size={23}/>
              <strong title="Share of SRS moves reviewed at least once — not mastery">{summary.progress === null ? '—' : `${summary.progress}%`}</strong>
              <span>Moves reviewed</span>
            </div>
            <div className="studio-kpi">
              <Icon name="tree" size={23}/>
              <strong title="Stored opening variations; independent of how often you reviewed them">{summary.lines}</strong>
              <span>Prepared lines</span>
            </div>
          </div>

        <section className="studio-featured-card" aria-label="Your featured repertoire">
          {active ? (
            <>
              <div className="studio-preview-stage">
                <Board
                  className="studio-preview-board"
                  position={frame.key}
                  orientation={active.side}
                  movable={null}
                  lastMove={frame.uci ? uciToArrow(frame.uci) : null}
                />
              </div>
              <div className="studio-featured-detail">
                <span className="studio-card-kicker">EXPLORE A MAIN LINE</span>
                <select aria-label="Featured repertoire" className="studio-featured-picker" value={active.id} onChange={(event) => onPick(event.target.value)}>
                  {repertoires.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
                </select>
                <h2>{active.name}</h2>
                <p className="studio-move-caption" aria-live="polite">{position === 0 ? 'Starting position' : formatLine(frames.slice(1, position + 1).map((m) => m.san!))}</p>
                <div className="studio-preview-nav" aria-label="Preview moves">
                  <button aria-label="Previous move" title="Previous move" onClick={() => { setAutoplay(false); setPly((i) => Math.max(0, i - 1)); }} disabled={position === 0}><Icon name="prev"/></button>
                  <button className="studio-preview-play" aria-label={autoplay ? 'Pause line playback' : 'Play line'} title={autoplay ? 'Pause' : 'Play the main line'} aria-pressed={autoplay} onClick={() => { if (autoplay) setAutoplay(false); else { if (position >= frames.length - 1) setPly(0); setAutoplay(true); } }} disabled={frames.length <= 1}><Icon name={autoplay ? 'pause' : 'play'}/></button>
                  <button aria-label="Next move in repertoire" title="Next move in repertoire" onClick={() => { setAutoplay(false); setPly((i) => Math.min(frames.length - 1, i + 1)); }} disabled={position === frames.length - 1}><Icon name="next"/></button>
                </div>
                <button className="studio-open-builder" onClick={() => onOpen(active.id, 'build')}><Icon name="board" size={17}/> Open in builder</button>
              </div>
            </>
          ) : (
            <div className="studio-no-repertoire">
              <span className="studio-empty-piece" aria-hidden="true">♘</span>
              <h2>Your next opening starts here</h2>
              <p>Build your first repertoire or import an existing PGN.</p>
              <button className="studio-open-builder" onClick={onNewRepertoire}><Icon name="plus"/> New repertoire</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
