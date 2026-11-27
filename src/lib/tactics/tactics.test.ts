import { describe, expect, it } from 'vitest';
import { MODULES, PHASES } from './curriculum';
import {
  addMisses,
  advanceWood,
  applyRatings,
  climb,
  cycleOrder,
  dueReviews,
  interleave,
  ladderPush,
  moduleCollection,
  moduleStep,
  newProgress,
  newWood,
  nextModule,
  phaseResult,
  rate,
  reviewResult,
  woodMastered,
  woodTarget,
  type ModuleState,
} from './progress';

describe('rating', () => {
  it('moves up on a solve, down on a miss, more against a stronger puzzle', () => {
    expect(rate(1500, 0, 1500, true)).toBe(1520);
    expect(rate(1500, 0, 1500, false)).toBe(1480);
    expect(rate(1500, 100, 1900, true) - 1500).toBeGreaterThan(rate(1500, 100, 1500, true) - 1500);
  });
  it('takes smaller steps once settled', () => {
    expect(rate(1500, 100, 1500, true)).toBe(1508);
  });
  it('keeps a history', () => {
    const p = applyRatings(newProgress(1750), [
      { rating: 1700, solved: true },
      { rating: 1800, solved: false },
    ]);
    expect(p.rated).toBe(2);
    expect(p.history.length).toBe(2);
    expect(p.history[1]).toBe(p.rating);
  });
});

describe('the path', () => {
  const mod = MODULES[0];
  const passed = (ids: string[]) => phaseResult(undefined, ids, 1, 0.5);

  it('starts with the first motif of the first module', () => {
    const p = newProgress(1500);
    expect(nextModule(p)?.id).toBe('foundations');
    expect(moduleStep(mod, undefined)).toEqual({ phase: 'learn', motif: mod.motifs[0] });
  });

  it('goes learn → mix → combine → woodpecker → done', () => {
    const st: ModuleState = { learn: {} };
    for (const m of mod.motifs) st.learn[m.theme] = passed([`${m.theme}-1`]);
    expect(moduleStep(mod, st).phase).toBe('mix');
    st.mix = passed(['mix-1']);
    expect(moduleStep(mod, st).phase).toBe('combine');
    st.combine = passed(['c-1']);
    expect(moduleStep(mod, st).phase).toBe('woodpecker');
    expect(moduleCollection(mod, st)).toHaveLength(mod.motifs.length + 2);
    st.wood = { ...newWood(), done: [1, 2, 3].map(() => ({ correct: 9, total: 10, ms: 1000 })) };
    expect(woodMastered(st.wood)).toBe(true);
    expect(moduleStep(mod, st).phase).toBe('done');
  });

  it('needs the pass mark: a failed run stays open', () => {
    const r = phaseResult(undefined, ['a'], 5 / 8, PHASES.learn.pass / PHASES.learn.size);
    expect(r.passed).toBe(false);
    const again = phaseResult(r, ['a'], 7 / 8, PHASES.learn.pass / PHASES.learn.size);
    expect(again).toMatchObject({ passed: true, runs: 2, best: 7 / 8 });
  });
});

describe('woodpecker', () => {
  it('closes a cycle and sets a faster target', () => {
    let w = newWood();
    w = advanceWood(w, 3, [{ solved: true, ms: 10_000 }, { solved: false, ms: 20_000 }]);
    expect(w).toMatchObject({ cycle: 1, pos: 2, correct: 1 });
    w = advanceWood(w, 3, [{ solved: true, ms: 10_000 }]);
    expect(w.cycle).toBe(2);
    expect(w.pos).toBe(0);
    expect(w.done[0]).toEqual({ correct: 2, total: 3, ms: 40_000 });
    expect(woodTarget(w)).toBe(24_000);
  });
  it('shuffles each cycle differently but keeps the same puzzles', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `p${i}`);
    const a = cycleOrder(ids, 1);
    const b = cycleOrder(ids, 2);
    expect([...a].sort()).toEqual([...ids].sort());
    expect(a).not.toEqual(b);
    expect(cycleOrder(ids, 1)).toEqual(a);
  });
});

describe('reviews', () => {
  const DAY = 86_400_000;
  it('brings a miss back after a night, then spaced out, then retires it', () => {
    let r = addMisses({}, ['x'], 0);
    expect(dueReviews({ ...newProgress(1500), reviews: r }, 1000)).toEqual([]);
    expect(dueReviews({ ...newProgress(1500), reviews: r }, DAY)).toEqual(['x']);
    r = reviewResult(r, 'x', true, DAY);
    expect(r.x.box).toBe(1);
    r = reviewResult(r, 'x', true, 2 * DAY);
    r = reviewResult(r, 'x', true, 5 * DAY);
    r = reviewResult(r, 'x', true, 12 * DAY);
    r = reviewResult(r, 'x', true, 26 * DAY);
    expect(r.x).toBeUndefined();
  });
  it('starts over after a miss', () => {
    let r = addMisses({}, ['x'], 0);
    r = reviewResult(r, 'x', true, DAY);
    r = reviewResult(r, 'x', false, 2 * DAY);
    expect(r.x.box).toBe(0);
  });
});

describe('ladders and mixing', () => {
  it('climbs at 8 of the last 10', () => {
    let res: boolean[] = [];
    for (let i = 0; i < 7; i++) res = ladderPush(res, true);
    res = ladderPush(res, false);
    expect(climb(0, 0, res, 3)).toBe(0);
    res = ladderPush(res, true); // 9 played: not enough yet
    expect(climb(0, 0, res, 3)).toBe(0);
    res = ladderPush(res, false); // 8 of 10
    expect(climb(0, 0, res, 3)).toBe(1);
    expect(climb(1, 0, res, 3)).toBe(1);
  });
  it('interleaves without two neighbours from the same group where possible', () => {
    const out = interleave([['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], ['c1', 'c2']], () => 0.3);
    expect(out).toHaveLength(8);
    for (let i = 1; i < out.length; i++) expect(out[i][0]).not.toBe(out[i - 1][0]);
  });
});
