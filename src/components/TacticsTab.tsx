import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import type { RunSpec } from './SetRunner';
import type { RunResult } from './PuzzleRun';
import { activeProfile, useApp } from '../lib/store';
import { ALL_MOTIFS, COMBINATION_THEMES, MODULES, PHASE_INFO, PHASES, type Module, type Motif } from '../lib/tactics/curriculum';
import { loadPuzzles, pickPuzzles, type TPuzzle } from '../lib/tactics/lichess';
import {
  addMisses,
  advanceWood,
  applyRatings,
  cycleOrder,
  dueReviews,
  interleave,
  learnNeed,
  moduleCollection,
  moduleProgress,
  moduleStep,
  newWood,
  nextModule,
  phaseResult,
  reviewResult,
  woodMastered,
  woodTarget,
  type CustomSet,
  type ModuleState,
  type TacticsProgress,
} from '../lib/tactics/progress';

export function useTactics(): TacticsProgress | undefined {
  return useApp((s) => activeProfile(s)?.tactics);
}

/** Puzzles per woodpecker session: a cycle is done in several sittings. */
const WOOD_CHUNK = 20;

const fmt = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function allIds(p: TacticsProgress): Set<string> {
  const ids = new Set<string>();
  for (const st of Object.values(p.modules)) {
    for (const ph of Object.values(st.learn)) ph.ids.forEach((i) => ids.add(i));
    st.mix?.ids.forEach((i) => ids.add(i));
    st.combine?.ids.forEach((i) => ids.add(i));
  }
  for (const c of p.custom) c.ids.forEach((i) => ids.add(i));
  return ids;
}

const isCombination = (p: TPuzzle) => p.themes.filter((t) => COMBINATION_THEMES.has(t)).length >= 2;

/** In the order the ids were stored (a set loaded again plays the same way). */
async function inOrder(ids: string[]): Promise<TPuzzle[]> {
  const map = await loadPuzzles(ids);
  return ids.map((id) => map.get(id)).filter((p): p is TPuzzle => !!p);
}

export function TacticsTab({ progress, onRun }: { progress: TacticsProgress; onRun: (spec: RunSpec) => void }) {
  const update = useApp((s) => s.updateTactics);
  const due = useMemo(() => dueReviews(progress), [progress]);
  const next = nextModule(progress);
  const [showCustom, setShowCustom] = useState(false);
  const [openModule, setOpenModule] = useState<string | null>(next?.id ?? null);

  // ---- Saving results ----
  const rateFirst = (results: RunResult[]) => update((p) => applyRatings(p!, results.map((r) => ({ rating: r.rating, solved: r.solved }))));
  const missed = (results: RunResult[]) => {
    const ids = results.filter((r) => !r.solved).map((r) => r.id);
    if (ids.length) update((p) => ({ ...p!, reviews: addMisses(p!.reviews, ids) }));
  };
  const setModule = (id: string, fn: (st: ModuleState) => ModuleState) =>
    update((p) => ({ ...p!, modules: { ...p!.modules, [id]: fn(p!.modules[id] ?? { learn: {} }) } }));

  // ---- Runs ----
  const runLearn = (mod: Module, motif: Motif) => {
    const existing = progress.modules[mod.id]?.learn[motif.theme];
    const firstRun = !existing || existing.runs === 0;
    onRun({
      title: `Learn: ${motif.name}`,
      subtitle: mod.title,
      showMotif: motif,
      build: async () => {
        if (existing?.ids.length) return inOrder(existing.ids).then((ps) => ps.sort(() => Math.random() - 0.5));
        const ps = await pickPuzzles({ theme: motif.theme, rating: progress.rating + PHASES.learn.offset, count: PHASES.learn.size, exclude: allIds(progress) });
        setModule(mod.id, (st) => ({ ...st, learn: { ...st.learn, [motif.theme]: { ids: ps.map((x) => x.id), runs: 0, last: 0, best: 0, passed: false } } }));
        return ps;
      },
      onComplete: (results) => {
        const share = results.filter((r) => r.solved).length / results.length;
        setModule(mod.id, (st) => ({ ...st, learn: { ...st.learn, [motif.theme]: phaseResult(st.learn[motif.theme], st.learn[motif.theme]?.ids ?? results.map((r) => r.id), share, learnNeed) } }));
        if (firstRun) rateFirst(results);
        missed(results);
        return [
          share >= learnNeed
            ? `${motif.name}: passed (${Math.round(share * 100)}%). On to the next step.`
            : `${Math.round(share * 100)}% — ${PHASES.learn.pass} of ${PHASES.learn.size} is the aim. Play the same set again: repetition is how the pattern sticks.`,
        ];
      },
    });
  };

  const runMix = (mod: Module) => {
    const existing = progress.modules[mod.id]?.mix;
    const firstRun = !existing || existing.runs === 0;
    onRun({
      title: 'Mix',
      subtitle: mod.title,
      askMotif: mod.motifs,
      build: async () => {
        if (existing?.ids.length) return inOrder(existing.ids);
        const exclude = allIds(progress);
        const per = Math.ceil(PHASES.mix.size / mod.motifs.length);
        const groups: TPuzzle[][] = [];
        for (const motif of mod.motifs) {
          const ps = await pickPuzzles({ theme: motif.theme, rating: progress.rating + PHASES.mix.offset, count: per, exclude });
          ps.forEach((x) => exclude.add(x.id));
          groups.push(ps);
        }
        const ps = interleave(groups).slice(0, PHASES.mix.size);
        setModule(mod.id, (st) => ({ ...st, mix: { ids: ps.map((x) => x.id), runs: 0, last: 0, best: 0, passed: false } }));
        return ps;
      },
      onComplete: (results) => {
        const share = results.filter((r) => r.solved).length / results.length;
        const named = results.filter((r) => r.motifOk).length / results.length;
        setModule(mod.id, (st) => ({ ...st, mix: phaseResult(st.mix, st.mix?.ids ?? [], share, PHASES.mix.pass, named) }));
        if (firstRun) rateFirst(results);
        missed(results);
        return [
          share >= PHASES.mix.pass ? `Passed: ${Math.round(share * 100)}% solved.` : `${Math.round(share * 100)}% solved — ${Math.round(PHASES.mix.pass * 100)}% is the aim. Play the set again.`,
          `You named the motif ${Math.round(named * 100)}% of the time. Recognising it is half of finding it.`,
        ];
      },
    });
  };

  const runCombine = (mod: Module) => {
    const existing = progress.modules[mod.id]?.combine;
    const firstRun = !existing || existing.runs === 0;
    onRun({
      title: 'Combine',
      subtitle: mod.title,
      build: async () => {
        if (existing?.ids.length) return inOrder(existing.ids);
        const exclude = allIds(progress);
        const per = Math.ceil(PHASES.combine.size / mod.motifs.length) + 1;
        const groups: TPuzzle[][] = [];
        for (const motif of mod.motifs) {
          const ps = await pickPuzzles({ theme: motif.theme, rating: progress.rating + PHASES.combine.offset, count: per, exclude, accept: isCombination, spread: 250 });
          ps.forEach((x) => exclude.add(x.id));
          groups.push(ps);
        }
        const ps = interleave(groups).slice(0, PHASES.combine.size);
        setModule(mod.id, (st) => ({ ...st, combine: { ids: ps.map((x) => x.id), runs: 0, last: 0, best: 0, passed: false } }));
        return ps;
      },
      onComplete: (results) => {
        const share = results.filter((r) => r.solved).length / results.length;
        setModule(mod.id, (st) => ({ ...st, combine: phaseResult(st.combine, st.combine?.ids ?? [], share, PHASES.combine.pass) }));
        if (firstRun) rateFirst(results);
        missed(results);
        return [share >= PHASES.combine.pass ? `Passed: ${Math.round(share * 100)}%. Now the woodpecker cycles.` : `${Math.round(share * 100)}% — ${Math.round(PHASES.combine.pass * 100)}% is the aim. These are at your own rating: play them again.`];
      },
    });
  };

  const runWood = (title: string, subtitle: string, ids: string[], wood: WoodLike, save: (fn: (w: NonNullable<WoodLike>) => NonNullable<WoodLike>) => void) => {
    const w = wood ?? newWood();
    const order = cycleOrder(ids, w.cycle);
    const chunk = order.slice(w.pos, w.pos + WOOD_CHUNK);
    onRun({
      title: `${title} · cycle ${w.cycle}`,
      subtitle,
      autoNext: true,
      timeTarget: woodTarget(w) ? Math.round(((woodTarget(w) ?? 0) * chunk.length) / ids.length) : null,
      build: () => inOrder(chunk),
      onResult: (r) => {
        save((cur) => advanceWood(cur, ids.length, [{ solved: r.solved, ms: r.ms }]));
        if (!r.solved) missed([r]);
      },
      onComplete: (results) => {
        const left = ids.length - Math.min(ids.length, w.pos + results.length);
        const solved = results.filter((r) => r.solved).length;
        const lines = [`${solved} of ${results.length} at the first try.`];
        if (left > 0) lines.push(`${left} puzzles left in cycle ${w.cycle}.`);
        else lines.push(`Cycle ${w.cycle} complete. The next cycle has the same puzzles in a new order, and a time target of 60% of this one.`);
        return lines;
      },
    });
  };

  const runModuleWood = (mod: Module) => {
    const st = progress.modules[mod.id];
    runWood('Woodpecker', mod.title, moduleCollection(mod, st), st?.wood, (fn) => setModule(mod.id, (s) => ({ ...s, wood: fn(s.wood ?? newWood()) })));
  };

  const runStep = (mod: Module) => {
    const step = moduleStep(mod, progress.modules[mod.id]);
    if (step.phase === 'learn') runLearn(mod, step.motif);
    else if (step.phase === 'mix') runMix(mod);
    else if (step.phase === 'combine') runCombine(mod);
    else runModuleWood(mod);
  };

  const runReviews = () => {
    const ids = due.slice(0, 30);
    onRun({
      title: 'Review',
      subtitle: 'Puzzles you missed, back after a pause',
      build: () => inOrder(ids),
      onResult: (r) => update((p) => ({ ...p!, reviews: reviewResult(p!.reviews, r.id, r.solved) })),
      onComplete: (results) => [`${results.filter((r) => r.solved).length} of ${results.length} right. Right ones come back later and later; after a two-week gap they leave the queue.`],
    });
  };

  const stepLabel = (mod: Module) => {
    const step = moduleStep(mod, progress.modules[mod.id]);
    if (step.phase === 'learn') return `Learn · ${step.motif.name}`;
    if (step.phase === 'woodpecker') return `Woodpecker · cycle ${progress.modules[mod.id]?.wood?.cycle ?? 1}`;
    if (step.phase === 'done') return 'Done';
    return PHASE_INFO[step.phase].title;
  };

  const ratingDelta = progress.history.length > 1 ? progress.rating - progress.history[Math.max(0, progress.history.length - 11)] : 0;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <section className="card card-pad stack eg-hero">
        <div className="eg-hero-top">
          <div className="stack" style={{ gap: 6, flex: '1 1 280px' }}>
            <div className="studio-overline">TACTICS RATING</div>
            <div className="eg-score">
              <b>{progress.rating}</b>
              <span className="muted">
                {progress.rated ? `${progress.rated} rated puzzles` : 'start rating'}
                {ratingDelta ? ` · ${ratingDelta > 0 ? '+' : ''}${ratingDelta} lately` : ''}
              </span>
            </div>
            <Sparkline values={progress.history} />
          </div>
          <div className="stat-row eg-stats">
            <div className="stat" title="Modules completed">
              <b style={{ color: 'var(--mine)' }}>{MODULES.filter((m) => moduleStep(m, progress.modules[m.id]).phase === 'done').length}</b>
              <span>of {MODULES.length} modules</span>
            </div>
            <div className="stat" title="Missed puzzles waiting for review">
              <b style={{ color: due.length ? 'var(--due)' : undefined }}>{due.length}</b>
              <span>to review</span>
            </div>
            <div className="stat" title="Missed puzzles in the queue, due later">
              <b>{Object.keys(progress.reviews).length}</b>
              <span>in the queue</span>
            </div>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className={`btn ${due.length ? 'primary' : ''}`} disabled={!due.length} onClick={runReviews}>
            <Icon name="train" size={16} /> {due.length ? `Review (${Math.min(due.length, 30)})` : 'Nothing to review'}
          </button>
          {next && (
            <button className={`btn ${due.length ? '' : 'primary'}`} onClick={() => runStep(next)}>
              <Icon name="next" size={16} /> Continue: {stepLabel(next)}
            </button>
          )}
        </div>
        <div className="small muted">
          <button
            className="link-button"
            onClick={() => {
              const v = Number(prompt('Set your tactics rating (600–2800). Your progress stays.', String(progress.rating)));
              if (v >= 600 && v <= 2800) update((p) => ({ ...p!, rating: Math.round(v), history: [...p!.history, Math.round(v)].slice(-60) }));
            }}
          >
            Change the rating
          </button>
          {' · '}Rating only moves on puzzles you see for the first time (repeats in cycles and reviews do not count). Sets are made around it: Learn {PHASES.learn.offset}, Mix {PHASES.mix.offset}, Combine at your rating.
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="studio-section-heading">
          <div>
            <h2>The path</h2>
            <span>Each module: learn the motifs one by one → mix them → combine them → three woodpecker cycles.</span>
          </div>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {MODULES.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              index={i + 1}
              mod={mod}
              st={progress.modules[mod.id]}
              open={openModule === mod.id}
              current={next?.id === mod.id}
              onToggle={() => setOpenModule(openModule === mod.id ? null : mod.id)}
              onLearn={(m) => runLearn(mod, m)}
              onMix={() => runMix(mod)}
              onCombine={() => runCombine(mod)}
              onWood={() => runModuleWood(mod)}
              onContinue={() => runStep(mod)}
              stepLabel={stepLabel(mod)}
            />
          ))}
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="studio-section-heading">
          <div>
            <h2>Own sets</h2>
            <span>Pick motifs, a rating and a number of cycles: a woodpecker set of your own.</span>
          </div>
          <button className="btn sm" onClick={() => setShowCustom((x) => !x)}>
            <Icon name="plus" size={14} /> New set
          </button>
        </div>
        {showCustom && (
          <CustomSetForm
            rating={progress.rating}
            onCreate={(set) => {
              update((p) => ({ ...p!, custom: [...p!.custom, set] }));
              setShowCustom(false);
            }}
          />
        )}
        {progress.custom.length === 0 && !showCustom && <div className="small muted">No own sets yet.</div>}
        <div className="eg-sections">
          {progress.custom.map((set) => (
            <CustomSetCard
              key={set.id}
              set={set}
              onRun={() =>
                runWood(set.name, 'Own set', set.ids, set.wood, (fn) =>
                  update((p) => ({ ...p!, custom: p!.custom.map((c) => (c.id === set.id ? { ...c, wood: fn(c.wood) } : c)) })),
                )
              }
              onDelete={() => update((p) => ({ ...p!, custom: p!.custom.filter((c) => c.id !== set.id) }))}
            />
          ))}
        </div>
      </section>

      <details className="card card-pad eg-howto">
        <summary>
          <b>Why it is built this way</b>
        </summary>
        <div className="stack small" style={{ gap: 8, marginTop: 10 }}>
          <p>
            <b>Learn</b> is blocked practice: one motif, named, a little below your rating. While a pattern is new, focused practice with a high
            success rate (around 85%) builds it fastest.
          </p>
          <p>
            <b>Mix</b> is interleaving: the motifs shuffled and unnamed, and you name the motif afterwards. It feels harder and scores lower than
            blocked practice, but it is what teaches you to <i>recognise</i> which pattern you are in — the skill a game asks for. The evidence comes
            mostly from maths and category learning; for chess it is the best guess we have.
          </p>
          <p>
            <b>Combine</b>: puzzles in which two or more motifs work together, at your own rating — real combinations.
          </p>
          <p>
            <b>Woodpecker</b> (Smith &amp; Tikkanen): the same collection again and again, faster each time, until you see the solutions at once.
            Strong players recognise thousands of patterns rather than calculating everything; repetition is how they get there.
          </p>
          <p>
            <b>Review</b>: every puzzle you miss comes back after a night, then after 3, 7 and 14 days (spaced retrieval). Retrieving something just
            before you would forget it is the most reliable way to keep it.
          </p>
        </div>
      </details>
    </div>
  );
}

type WoodLike = CustomSet['wood'] | undefined;

function ModuleCard(props: {
  index: number;
  mod: Module;
  st: ModuleState | undefined;
  open: boolean;
  current: boolean;
  stepLabel: string;
  onToggle: () => void;
  onLearn: (m: Motif) => void;
  onMix: () => void;
  onCombine: () => void;
  onWood: () => void;
  onContinue: () => void;
}) {
  const { index, mod, st, open, current, stepLabel } = props;
  const pct = moduleProgress(mod, st);
  const step = moduleStep(mod, st);
  const learned = mod.motifs.every((m) => st?.learn[m.theme]?.passed);
  const collection = moduleCollection(mod, st).length;
  return (
    <div className={`card card-pad stack eg-section ${step.phase === 'done' ? 'done' : ''}`}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>
            {index}. {mod.title}
          </h3>
          <div className="small muted">{mod.lead}</div>
        </div>
        <span className="eg-pct">{step.phase === 'done' ? '✓' : `${Math.round(pct * 100)}%`}</span>
      </div>
      <div className="progress">
        <div style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {step.phase !== 'done' && (
          <button className={`btn sm ${current ? 'primary' : ''}`} onClick={props.onContinue}>
            <Icon name="play" size={13} /> {stepLabel}
          </button>
        )}
        <button className="btn sm ghost" onClick={props.onToggle} aria-expanded={open}>
          {open ? 'Hide the steps' : 'All steps'}
        </button>
      </div>
      {open && (
        <div className="tc-steps">
          <div className="tc-step">
            <div className="tc-step-head">
              <b>1. {PHASE_INFO.learn.title}</b>
              <span className="small muted">{PHASES.learn.pass} of {PHASES.learn.size} per motif</span>
            </div>
            <div className="tc-motifs">
              {mod.motifs.map((m) => {
                const ph = st?.learn[m.theme];
                return (
                  <button key={m.theme} className={`tc-motif ${ph?.passed ? 'passed' : ph?.runs ? 'tried' : ''}`} onClick={() => props.onLearn(m)} title={m.lookFor}>
                    <span className={`eg-dot ${ph?.passed ? 'mastered' : ph?.runs ? 'learning' : 'new'}`} />
                    {m.name}
                    {ph?.runs ? <span className="faint"> {Math.round(ph.best * 100)}%</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <PhaseRow n={2} title={PHASE_INFO.mix.title} detail={`${PHASES.mix.size} puzzles, name the motif · ${Math.round(PHASES.mix.pass * 100)}%`} ph={st?.mix} locked={!learned} onRun={props.onMix} extra={st?.mix?.motifLast !== undefined ? `motifs named ${Math.round((st.mix.motifLast ?? 0) * 100)}%` : undefined} />
          <PhaseRow n={3} title={PHASE_INFO.combine.title} detail={`${PHASES.combine.size} combinations · ${Math.round(PHASES.combine.pass * 100)}%`} ph={st?.combine} locked={!st?.mix?.passed} onRun={props.onCombine} />
          <div className="tc-step">
            <div className="tc-step-head">
              <b>4. {PHASE_INFO.woodpecker.title}</b>
              <span className="small muted">
                {collection} puzzles × {PHASES.woodpecker.cycles} cycles · {Math.round(PHASES.woodpecker.pass * 100)}% in the last
              </span>
            </div>
            <WoodRow wood={st?.wood} total={collection} locked={!st?.combine?.passed} onRun={props.onWood} />
          </div>
          <div className="small muted">{PHASE_INFO[step.phase === 'done' ? 'woodpecker' : step.phase].why}</div>
        </div>
      )}
    </div>
  );
}

function PhaseRow({ n, title, detail, ph, locked, onRun, extra }: { n: number; title: string; detail: string; ph?: { runs: number; best: number; last: number; passed: boolean }; locked: boolean; onRun: () => void; extra?: string }) {
  return (
    <div className="tc-step">
      <div className="tc-step-head">
        <b>
          {n}. {title}
        </b>
        <span className="small muted">{detail}</span>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className={`eg-dot ${ph?.passed ? 'mastered' : ph?.runs ? 'learning' : 'new'}`} />
        <span className="small">
          {ph?.passed ? `passed · best ${Math.round(ph.best * 100)}%` : ph?.runs ? `last ${Math.round(ph.last * 100)}%` : locked ? 'after the step before' : 'not started'}
          {extra ? ` · ${extra}` : ''}
        </span>
        <span className="spacer" />
        <button className="btn sm" onClick={onRun} title={locked ? 'You can start it now, but the step before comes first on the path' : undefined}>
          {ph?.runs ? 'Again' : 'Start'}
        </button>
      </div>
    </div>
  );
}

function WoodRow({ wood, total, locked, onRun }: { wood: WoodLike; total: number; locked: boolean; onRun: () => void }) {
  const target = wood ? woodTarget(wood) : null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {wood?.done.map((c, i) => (
        <div key={i} className="row small" style={{ gap: 8 }}>
          <span className={`eg-dot ${c.correct / c.total >= PHASES.woodpecker.pass ? 'mastered' : 'learning'}`} />
          <span>
            Cycle {i + 1}: {Math.round((c.correct / c.total) * 100)}% · {fmt(c.ms)}
          </span>
        </div>
      ))}
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="small">
          {woodMastered(wood) ? 'Mastered — more cycles keep it sharp.' : total === 0 ? 'The collection is made in the steps before.' : `Cycle ${wood?.cycle ?? 1}: ${wood?.pos ?? 0} of ${total} done`}
          {target && !woodMastered(wood) ? ` · target ${fmt(target)}` : ''}
        </span>
        <span className="spacer" />
        <button className="btn sm" disabled={total === 0} onClick={onRun} title={locked ? 'Comes after Combine on the path' : undefined}>
          {wood?.pos ? 'Go on' : 'Start'} ({WOOD_CHUNK})
        </button>
      </div>
    </div>
  );
}

function CustomSetForm({ rating, onCreate }: { rating: number; onCreate: (s: CustomSet) => void }) {
  const [themes, setThemes] = useState<string[]>([]);
  const [r, setR] = useState(rating);
  const [size, setSize] = useState(50);
  const [cycles, setCycles] = useState(5);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (t: string) => setThemes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));

  const create = async () => {
    if (!themes.length) return;
    setBusy(true);
    setError(null);
    try {
      const per = Math.ceil(size / themes.length);
      const exclude = new Set<string>();
      const groups: TPuzzle[][] = [];
      for (const t of themes) {
        const ps = await pickPuzzles({ theme: t, rating: r, count: per, exclude, spread: 150 });
        ps.forEach((x) => exclude.add(x.id));
        groups.push(ps);
      }
      const ids = interleave(groups)
        .slice(0, size)
        .map((x) => x.id);
      const label = name.trim() || themes.map((t) => ALL_MOTIFS.find((m) => m.theme === t)?.name ?? t).join(', ');
      onCreate({ id: `set-${Date.now().toString(36)}`, name: label, themes, rating: r, cycles, ids, wood: newWood(), createdAt: Date.now() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad stack">
      <div className="stack" style={{ gap: 6 }}>
        <b>Motifs</b>
        <div className="tc-motifs">
          {[...ALL_MOTIFS, { theme: 'mix', name: 'Anything (healthy mix)', lookFor: '' }, { theme: 'mateIn3', name: 'Mate in 3', lookFor: '' }, { theme: 'endgame', name: 'Endgame', lookFor: '' }].map((m) => (
            <button key={m.theme} className={`tc-motif ${themes.includes(m.theme) ? 'passed' : ''}`} onClick={() => toggle(m.theme)}>
              {themes.includes(m.theme) ? '✓ ' : ''}
              {m.name}
            </button>
          ))}
        </div>
      </div>
      <div className="row wrap" style={{ gap: 14 }}>
        <label className="stack small" style={{ gap: 4 }}>
          Average rating
          <input className="input" type="number" min={600} max={2800} step={50} value={r} onChange={(e) => setR(Number(e.target.value) || rating)} style={{ width: 110 }} />
        </label>
        <label className="stack small" style={{ gap: 4 }}>
          Puzzles
          <select className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[20, 50, 100, 150].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="stack small" style={{ gap: 4 }}>
          Cycles
          <select className="input" value={cycles} onChange={(e) => setCycles(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="stack small" style={{ gap: 4, flex: 1, minWidth: 160 }}>
          Name (optional)
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pins and skewers" />
        </label>
      </div>
      {error && <div className="feedback bad">{error}</div>}
      <div className="row">
        <button className="btn primary" disabled={!themes.length || busy} onClick={() => void create()}>
          {busy ? 'Fetching puzzles…' : 'Make the set'}
        </button>
      </div>
    </div>
  );
}

function CustomSetCard({ set, onRun, onDelete }: { set: CustomSet; onRun: () => void; onDelete: () => void }) {
  const done = set.wood.done.length >= set.cycles;
  return (
    <div className={`card card-pad stack eg-section ${done ? 'done' : ''}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{set.name}</h3>
          <div className="small muted">
            {set.ids.length} puzzles · around {set.rating} · {set.cycles} cycles
          </div>
        </div>
        <span className="eg-pct">{done ? '✓' : `${set.wood.done.length}/${set.cycles}`}</span>
      </div>
      <WoodRow wood={set.wood} total={set.ids.length} locked={false} onRun={onRun} />
      <div className="row">
        <span className="spacer" />
        <button
          className="btn sm ghost"
          onClick={() => {
            if (confirm(`Delete “${set.name}”?`)) onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const v = values.slice(-40);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = Math.max(20, max - min);
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 200},${36 - ((x - min) / span) * 32}`).join(' ');
  return (
    <svg className="tc-spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-label="Rating trend">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
