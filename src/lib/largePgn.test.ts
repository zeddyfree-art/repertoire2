import { describe, expect, it } from 'vitest';
import { exportPgn, importGames, importPgn, parseGames, replaceWithGames } from './pgn';
import { newRepertoire } from './repertoire';
import { largePgnFixture } from './largePgnFixture';

describe('large annotated PGN reliability (synthetic, no private course text)', () => {
  it('parses 185 chapters with many long comments; imports, reimports, exports and replaces without losing moves', () => {
    const text = largePgnFixture();
    expect(text.length).toBeGreaterThan(650_000);
    const games = parseGames(text);
    expect(games).toHaveLength(185);
    const blank = newRepertoire('stress-user', 'Synthetic Caro-Kann', 'black');
    const first = importGames(blank, games);
    expect(first.games).toBe(185);
    expect(first.errors).toEqual([]);
    expect(first.added).toBeGreaterThan(15);
    expect(first.comments).toBeGreaterThan(15);
    const repeated = importGames(first.rep, games);
    expect(repeated.added).toBe(0);
    expect(repeated.rep).toBe(first.rep);
    const exported = exportPgn(first.rep);
    const roundtrip = importPgn(blank, exported);
    expect(roundtrip.errors).toEqual([]);
    expect(roundtrip.found).toBe(first.found);
    const allMoves = (rep: typeof first.rep) =>
      Object.entries(rep.positions).flatMap(([position, edges]) =>
        edges.map((edge) => position + '|' + edge.uci)).sort();
    expect(allMoves(roundtrip.rep)).toEqual(allMoves(first.rep));
    const replaced = replaceWithGames(first.rep, games);
    expect(replaced.errors).toEqual([]);
    expect(allMoves(replaced.rep)).toEqual(allMoves(first.rep));
    expect(replaced.removed).toBe(0);
  }, 90_000);

  it('reports an explicit pass-move warning rather than silently pretending the continuation was imported', () => {
    const res = importPgn(newRepertoire('p', 'pass-test', 'black'), [
      '[Event "Setup"]', '[Result "*"]', '', '1. -- 1... c6 *',
      '', '[Event "Legal"]', '[Result "*"]', '', '1. e4 c6 *',
    ].join('\n'));
    expect(res.games).toBe(2);
    expect(res.errors.join(' ')).toMatch(/pass move/);
    expect(res.added).toBe(2);
  });
});
