// Random positions for the basic mates, so you practise the method rather than one position.

import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import type { RandomSetup } from './curriculum';

const PIECES: Record<RandomSetup, string[]> = {
  KQvK: ['Q'],
  KRvK: ['R'],
  KRRvK: ['R', 'R'],
  KQRvK: ['Q', 'R'],
  KBBvK: ['B', 'B'],
};

const isDark = (i: number) => (Math.floor(i / 8) + (i % 8)) % 2 === 0;

/** A legal position, White to move, with the white pieces of `setup` against a bare black king. Not checked for how
 *  long the mate takes: the caller can ask the tablebase and draw again. */
export function randomMatePosition(setup: RandomSetup, rand: () => number = Math.random): string {
  for (let tries = 0; tries < 500; tries++) {
    const taken = new Set<number>();
    const pick = () => {
      let sq: number;
      do sq = Math.floor(rand() * 64);
      while (taken.has(sq));
      taken.add(sq);
      return sq;
    };
    const wk = pick();
    const bk = pick();
    const placed: [number, string][] = [
      [wk, 'K'],
      [bk, 'k'],
    ];
    for (const p of PIECES[setup]) placed.push([pick(), p]);
    // Two bishops on the same colour cannot mate.
    if (setup === 'KBBvK') {
      const [a, b] = placed.slice(2).map(([sq]) => isDark(sq));
      if (a === b) continue;
    }
    // Kings apart. A black king on the edge is already half beaten: keep only half of those.
    if (Math.abs((wk % 8) - (bk % 8)) <= 1 && Math.abs(Math.floor(wk / 8) - Math.floor(bk / 8)) <= 1) continue;
    const edge = (sq: number) => sq % 8 === 0 || sq % 8 === 7 || sq < 8 || sq >= 56;
    if (edge(bk) && rand() < 0.5) continue;
    const fen = toFen(placed);
    const setupRes = parseFen(fen);
    if (setupRes.isErr) continue;
    const pos = Chess.fromSetup(setupRes.unwrap());
    if (pos.isErr) continue; // e.g. Black in check with White to move
    const chess = pos.unwrap();
    if (chess.isEnd()) continue;
    // A piece Black can take at once is no basic mate any more.
    const black = chess.clone();
    black.turn = 'black';
    if (hangs(black, placed.slice(2).map(([sq]) => sq))) continue;
    return makeFen(chess.toSetup());
  }
  return setup === 'KBBvK' ? '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1' : '8/8/8/4k3/8/8/8/R3K3 w - - 0 1';
}

function hangs(pos: Chess, squares: number[]): boolean {
  const dests = pos.allDests();
  for (const [, to] of dests) for (const sq of squares) if (to.has(sq)) return true;
  return false;
}

function toFen(placed: [number, string][]): string {
  const board: (string | null)[] = Array(64).fill(null);
  for (const [sq, p] of placed) board[sq] = p;
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const p = board[rank * 8 + file];
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} w - - 0 1`;
}
