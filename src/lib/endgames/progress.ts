// Scores and the schedule for the endgame drills and puzzle tests. Kept on the player (Profile.endgames), so it
// syncs with the rest of their data.
//
// Drills use boxes (Leitner): every pass moves a drill one box up, a miss sends it back to the start.
//   box 0     new, or missed last time — practise it now
//   box 1–2   learning: one or two passes in a row
//   box 3+    mastered ("three times in a row", as the checklist asks); then it comes back for upkeep after
//             7, 14, 30 and 60 days.
// While learning, every pass counts, also several on one day. Once mastered, practising before it is due is fine
// but only a due review moves it further.

import { ALL_DRILLS, ALL_SECTIONS, ALL_TESTS, PUZZLE_PASS, STAGES, type Drill, type PuzzleTest, type Section } from './curriculum';

export interface DrillRecord {
  box: number;
  /** When it is due again (ms). */
  due: number;
  attempts: number;
  passes: number;
  /** Stars of the last attempts, newest last (at most 8). */
  recent: number[];
  best: number;
  /** Fastest solve without mistakes (ms), for the mates with a time target. */
  bestMs?: number;
  lastAt: number;
}

export interface PuzzleRecord {
  /** First-try results, newest last (at most 40). */
  results: boolean[];
  total: number;
  solved: number;
  lastAt: number;
}

export interface EndgameProgress {
  drills: Record<string, DrillRecord>;
  puzzles: Record<string, PuzzleRecord>;
}

export const EMPTY_PROGRESS: EndgameProgress = { drills: {}, puzzles: {} };

const DAY = 24 * 60 * 60 * 1000;
/** Days until the next review once a drill reaches a box. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60];
export const MAX_BOX = BOX_DAYS.length - 1;
export const MASTERED_BOX = 3;

export interface Attempt {
  /** Moves that threw the result away (each was taken back). */
  mistakes: number;
  hints: number;
  /** Win-or-draw question answered wrongly. */
  wrongVerdict: boolean;
  gaveUp: boolean;
  solved: boolean;
  ms: number;
  /** Your moves, and the fewest possible (mates with the tablebase). */
  moves: number;
  optimal?: number;
}

/** 3 = clean (no mistake, no hint, quick enough), 2 = solved without a mistake, 1 = solved after a mistake or a wrong
 *  call, 0 = not solved. Two stars or more is a pass. */
export function starsFor(a: Attempt, drill: Pick<Drill, 'targetSec'>): number {
  if (a.gaveUp || !a.solved) return 0;
  if (a.mistakes > 0 || a.wrongVerdict) return 1;
  const slowClock = drill.targetSec !== undefined && a.ms > drill.targetSec * 1000;
  return a.hints > 0 || slowClock || !efficient(a) ? 2 : 3;
}

/** Close enough to the shortest mate: at most a quarter more moves, and never fewer than two spare. */
export function efficient(a: Pick<Attempt, 'moves' | 'optimal'>): boolean {
  if (!a.optimal) return true;
  return a.moves <= a.optimal + Math.max(2, Math.round(a.optimal * 0.25));
}

export const PASS_STARS = 2;

export function recordAttempt(prev: DrillRecord | undefined, stars: number, ms: number, now = Date.now()): DrillRecord {
  const r: DrillRecord = prev
    ? { ...prev, recent: [...prev.recent] }
    : { box: 0, due: now, attempts: 0, passes: 0, recent: [], best: 0, lastAt: now };
  r.attempts++;
  r.lastAt = now;
  r.recent = [...r.recent, stars].slice(-8);
  r.best = Math.max(r.best, stars);
  if (stars >= PASS_STARS) {
    r.passes++;
    if (stars === 3 && (r.bestMs === undefined || ms < r.bestMs)) r.bestMs = ms;
    const learning = r.box < MASTERED_BOX;
    if (learning || r.due <= now) {
      r.box = Math.min(MAX_BOX, r.box + 1);
      r.due = now + BOX_DAYS[r.box] * DAY;
    }
  } else {
    r.box = 0;
    r.due = now;
  }
  return r;
}

export type DrillStatus = 'new' | 'learning' | 'mastered' | 'due';

export function drillStatus(r: DrillRecord | undefined, now = Date.now()): DrillStatus {
  if (!r || r.attempts === 0) return 'new';
  if (r.box >= MASTERED_BOX) return r.due <= now ? 'due' : 'mastered';
  return r.due <= now || r.box === 0 ? 'due' : 'learning';
}

/** Share of the way to mastery, 0–1 (each box up to three counts a third). */
export function drillMastery(r: DrillRecord | undefined): number {
  return r ? Math.min(r.box, MASTERED_BOX) / MASTERED_BOX : 0;
}

export function sectionMastery(section: Section, p: EndgameProgress): number {
  if (!section.drills.length) return 0;
  return section.drills.reduce((s, d) => s + drillMastery(p.drills[d.id]), 0) / section.drills.length;
}

export function recordPuzzle(prev: PuzzleRecord | undefined, solved: boolean, now = Date.now()): PuzzleRecord {
  const r: PuzzleRecord = prev ? { ...prev } : { results: [], total: 0, solved: 0, lastAt: now };
  r.results = [...r.results, solved].slice(-40);
  r.total++;
  if (solved) r.solved++;
  r.lastAt = now;
  return r;
}

export interface TestScore {
  /** First-try solves among the last `size` puzzles. */
  solved: number;
  played: number;
  size: number;
  /** Needed to pass. */
  need: number;
  passed: boolean;
}

export function testScore(test: PuzzleTest, r: PuzzleRecord | undefined): TestScore {
  const last = (r?.results ?? []).slice(-test.size);
  const solved = last.filter(Boolean).length;
  const need = Math.ceil(test.size * PUZZLE_PASS);
  return { solved, played: last.length, size: test.size, need, passed: last.length >= test.size && solved >= need };
}

export interface Summary {
  total: number;
  mastered: number;
  learning: number;
  fresh: number;
  due: number;
  /** 0–1 over all drills. */
  mastery: number;
  testsPassed: number;
  tests: number;
}

export function summary(p: EndgameProgress, now = Date.now()): Summary {
  let mastered = 0;
  let learning = 0;
  let fresh = 0;
  let due = 0;
  let mastery = 0;
  for (const d of ALL_DRILLS) {
    const r = p.drills[d.id];
    const st = drillStatus(r, now);
    if (st === 'new') fresh++;
    else if (st === 'due') due++;
    if (r && r.box >= MASTERED_BOX) mastered++;
    else if (r && r.attempts > 0) learning++;
    mastery += drillMastery(r);
  }
  const testsPassed = ALL_TESTS.filter((t) => testScore(t, p.puzzles[t.theme]).passed).length;
  return { total: ALL_DRILLS.length, mastered, learning, fresh, due, mastery: mastery / ALL_DRILLS.length, testsPassed, tests: ALL_TESTS.length };
}

/** Drills to review now, the longest overdue first. */
export function dueDrills(p: EndgameProgress, now = Date.now()): Drill[] {
  return ALL_DRILLS.filter((d) => drillStatus(p.drills[d.id], now) === 'due').sort(
    (a, b) => (p.drills[a.id]?.due ?? 0) - (p.drills[b.id]?.due ?? 0),
  );
}

/** The next section on the path: the first one (in order, easiest level first) that is not mastered. */
export function nextSection(p: EndgameProgress): Section | null {
  for (const level of [1, 2, 3] as const) {
    for (const stage of STAGES) {
      for (const s of stage.sections) {
        if (s.level === level && sectionMastery(s, p) < 1) return s;
      }
    }
  }
  return null;
}

/** A session for a section: what is not mastered yet first, in the section's order. */
export function sectionQueue(section: Section, p: EndgameProgress): Drill[] {
  const open = section.drills.filter((d) => (p.drills[d.id]?.box ?? 0) < MASTERED_BOX);
  return open.length ? open : section.drills;
}

export interface WeakSpot {
  drill: Drill;
  section: Section;
  /** Misses among the last attempts. */
  misses: number;
}

/** Drills that went wrong lately, the most misses first. */
export function weakSpots(p: EndgameProgress, limit = 6): WeakSpot[] {
  const out: WeakSpot[] = [];
  for (const section of ALL_SECTIONS) {
    for (const drill of section.drills) {
      const r = p.drills[drill.id];
      if (!r) continue;
      const misses = r.recent.slice(-4).filter((s) => s < PASS_STARS).length;
      if (misses > 0 && r.box < MASTERED_BOX) out.push({ drill, section, misses });
    }
  }
  return out.sort((a, b) => b.misses - a.misses).slice(0, limit);
}

/** Puzzle tests that are started but not passed, the weakest first. */
export function weakTests(p: EndgameProgress): { test: PuzzleTest; score: TestScore }[] {
  return ALL_TESTS.map((test) => ({ test, score: testScore(test, p.puzzles[test.theme]) }))
    .filter(({ score }) => score.played > 0 && !score.passed)
    .sort((a, b) => a.score.solved / a.score.played - b.score.solved / b.score.played);
}

export function formatDue(due: number, now = Date.now()): string {
  const d = Math.round((due - now) / DAY);
  if (due <= now) return 'due now';
  if (d <= 0) return 'later today';
  if (d === 1) return 'tomorrow';
  return `in ${d} days`;
}

export function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
