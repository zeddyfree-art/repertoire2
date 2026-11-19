import { useEffect, useState } from 'react';
import { counts } from '../lib/srs';
import { activeProfile, orderedReps, useApp } from '../lib/store';
import { saveNow, type SaveResult } from '../lib/sync';
import { setTraining, type Repertoire } from '../lib/repertoire';
import { NEW_MISTAKE_CHOICES, NEW_MOVE_CHOICES, repTraining, reviewOnlyPlan, todayPlan, trainPrefs, unlearnedMoves, type TodayPart, type TodayPlan, type TrainPrefs } from '../lib/today';
import { Icon } from './Icon';
import { LineReviewSession } from './LineReview';
import { DeckTabs, MistakeSession } from './MistakesTrain';
import { SavedNote } from './SaveIndicator';
import { ReviewSession, type SessionScore } from './TrainView';

/** The player's training choices, changed here and synced to their other devices. */
export function useTrainPrefs(): [TrainPrefs, (patch: Partial<TrainPrefs>) => void] {
  const profile = useApp(activeProfile);
  const prefs = trainPrefs(profile);
  const set = (patch: Partial<TrainPrefs>) => profile && useApp.getState().updateProfile(profile.id, { trainPrefs: { ...prefs, ...patch } });
  return [prefs, set];
}

/** One repertoire's session settings: how many new moves a session adds, and whole lines or single cards. Kept with the
 *  repertoire, so each has its own, the same on all your devices. */
export function RepSessionSettings({ rep, compact = false, showNewLimit = true }: { rep: Repertoire; compact?: boolean; showNewLimit?: boolean }) {
  const [prefs] = useTrainPrefs();
  const own = repTraining(rep, prefs);
  const set = (patch: { newMoves?: number; wholeLines?: boolean }) =>
    useApp.getState().updateRep(rep.id, (r) => setTraining(r, patch), 'session settings', { undoable: false });
  return (
    <div className={compact ? 'row wrap' : 'stack'} style={{ gap: compact ? 10 : 8 }}>
      {showNewLimit && <div className="row wrap">
        <span className="muted small">New moves per session</span>
        {NEW_MOVE_CHOICES.map((n) => (
          <span key={n} className={`chip ${own.newMoves === n ? 'on' : ''}`} onClick={() => set({ newMoves: n })} title={n === 0 ? 'Only reviews: no new moves' : undefined}>
            {n}
          </span>
        ))}
      </div>}
      <label className="row small" style={{ gap: 6, cursor: 'pointer', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={own.wholeLines} onChange={(e) => set({ wholeLines: e.target.checked })} style={{ marginTop: 2 }} />
        <span>
          <b>Play whole lines</b>
          {!compact && <span className="muted"> — you play all your moves of each line, for the reflex; a move that is not due only counts when you get it wrong.</span>}
        </span>
      </label>
    </div>
  );
}

/** Today's settings: your mistake cards, and each repertoire's own settings in one place. */
function TodaySettings({ reps, mistakes }: { reps: Repertoire[]; mistakes: boolean }) {
  const [prefs, setPrefs] = useTrainPrefs();
  return (
    <div className="stack" style={{ gap: 10 }}>
      {reps.map((r) => (
        <div key={r.id} className="stack" style={{ gap: 4 }}>
          <div className="small">
            <b>
              {r.side === 'white' ? '♔' : '♚'} {r.name}
            </b>
            <span className="faint"> · {r.trainDepth ? `up to move ${r.trainDepth}` : 'all moves'} (on its own tab)</span>
          </div>
          <RepSessionSettings rep={r} compact showNewLimit={false} />
        </div>
      ))}
      {mistakes && (
        <div className="row wrap">
          <span className="muted small">New mistake cards per session</span>
          {NEW_MISTAKE_CHOICES.map((n) => (
            <span key={n} className={`chip ${prefs.newMistakes === n ? 'on' : ''}`} onClick={() => setPrefs({ newMistakes: n })}>
              {n}
            </span>
          ))}
        </div>
      )}
      <div className="small faint">Training style is saved per repertoire. New moves are introduced only from Learn new moves.</div>
    </div>
  );
}

/** The Train tab's first page: one button for today's session over everything. */
export function TodayTrain() {
  const [prefs, setPrefs] = useTrainPrefs();
  const myCards = useApp((s) => (s.data.mistakes ?? []).some((m) => m.profileId === s.data.activeProfileId));
  const data = useApp((s) => s.data);
  const autostart = useApp((s) => s.todayAutostart);
  const [session, setSession] = useState<TodayPlan | null>(null);
  const [learningRep, setLearningRep] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [selectedForLearning, setSelectedForLearning] = useState<string>('');
  const reviewPlan = reviewOnlyPlan(
    orderedReps(data, data.activeProfileId),
    (data.mistakes ?? []).filter((m) => m.profileId === data.activeProfileId),
    prefs,
  );

  // "Train" on the Overview: straight into the session.
  useEffect(() => {
    if (!autostart) return;
    useApp.getState().clearTodayAutostart();
    if (reviewPlan.total) setSession(reviewPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart]);

  if (session) return <TodaySession plan={session} onExit={() => setSession(null)} />;
  if (learningRep) return <LearnNewMoves repId={learningRep} onExit={() => setLearningRep(null)} />;

  const reps = orderedReps(data, data.activeProfileId);
  const paused = reps.filter((r) => r.paused);
  const byRep = new Map<string, { reviews: number; fresh: number }>();
  for (const p of reviewPlan.parts) {
    if (p.kind === 'mistakes') continue;
    const x = byRep.get(p.repId) ?? { reviews: 0, fresh: 0 };
    if (p.kind === 'review') x.reviews += p.items.length;
    else x.fresh += p.items.length;
    byRep.set(p.repId, x);
  }
  const mistakes = reviewPlan.parts.find((p) => p.kind === 'mistakes');
  const available = reps.filter((r) => !r.paused && unlearnedMoves(r).length > 0);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }} className="stack">
      <DeckTabs />
      <div className="card card-pad stack today-card">
        <div className="row">
          <h2>Today</h2>
          <span className="spacer" />
          <button className="btn sm ghost" aria-pressed={settings} aria-expanded={settings} onClick={() => setSettings((x) => !x)} title="Session settings">
            <Icon name="settings" size={15} /> Settings
          </button>
        </div>
        <p className="muted">Review what is due, or choose an opening and learn new moves. No settings to switch back and forth.</p>
        <div className="studio-train-entry-actions">
          <section className="studio-train-action">
            <div className="studio-mini-kicker">SPACED REPETITION</div>
            <h3>Review</h3>
            <p>Only scheduled reviews. No new moves will be introduced.</p>
            <button className="btn primary lg" disabled={!reviewPlan.total} onClick={() => setSession(reviewPlan)}>
              <Icon name="train" size={18}/> Review ({reviewPlan.total})
            </button>
            {!reviewPlan.total && <small className="muted">You're up to date. Come back when cards are due.</small>}
          </section>
          <section className="studio-train-action">
            <div className="studio-mini-kicker">EXPAND YOUR REPERTOIRE</div>
            <h3>Learn new moves</h3>
            <p>Learn prepared moves in one repertoire at your own pace. Stop whenever you like.</p>
            <label className="field">
              <span className="small">Choose repertoire</span>
              <select className="input" aria-label="Repertoire to learn" value={selectedForLearning || available[0]?.id || ''}
                onChange={(e) => setSelectedForLearning(e.target.value)}>
                {available.length ? available.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({unlearnedMoves(r).length} new)</option>
                )) : <option value="">No new moves available</option>}
              </select>
            </label>
            <button className="btn lg" disabled={!available.length}
              onClick={() => setLearningRep(available.some((r) => r.id === selectedForLearning) ? selectedForLearning : available[0].id)}>
              <Icon name="play" size={18}/> Start learning
            </button>
          </section>
        </div>
        {reviewPlan.total > 0 && (
          <details className="studio-review-breakdown">
            <summary className="small muted">Due across your repertoires ({reviewPlan.total})</summary>
            <ul className="today-list small">
              {reps.filter((r) => byRep.has(r.id)).map((r) => (
                <li key={r.id}>{r.side === 'white' ? '♔' : '♚'} {r.name} — {byRep.get(r.id)?.reviews ?? 0} due</li>
              ))}
              {mistakes && <li>My mistakes — {mistakes.cards.length} due</li>}
            </ul>
          </details>
        )}
        {myCards && (
          <label className="row small" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={prefs.withMistakes} onChange={(e) => setPrefs({ withMistakes: e.target.checked })} />
            Include my mistake cards
            {!prefs.withMistakes && <span className="faint">(train them on their own tab)</span>}
          </label>
        )}
        {paused.length > 0 && (
          <div className="small faint">
            Paused, so left out: {paused.map((r) => r.name).join(', ')}.
          </div>
        )}
        {settings && <TodaySettings reps={reps.filter((r) => !r.paused)} mistakes={myCards && prefs.withMistakes} />}
      </div>
      <details className="card card-pad help">
        <summary>
          <b style={{ color: 'var(--text)' }}>How today’s session works</b>
        </summary>
        <div className="stack" style={{ gap: 6, marginTop: 8 }}>
          <div>
            Review schedules only previously introduced moves (and due mistake cards if included). Learn new moves lets you
            choose one repertoire, introduces only its unlearned SRS cards and continues until you stop or all moves are learned.
            Both keep the same SRS history, due dates and notes. Paused repertoires are never included.
          </div>
          <div>
            New repertoire moves are never introduced during Review. Practice all lines on an individual repertoire
            remains available without changing SRS progress.
          </div>
        </div>
      </details>
    </div>
  );
}

/** A single continuous learning session; unreached cards stay new when Stop is pressed.
 * ReviewSession grades a new card only after it has been taught and recalled. */
function LearnNewMoves({ repId, onExit }: { repId: string; onExit: () => void }) {
  const rep = useApp((s) => s.data.repertoires.find((r) => r.id === repId));
  const [batch, setBatch] = useState(0);
  const [breakTime, setBreakTime] = useState(false);
  const [learned, setLearned] = useState(0);
  // A short automatic batch creates a natural resting point; the user never
  // has to choose a 5/10-card limit. Unreached cards remain State.New.
  const [items, setItems] = useState(() => {
    const chosen = useApp.getState().data.repertoires.find((r) => r.id === repId);
    return chosen ? unlearnedMoves(chosen).slice(0, 3).map((i) => ({ ...i, kind: 'learn' as const })) : [];
  });
  if (!rep) return <div className="card card-pad"><p>This repertoire is no longer available.</p><button className="btn" onClick={onExit}>Back</button></div>;
  if (rep.paused) return <div className="card card-pad stack"><h2>Training paused</h2><p>Resume SRS from the repertoire card before learning new moves.</p><button className="btn" onClick={onExit}>Back</button></div>;
  const nextBatch = () => {
    const current = useApp.getState().data.repertoires.find((r) => r.id === repId);
    setItems(current ? unlearnedMoves(current).slice(0, 3).map((i) => ({ ...i, kind: 'learn' as const })) : []);
    setBatch((n) => n + 1);
    setBreakTime(false);
  };
  const remaining = unlearnedMoves(rep).length;
  return (
    <div className="stack studio-continuous-learn" style={{ gap: 10 }}>
      <div className="today-bar small"><b>Learn new moves</b><span className="muted"> · {rep.name} · stop at any time</span></div>
      {breakTime || !items.length ? (
        <div className="card card-pad stack studio-learning-rest">
          <h2>{remaining ? 'Ready for the next line?' : 'All eligible moves introduced'}</h2>
          <p>{learned} moves reviewed in this learning session. {remaining ? `${remaining} new moves remain.` : 'You are caught up for now.'}</p>
          <div className="row wrap">
            {remaining > 0 && <button className="btn primary" onClick={nextBatch}>Continue learning</button>}
            <button className="btn" onClick={onExit}>Finish for now</button>
          </div>
        </div>
      ) : (
        <ReviewSession key={batch} rep={rep} initial={items} onExit={onExit}
          onDone={() => { setLearned((n) => n + items.length); setBreakTime(true); }} />
      )}
    </div>
  );
}

function partLabel(part: TodayPart, name: string | undefined): string {
  if (part.kind === 'mistakes') return `My mistakes (${part.cards.length})`;
  return `${name ?? 'Repertoire'}: ${part.kind === 'review' ? 'reviews' : 'new moves'} (${part.items.length})`;
}

/** Today's session: its parts one after another, then one summary. */
function TodaySession({ plan, onExit }: { plan: TodayPlan; onExit: () => void }) {
  const reps = useApp((s) => s.data.repertoires);
  const activeRepId = useApp((s) => s.data.activeRepId);
  const profile = useApp(activeProfile);
  // Whole lines or single cards per repertoire, as chosen when the session started.
  const [wholeLines] = useState(() => new Map(reps.map((r) => [r.id, repTraining(r, trainPrefs(profile)).wholeLines])));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState<SessionScore>({ good: 0, bad: 0 });
  const part = plan.parts[index];
  const rep = part && part.kind !== 'mistakes' ? reps.find((r) => r.id === part.repId) : undefined;
  const gone = !!part && part.kind !== 'mistakes' && !rep;

  // The repertoire being trained is the selected one, so "Open in Build" opens the right one.
  useEffect(() => {
    if (rep && rep.id !== activeRepId) useApp.getState().setActiveRep(rep.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  // A repertoire deleted meanwhile (here or on another device): skip its part.
  useEffect(() => {
    if (gone) setIndex((i) => i + 1);
  }, [gone]);

  const next = (s: SessionScore) => {
    setScore((t) => ({ good: t.good + s.good, bad: t.bad + s.bad }));
    setIndex((i) => i + 1);
  };

  if (!part) return <TodayDone score={score} onBack={onExit} />;
  if (gone || (part.kind !== 'mistakes' && !rep)) return null;

  const bar = (
    <div className="today-bar small">
      <b>Today</b>
      <span className="muted">
        {' '}
        · part {index + 1} of {plan.parts.length} · {partLabel(part, rep?.name)}
      </span>
    </div>
  );
  let body: React.ReactNode;
  if (part.kind === 'mistakes') body = <MistakeSession key={index} initial={part.cards} onExit={onExit} onDone={next} />;
  else if (wholeLines.get(rep!.id) && part.kind !== 'review') body = <LineReviewSession key={index} rep={rep!} items={part.items} start={[]} onExit={onExit} onDone={next} />;
  else
    body = (
      <ReviewSession
        key={index}
        rep={rep!}
        initial={part.items.map((it) => ({ ...it, kind: part.kind === 'new' ? ('learn' as const) : ('review' as const) }))}
        onExit={onExit}
        onDone={next}
      />
    );
  return (
    <div className="stack" style={{ gap: 8 }}>
      {bar}
      {body}
    </div>
  );
}

function TodayDone({ score, onBack }: { score: SessionScore; onBack: () => void }) {
  const data = useApp((s) => s.data);
  const profile = useApp(activeProfile);
  const [saved, setSaved] = useState<SaveResult | 'saving' | null>('saving');
  useEffect(() => {
    let alive = true;
    saveNow().then((r) => alive && setSaved(r));
    return () => {
      alive = false;
    };
  }, []);
  const reps = orderedReps(data, data.activeProfileId);
  const left = todayPlan(
    reps.map((r) => ({ ...r, newMoves: 0 })),
    (data.mistakes ?? []).filter((m) => m.profileId === data.activeProfileId),
    { ...trainPrefs(profile), newMoves: 0, newMistakes: 0 },
  );
  const fresh = reps.filter((r) => !r.paused).reduce((a, r) => a + counts(r).fresh, 0);
  return (
    <div style={{ maxWidth: 560, margin: '40px auto' }} className="card card-pad stack">
      <h2>Today done 🎉</h2>
      <div className="stat-row">
        <div className="stat">
          <b style={{ color: 'var(--mine)' }}>{score.good}</b>
          <span>right first time</span>
        </div>
        <div className="stat">
          <b style={{ color: 'var(--gap)' }}>{score.bad}</b>
          <span>wrong (coming back soon)</span>
        </div>
        <div className="stat">
          <b>{left.total}</b>
          <span>still due</span>
        </div>
      </div>
      {fresh > 0 && <div className="small muted">{fresh} new moves are waiting for another day.</div>}
      {saved && <SavedNote state={saved} />}
      <div className="row">
        <button className="btn primary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
