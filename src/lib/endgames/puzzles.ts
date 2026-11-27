// Puzzles by theme from Lichess (no account needed): the start position, the move that led to it, and the solution.

import { keyToFen, lineFromSans, normalizeUci, posFromFen } from '../chess';

export interface Puzzle {
  id: string;
  rating: number;
  /** Position you solve from (you are to move). */
  fen: string;
  lastMove?: string;
  /** UCI moves: yours, the reply, yours, … */
  solution: string[];
  themes: string[];
}

export type PuzzleDifficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

export const DIFFICULTIES: { value: PuzzleDifficulty; label: string }[] = [
  { value: 'easiest', label: 'Easiest' },
  { value: 'easier', label: 'Easier' },
  { value: 'normal', label: 'Normal' },
  { value: 'harder', label: 'Harder' },
  { value: 'hardest', label: 'Hardest' },
];

interface ApiPuzzle {
  puzzle?: { id: string; rating: number; fen?: string; lastMove?: string; solution: string[]; themes: string[] };
}

/** Lichess themes are broad (mateIn1 is any mate in one). A filter narrows a theme down to one pattern. */
export type PuzzleFilter = 'supportedQueenMate';

const FILTERS: Record<PuzzleFilter, (p: Puzzle) => boolean> = {
  supportedQueenMate: (p) => isSupportedQueenMate(p.fen, p.solution[0]),
};

/** Mate given by the queen standing next to the king, protected by another piece. */
export function isSupportedQueenMate(fen: string, uci: string): boolean {
  const pos = posFromFen(fen);
  const move = normalizeUci(pos, uci);
  if (!move || !('from' in move) || pos.board.get(move.from)?.role !== 'queen') return false;
  const side = pos.turn;
  pos.play(move);
  if (!pos.isCheckmate()) return false;
  const king = pos.board.kingOf(pos.turn);
  if (king === undefined) return false;
  const q = move.to;
  const adjacent = Math.abs((q & 7) - (king & 7)) <= 1 && Math.abs((q >> 3) - (king >> 3)) <= 1;
  if (!adjacent) return false;
  return pos.kingAttackers(q, side, pos.board.occupied.without(q)).nonEmpty();
}

/** Filtered puzzles waiting to be served, per theme + difficulty + filter. */
const queues = new Map<string, Puzzle[]>();
const served = new Set<string>();

interface BatchEntry {
  puzzle: { id: string; rating: number; themes: string[]; solution: string[] };
  game: { pgn: string };
}

/** A batch of puzzles with their start positions worked out from the game. */
async function fetchBatch(theme: string, difficulty: PuzzleDifficulty, signal?: AbortSignal): Promise<Puzzle[]> {
  const res = await fetch(`https://lichess.org/api/puzzle/batch/${encodeURIComponent(theme)}?nb=50&difficulty=${difficulty}`, {
    signal,
    headers: { Accept: 'application/json' },
  }).catch(() => {
    throw new Error('Lichess could not be reached. Puzzles need a connection.');
  });
  if (res.status === 429) throw new Error('Lichess asks to slow down a little. Try again in a minute.');
  if (!res.ok) throw new Error(`Lichess answered ${res.status}.`);
  const json = (await res.json()) as { puzzles?: BatchEntry[] };
  const out: Puzzle[] = [];
  for (const e of json.puzzles ?? []) {
    const line = lineFromSans(e.game.pgn.trim().split(/\s+/));
    const last = line?.[line.length - 1];
    if (!last) continue;
    out.push({ id: e.puzzle.id, rating: e.puzzle.rating, fen: keyToFen(last.to), lastMove: last.uci, solution: e.puzzle.solution, themes: e.puzzle.themes });
  }
  return out;
}

export async function nextPuzzle(theme: string, difficulty: PuzzleDifficulty, signal?: AbortSignal, filter?: PuzzleFilter): Promise<Puzzle> {
  if (filter) {
    const key = `${theme}|${difficulty}|${filter}`;
    const queue = queues.get(key) ?? [];
    queues.set(key, queue);
    for (let round = 0; round < 3 && !queue.length; round++) {
      const batch = await fetchBatch(theme, difficulty, signal);
      for (const p of batch) if (!served.has(p.id) && FILTERS[filter](p)) queue.push(p);
      if (!batch.length) break;
    }
    const p = queue.shift();
    if (p) {
      served.add(p.id);
      return p;
    }
    // Nothing matched: fall back to the plain theme rather than stop the test.
  }
  const params = new URLSearchParams({ angle: theme, difficulty });
  const res = await fetch(`https://lichess.org/api/puzzle/next?${params}`, { signal, headers: { Accept: 'application/json' } }).catch(() => {
    throw new Error('Lichess could not be reached. Puzzles need a connection.');
  });
  if (res.status === 429) throw new Error('Lichess asks to slow down a little. Try again in a minute.');
  if (!res.ok) throw new Error(`Lichess answered ${res.status}.`);
  const json = (await res.json()) as ApiPuzzle;
  const p = json.puzzle;
  if (!p?.fen || !p.solution?.length) throw new Error('Lichess sent a puzzle this app cannot read.');
  return { id: p.id, rating: p.rating, fen: p.fen, lastMove: p.lastMove, solution: p.solution, themes: p.themes };
}

export function lichessPuzzleUrl(id: string): string {
  return `https://lichess.org/training/${id}`;
}

export function lichessThemeUrl(theme: string): string {
  return `https://lichess.org/training/${theme}`;
}
