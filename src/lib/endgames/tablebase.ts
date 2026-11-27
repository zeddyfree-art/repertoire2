// The Lichess tablebase (perfect play for up to 7 pieces) and, where it cannot help (more pieces, no network),
// Stockfish in the browser. Both answer the same question: with best play, does the side to move win, draw or lose?

import type { Chess } from 'chessops/chess';
import { makeFen } from 'chessops/fen';
import type { Move } from 'chessops/types';
import { normalizeUci, posFromFen } from '../chess';
import { engine } from '../engine';

const TABLEBASE = 'https://tablebase.lichess.ovh/standard';

export type Outcome = 'win' | 'draw' | 'loss';

export interface TbMove {
  uci: string;
  san: string;
  /** From the point of view of the side to move AFTER this move. */
  category: string;
  dtm?: number | null;
  dtz?: number | null;
  checkmate?: boolean;
  stalemate?: boolean;
}

export interface TbResult {
  category: string;
  dtm?: number | null;
  dtz?: number | null;
  checkmate?: boolean;
  stalemate?: boolean;
  insufficient_material?: boolean;
  moves: TbMove[];
}

export interface Assessment {
  /** For the side to move. */
  outcome: Outcome;
  /** Half-moves to mate with best play (tablebase only, for up to 5 pieces or so). */
  dtm?: number;
  /** Best move (UCI) for the side to move. */
  best?: string;
  source: 'tablebase' | 'engine';
  /** The tablebase's moves (best first), when it answered. */
  moves?: TbMove[];
  /** Engine score from the side to move's view, in centipawns (mate as ±100000). */
  score?: number;
}

export function pieceCount(fen: string): number {
  return fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
}

/** Tablebase category → win/draw/loss. "Cursed" wins and "blessed" losses are draws under the 50-move rule. */
export function toOutcome(category: string): Outcome | null {
  if (category === 'win' || category === 'maybe-win' || category === 'syzygy-win') return 'win';
  if (category === 'loss' || category === 'maybe-loss' || category === 'syzygy-loss') return 'loss';
  if (category === 'draw' || category === 'cursed-win' || category === 'blessed-loss') return 'draw';
  return null;
}

export const flip = (o: Outcome): Outcome => (o === 'win' ? 'loss' : o === 'loss' ? 'win' : 'draw');

const cache = new Map<string, Promise<TbResult | null>>();

/** The tablebase's answer for a position, or null (too many pieces, offline, or Lichess did not answer). */
export function probe(fen: string): Promise<TbResult | null> {
  if (pieceCount(fen) > 7) return Promise.resolve(null);
  const key = fen.split(' ').slice(0, 5).join(' ');
  let hit = cache.get(key);
  if (!hit) {
    hit = fetchTb(fen);
    cache.set(key, hit);
    // A failure is not remembered: try again next time.
    void hit.then((r) => r === null && cache.delete(key));
  }
  return hit;
}

async function fetchTb(fen: string, attempt = 0): Promise<TbResult | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${TABLEBASE}?fen=${encodeURIComponent(fen)}`, { signal: ctrl.signal });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return fetchTb(fen, attempt + 1);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as TbResult;
    return Array.isArray(json?.moves) && typeof json.category === 'string' ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** How a position stands for the side to move: tablebase first, Stockfish when it has no answer. */
export async function assess(fen: string, opts: { engineMs?: number } = {}): Promise<Assessment> {
  const tb = await probe(fen);
  const outcome = tb ? toOutcome(tb.category) : null;
  if (tb && outcome) {
    return {
      outcome,
      dtm: typeof tb.dtm === 'number' ? Math.abs(tb.dtm) : undefined,
      best: tb.moves[0]?.uci,
      source: 'tablebase',
      moves: tb.moves,
    };
  }
  return engineAssess(fen, opts.engineMs ?? 900);
}

/** Centipawns (side to move) from which a position counts as won when only the engine can tell. */
export const ENGINE_WIN = 250;

async function engineAssess(fen: string, ms: number): Promise<Assessment> {
  const pos = posFromFen(fen);
  if (pos.isEnd()) {
    const outcome: Outcome = pos.isCheckmate() ? 'loss' : 'draw';
    return { outcome, source: 'engine', score: outcome === 'loss' ? -100000 : 0 };
  }
  const lines = await engine.analyse(fen, { movetime: ms, depth: 24 });
  const line = lines[0];
  const white = fen.split(' ')[1] === 'w';
  let score = 0;
  if (line?.mate !== undefined) score = (line.mate > 0 ? 100000 : -100000) * (white ? 1 : -1);
  else if (line?.cp !== undefined) score = line.cp * (white ? 1 : -1);
  const outcome: Outcome = score >= ENGINE_WIN ? 'win' : score <= -ENGINE_WIN ? 'loss' : 'draw';
  return { outcome, best: line?.pv[0], source: 'engine', score };
}

/** The computer's move. Losing or winning: the tablebase's best (the longest defence, the fastest win). In a drawn
 *  position it picks, among the drawing moves, the one where most of your replies go wrong — it tries to trick you. */
export async function computerMove(fen: string, a?: Assessment): Promise<string | null> {
  const here = a ?? (await assess(fen));
  if (here.source === 'tablebase' && here.moves?.length) {
    if (here.outcome !== 'draw') return here.moves[0].uci;
    const draws = here.moves.filter((m) => toOutcome(m.category) === 'draw').slice(0, 5);
    if (draws.length <= 1) return (draws[0] ?? here.moves[0]).uci;
    let best = draws[0];
    let bestShare = -1;
    const after = await Promise.all(draws.map((m) => probe(afterFen(fen, m.uci))));
    draws.forEach((m, i) => {
      const r = after[i];
      if (!r || !r.moves.length) return;
      // Replies after which the computer wins: category is from the computer's view then.
      const bad = r.moves.filter((x) => toOutcome(x.category) === 'win').length;
      const share = bad / r.moves.length;
      if (share > bestShare) {
        bestShare = share;
        best = m;
      }
    });
    return best.uci;
  }
  return here.best ?? null;
}

/** The FEN after a UCI move (castling as the king's two-square step or onto the rook). */
export function afterFen(fen: string, uci: string): string {
  const pos = posFromFen(fen);
  const move = normalize(pos, uci);
  if (!move) return fen;
  pos.play(move);
  return makeFenFull(pos);
}


function normalize(pos: Chess, uci: string): Move | undefined {
  const m = normalizeUci(pos, uci);
  return m && pos.isLegal(m) ? m : undefined;
}

export function makeFenFull(pos: Chess): string {
  return makeFen(pos.toSetup());
}
