// Tactics and calculation progress, kept on the player (Profile.tactics) so it syncs. Puzzles themselves are stored
// in the browser; here only their ids.

import { LADDER_PASS, LADDER_WINDOW, MATE_LADDER, MAX_GHOST_DEPTH, MODULES, PHASES, type Module, type Motif, type PhaseId } from './curriculum';

export interface PhaseState {
  ids: string[];
  /** Times the set was played through. */
  runs: number;
  /** Share solved at the first try, last run and best run (0–1). */
  last: number;
  best: number;
  passed: boolean;
  /** Mix only: share of motifs named correctly in the last run. */
  motifLast?: number;
}

export interface WoodState {
  /** 1-based cycle in progress. */
  cycle: number;
  /** Puzzles done in this cycle (by index in the cycle's order). */
  pos: number;
  correct: number;
  ms: number;
  done: { correct: number; total: number; ms: number }[];
}

export interface ModuleState {
  learn: Record<string, PhaseState>;
  mix?: PhaseState;
  combine?: PhaseState;
  wood?: WoodState;
}

export interface CustomSet {
  id: string;
  name: string;
  themes: string[];
  rating: number;
  cycles: number;
  ids: string[];
  wood: WoodState;
  createdAt: number;
}

export interface ReviewItem {
  box: number;
  due: number;
}

export interface TacticsProgress {
  /** Your tactics rating: set at the start, then it moves with every new puzzle (Elo). */
  rating: number;
  rated: number;
  history: number[];
  modules: Record<string, ModuleState>;
  reviews: Record<string, ReviewItem>;
  custom: CustomSet[];
  calc: {
    mateRung: number;
    mate: Record<string, boolean[]>;
    ghostDepth: number;
    ghost: Record<string, boolean[]>;
  };
}

export function newProgress(rating: number): TacticsProgress {
  return {
    rating: Math.round(rating),
    rated: 0,
    history: [Math.round(rating)],
    modules: {},
    reviews: {},
    custom: [],
    calc: { mateRung: 0, mate: {}, ghostDepth: 1, ghost: {} },
  };
}

// ---------- Rating ----------

/** Elo against the puzzle's rating: big steps at first, smaller once the rating has settled. */
export function rate(rating: number, rated: number, puzzleRating: number, solved: boolean): number {
  const k = rated < 20 ? 40 : rated < 60 ? 24 : 16;
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  return Math.round(rating + k * ((solved ? 1 : 0) - expected));
}

export function applyRatings(p: TacticsProgress, games: { rating: number; solved: boolean }[]): TacticsProgress {
  let rating = p.rating;
  let rated = p.rated;
  for (const g of games) {
    rating = rate(rating, rated, g.rating, g.solved);
    rated++;
  }
  if (!games.length) return p;
  return { ...p, rating, rated, history: [...p.history, rating].slice(-60) };
}

// ---------- Phases ----------

export function phaseResult(prev: PhaseState | undefined, ids: string[], share: number, need: number, motifShare?: number): PhaseState {
  return {
    ids,
    runs: (prev?.runs ?? 0) + 1,
    last: share,
    best: Math.max(prev?.best ?? 0, share),
    passed: (prev?.passed ?? false) || share >= need,
    motifLast: motifShare ?? prev?.motifLast,
  };
}

export const learnNeed = PHASES.learn.pass / PHASES.learn.size;

/** All puzzles of a module (learn sets, mix, combine), the woodpecker collection. */
export function moduleCollection(mod: Module, st: ModuleState | undefined): string[] {
  if (!st) return [];
  return [...mod.motifs.flatMap((x) => st.learn[x.theme]?.ids ?? []), ...(st.mix?.ids ?? []), ...(st.combine?.ids ?? [])];
}

export function woodMastered(w: WoodState | undefined, cycles: number = PHASES.woodpecker.cycles): boolean {
  if (!w || w.done.length < cycles) return false;
  const last = w.done[w.done.length - 1];
  return last.correct / last.total >= PHASES.woodpecker.pass;
}

export function newWood(): WoodState {
  return { cycle: 1, pos: 0, correct: 0, ms: 0, done: [] };
}

/** Adds results to a woodpecker cycle; closes the cycle when the collection is through. */
export function advanceWood(w: WoodState, total: number, results: { solved: boolean; ms: number }[]): WoodState {
  const next: WoodState = {
    ...w,
    done: [...w.done],
    pos: w.pos + results.length,
    correct: w.correct + results.filter((r) => r.solved).length,
    ms: w.ms + results.reduce((s, r) => s + r.ms, 0),
  };
  if (next.pos >= total) {
    next.done.push({ correct: next.correct, total, ms: next.ms });
    return { cycle: next.cycle + 1, pos: 0, correct: 0, ms: 0, done: next.done };
  }
  return next;
}

/** Time target for the cycle in progress: each cycle in 60% of the time of the one before. */
export function woodTarget(w: WoodState): number | null {
  const prev = w.done[w.done.length - 1];
  return prev ? Math.round(prev.ms * PHASES.woodpecker.speedup) : null;
}

/** The order of a cycle: the same puzzles, shuffled differently each cycle (so you recognise patterns, not order). */
export function cycleOrder(ids: string[], cycle: number): string[] {
  const out = [...ids];
  let seed = 2166136261 ^ (cycle * 7919);
  const rand = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type Step =
  | { phase: 'learn'; motif: Motif }
  | { phase: 'mix' }
  | { phase: 'combine' }
  | { phase: 'woodpecker' }
  | { phase: 'done' };

/** What comes next in a module. */
export function moduleStep(mod: Module, st: ModuleState | undefined): Step {
  for (const motif of mod.motifs) if (!st?.learn[motif.theme]?.passed) return { phase: 'learn', motif };
  if (!st?.mix?.passed) return { phase: 'mix' };
  if (!st?.combine?.passed) return { phase: 'combine' };
  if (!woodMastered(st?.wood)) return { phase: 'woodpecker' };
  return { phase: 'done' };
}

/** 0–1: how far through the module. Learn half, mix, combine and the three cycles count equally after it. */
export function moduleProgress(mod: Module, st: ModuleState | undefined): number {
  if (!st) return 0;
  const learned = mod.motifs.filter((x) => st.learn[x.theme]?.passed).length / mod.motifs.length;
  const cycles = Math.min(st.wood?.done.length ?? 0, PHASES.woodpecker.cycles);
  const parts = [learned, st.mix?.passed ? 1 : 0, st.combine?.passed ? 1 : 0, woodMastered(st.wood) ? 1 : cycles / (PHASES.woodpecker.cycles + 1)];
  return (parts[0] * 2 + parts[1] + parts[2] + parts[3] * 2) / 6;
}

export function nextModule(p: TacticsProgress): Module | null {
  return MODULES.find((mod) => moduleStep(mod, p.modules[mod.id]).phase !== 'done') ?? null;
}

export const PHASE_ORDER: PhaseId[] = ['learn', 'mix', 'combine', 'woodpecker'];

// ---------- Reviews (spaced retrieval of missed puzzles) ----------

const DAY = 86_400_000;
export const REVIEW_DAYS = [1, 1, 3, 7, 14, 30];
/** Passed at this box (after a two-week gap) and it leaves the queue. */
export const RETIRE_BOX = 5;

export function addMisses(reviews: Record<string, ReviewItem>, ids: string[], now = Date.now()): Record<string, ReviewItem> {
  const out = { ...reviews };
  // Not again today: the first review comes after a night's sleep.
  for (const id of ids) out[id] = { box: 0, due: now + 20 * 60 * 60 * 1000 };
  return out;
}

export function reviewResult(reviews: Record<string, ReviewItem>, id: string, solved: boolean, now = Date.now()): Record<string, ReviewItem> {
  const out = { ...reviews };
  const r = out[id] ?? { box: 0, due: now };
  if (!solved) out[id] = { box: 0, due: now + 20 * 60 * 60 * 1000 };
  else if (r.box + 1 >= RETIRE_BOX) delete out[id];
  else out[id] = { box: r.box + 1, due: now + REVIEW_DAYS[r.box + 1] * DAY };
  return out;
}

export function dueReviews(p: TacticsProgress, now = Date.now()): string[] {
  return Object.entries(p.reviews)
    .filter(([, r]) => r.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

// ---------- Ladders ----------

export function ladderPush(results: boolean[] | undefined, solved: boolean): boolean[] {
  return [...(results ?? []), solved].slice(-30);
}

export function ladderScore(results: boolean[] | undefined): { solved: number; played: number; passed: boolean } {
  const last = (results ?? []).slice(-LADDER_WINDOW);
  const solved = last.filter(Boolean).length;
  return { solved, played: last.length, passed: last.length >= LADDER_WINDOW && solved >= LADDER_PASS };
}

/** After a result at `level`: the unlocked level moves up when the current one is passed. */
export function climb(current: number, level: number, results: boolean[], max: number): number {
  return level === current && ladderScore(results).passed ? Math.min(max, current + 1) : current;
}

export const MAX_MATE_RUNG = MATE_LADDER.length - 1;
export { MAX_GHOST_DEPTH };

/** The depth of the next ghost puzzle: mostly your level, sometimes one easier or harder. */
export function pickGhostDepth(level: number, rand = Math.random): number {
  const x = rand();
  if (x < 0.15) return Math.max(1, level - 1);
  if (x < 0.3) return Math.min(MAX_GHOST_DEPTH, level + 1);
  return level;
}

// ---------- Mixing ----------

/** Interleaves lists so no two neighbours come from the same list, as far as possible. */
export function interleave<T>(groups: T[][], rand = Math.random): T[] {
  const pools = groups.map((g) => [...g].sort(() => rand() - 0.5)).filter((g) => g.length);
  const out: T[] = [];
  let last = -1;
  while (pools.some((p) => p.length)) {
    const options = pools.map((_, i) => i).filter((i) => pools[i].length && i !== last);
    const pick = options.length ? options.reduce((a, b) => (pools[b].length > pools[a].length ? b : a)) : pools.findIndex((p) => p.length);
    out.push(pools[pick].pop()!);
    last = pick;
  }
  return out;
}
