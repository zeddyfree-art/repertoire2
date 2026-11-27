import { describe, expect, it } from 'vitest';
import { posFromFen } from '../chess';
import { ALL_DRILLS, ALL_SECTIONS, ALL_TESTS, STAGES } from './curriculum';
import {
  dueDrills,
  efficient,
  EMPTY_PROGRESS,
  MASTERED_BOX,
  nextSection,
  recordAttempt,
  recordPuzzle,
  sectionMastery,
  starsFor,
  summary,
  testScore,
  weakSpots,
  type Attempt,
  type EndgameProgress,
} from './progress';
import { randomMatePosition } from './random';
import { assess, pieceCount } from './tablebase';

const clean: Attempt = { mistakes: 0, hints: 0, wrongVerdict: false, gaveUp: false, solved: true, ms: 20_000, moves: 10, optimal: 9 };

describe('curriculum', () => {
  it('has unique ids', () => {
    const ids = [...ALL_DRILLS.map((d) => d.id), ...ALL_SECTIONS.map((s) => s.id), ...STAGES.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ALL_TESTS.map((t) => t.theme)).size).toBe(ALL_TESTS.length);
  });

  it('has a legal, unfinished position for every fixed drill', () => {
    for (const d of ALL_DRILLS) {
      expect(!!d.fen !== !!d.random, d.id).toBe(true);
      if (!d.fen) continue;
      const pos = posFromFen(d.fen);
      expect(pos.isEnd(), d.id).toBe(false);
    }
  });

  it('gives every draw drill a length, and every verdict drill a matching goal', () => {
    for (const d of ALL_DRILLS) {
      if (d.verdict === 'draw') expect(d.goal).toBe('draw');
      if (d.verdict === 'win') expect(d.goal).not.toBe('draw');
      if (d.goal !== 'draw') expect(d.hold).toBeUndefined();
    }
  });
});

describe('random positions', () => {
  it('are legal, White to move, with the right material', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const setup of ['KQvK', 'KRvK', 'KRRvK', 'KQRvK', 'KBBvK'] as const) {
      for (let i = 0; i < 40; i++) {
        const fen = randomMatePosition(setup, rand);
        const pos = posFromFen(fen);
        expect(pos.turn).toBe('white');
        expect(pos.isEnd()).toBe(false);
        expect(pos.board.black.size()).toBe(1);
        expect(pos.board.white.size()).toBe(setup.length - 2);
        if (setup === 'KBBvK') {
          const bishops = [...pos.board.bishop].map((sq) => ((sq >> 3) + (sq & 7)) % 2);
          expect(bishops[0]).not.toBe(bishops[1]);
        }
      }
    }
  });
});

describe('stars', () => {
  it('rewards a clean, quick solve with three', () => {
    expect(starsFor(clean, {})).toBe(3);
    expect(starsFor(clean, { targetSec: 30 })).toBe(3);
  });
  it('gives two for a hint, a slow clock or a long mate', () => {
    expect(starsFor({ ...clean, hints: 1 }, {})).toBe(2);
    expect(starsFor({ ...clean, ms: 61_000 }, { targetSec: 60 })).toBe(2);
    expect(starsFor({ ...clean, moves: 20, optimal: 9 }, {})).toBe(2);
  });
  it('gives one after a mistake or a wrong call, none when not solved', () => {
    expect(starsFor({ ...clean, mistakes: 1 }, {})).toBe(1);
    expect(starsFor({ ...clean, wrongVerdict: true }, {})).toBe(1);
    expect(starsFor({ ...clean, solved: false }, {})).toBe(0);
    expect(starsFor({ ...clean, gaveUp: true }, {})).toBe(0);
  });
  it('allows a few spare moves', () => {
    expect(efficient({ moves: 11, optimal: 9 })).toBe(true);
    expect(efficient({ moves: 12, optimal: 9 })).toBe(false);
    expect(efficient({ moves: 20, optimal: 16 })).toBe(true);
    expect(efficient({ moves: 30, optimal: undefined })).toBe(true);
  });
});

describe('boxes', () => {
  const DAY = 86_400_000;
  it('masters a drill after three passes in a row, also on one day', () => {
    let r = recordAttempt(undefined, 3, 1000, 0);
    r = recordAttempt(r, 2, 1000, 10);
    r = recordAttempt(r, 3, 1000, 20);
    expect(r.box).toBe(MASTERED_BOX);
    expect(r.due).toBe(20 + 7 * DAY);
    expect(r.bestMs).toBe(1000);
  });
  it('does not move a mastered drill up when practised early', () => {
    let r = recordAttempt(undefined, 3, 1000, 0);
    r = recordAttempt(r, 3, 1000, 0);
    r = recordAttempt(r, 3, 1000, 0);
    const early = recordAttempt(r, 3, 1000, DAY);
    expect(early.box).toBe(MASTERED_BOX);
    const onTime = recordAttempt(r, 3, 1000, 8 * DAY);
    expect(onTime.box).toBe(MASTERED_BOX + 1);
  });
  it('sends a miss back to the start, due now', () => {
    let r = recordAttempt(undefined, 3, 1000, 0);
    r = recordAttempt(r, 3, 1000, 0);
    r = recordAttempt(r, 1, 1000, 5);
    expect(r.box).toBe(0);
    expect(r.due).toBe(5);
  });
});

describe('overview', () => {
  it('starts with the first L1 section and nothing due', () => {
    expect(nextSection(EMPTY_PROGRESS)?.id).toBe('queen-mate');
    expect(dueDrills(EMPTY_PROGRESS)).toEqual([]);
    const s = summary(EMPTY_PROGRESS);
    expect(s.fresh).toBe(ALL_DRILLS.length);
    expect(s.mastery).toBe(0);
  });

  it('moves on once a section is mastered, all of L1 before L2', () => {
    const p: EndgameProgress = { drills: {}, puzzles: {} };
    for (const s of ALL_SECTIONS.filter((x) => x.level === 1)) {
      for (const d of s.drills) p.drills[d.id] = { box: 3, due: Date.now() + 1e9, attempts: 3, passes: 3, recent: [3, 3, 3], best: 3, lastAt: 0 };
      expect(sectionMastery(s, p)).toBe(1);
    }
    expect(nextSection(p)?.level).toBe(2);
  });

  it('lists missed drills as weak spots and due', () => {
    const p: EndgameProgress = { drills: { 'kr-centre': recordAttempt(undefined, 0, 0, 0) }, puzzles: {} };
    expect(weakSpots(p).map((w) => w.drill.id)).toEqual(['kr-centre']);
    expect(dueDrills(p).map((d) => d.id)).toEqual(['kr-centre']);
  });

  it('passes a puzzle test on 80% of the last puzzles', () => {
    const test = ALL_TESTS.find((t) => t.size === 20)!;
    let r = recordPuzzle(undefined, true);
    for (let i = 0; i < 15; i++) r = recordPuzzle(r, true);
    for (let i = 0; i < 4; i++) r = recordPuzzle(r, false);
    expect(testScore(test, r)).toMatchObject({ played: 20, solved: 16, need: 16, passed: true });
    r = recordPuzzle(r, false);
    expect(testScore(test, r).passed).toBe(false);
  });
});

// Checks every fixed position against the Lichess tablebase: the side you play reaches the goal with best play.
// Needs the network: EG_TABLEBASE=1 npx vitest run src/lib/endgames
describe.skipIf(!process.env.EG_TABLEBASE)('positions against the tablebase', () => {
  // More than seven pieces (the breakthrough) was checked against Stockfish by hand.
  for (const d of ALL_DRILLS.filter((x) => x.fen && pieceCount(x.fen) <= 7)) {
    it(d.id, async () => {
      const a = await assess(d.fen!);
      expect(a.source).toBe('tablebase');
      const toMove = d.fen!.split(' ')[1] === 'w' ? 'white' : 'black';
      const mine = toMove === d.side ? a.outcome : a.outcome === 'win' ? 'loss' : a.outcome === 'loss' ? 'win' : 'draw';
      expect(mine).toBe(d.goal === 'draw' ? 'draw' : 'win');
    }, 20_000);
  }
});
