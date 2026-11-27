// Lichess puzzles for the tactics and calculation training: fetched in batches by theme near a target rating, kept in
// the browser (IndexedDB) so a set works offline once made. The player's data only keeps the puzzle ids; another
// device fetches the puzzles again by id.

import { createStore, getMany, setMany } from 'idb-keyval';
import { lineFromSans, START_KEY, type PlayedMove } from '../chess';

export interface TPuzzle {
  id: string;
  rating: number;
  themes: string[];
  /** UCI: your move, the reply, your move, … */
  solution: string[];
  /** The game's moves (SAN) up to the puzzle: the last one is the opponent's move you answer. */
  sans: string[];
}

interface ApiEntry {
  puzzle: { id: string; rating: number; themes: string[]; solution: string[]; initialPly: number };
  game: { pgn: string };
}

const store = typeof indexedDB !== 'undefined' ? createStore('repertoire2-puzzles', 'puzzles') : undefined;
const memory = new Map<string, TPuzzle>();

function fromApi(e: ApiEntry): TPuzzle | null {
  const sans = e.game?.pgn?.trim().split(/\s+/) ?? [];
  if (!e.puzzle?.id || !e.puzzle.solution?.length || !sans.length) return null;
  return { id: e.puzzle.id, rating: e.puzzle.rating, themes: e.puzzle.themes ?? [], solution: e.puzzle.solution, sans };
}

/** The difficulty Lichess serves (to anonymous users) around these ratings. */
const BANDS: [string, number][] = [
  ['easiest', 850],
  ['easier', 1100],
  ['normal', 1350],
  ['harder', 1750],
  ['hardest', 2100],
];

export function difficultyFor(rating: number): string {
  return BANDS.reduce((best, b) => (Math.abs(b[1] - rating) < Math.abs(best[1] - rating) ? b : best))[0];
}

export class LichessError extends Error {}

async function getJson(url: string, attempt = 0): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new LichessError('Lichess could not be reached. New puzzles need a connection.');
  }
  if (res.status === 429) {
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 60_000));
      return getJson(url, attempt + 1);
    }
    throw new LichessError('Lichess asks to slow down. Try again in a minute.');
  }
  if (!res.ok) throw new LichessError(`Lichess answered ${res.status}.`);
  return res.json();
}

export async function fetchBatch(theme: string, rating: number, nb = 50): Promise<TPuzzle[]> {
  const url = `https://lichess.org/api/puzzle/batch/${encodeURIComponent(theme)}?nb=${nb}&difficulty=${difficultyFor(rating)}`;
  const json = (await getJson(url)) as { puzzles?: ApiEntry[] };
  return (json.puzzles ?? []).map(fromApi).filter((p): p is TPuzzle => !!p);
}

export interface PickOptions {
  theme: string;
  rating: number;
  count: number;
  /** Ids to leave out (already in a set). */
  exclude?: Set<string>;
  /** Extra condition, e.g. "combines two motifs". */
  accept?: (p: TPuzzle) => boolean;
  /** Ratings this far from the target are taken first. */
  spread?: number;
}

/** `count` puzzles of a theme, as close to `rating` as Lichess gives them. Stores them for later. */
export async function pickPuzzles(o: PickOptions): Promise<TPuzzle[]> {
  const spread = o.spread ?? 200;
  const seen = new Set(o.exclude ?? []);
  const pool: TPuzzle[] = [];
  for (let round = 0; round < 4 && pool.filter((p) => Math.abs(p.rating - o.rating) <= spread).length < o.count; round++) {
    const batch = await fetchBatch(o.theme, o.rating);
    for (const p of batch) {
      if (seen.has(p.id) || (o.accept && !o.accept(p))) continue;
      seen.add(p.id);
      pool.push(p);
    }
    if (!batch.length) break;
  }
  const chosen = pool.sort((a, b) => Math.abs(a.rating - o.rating) - Math.abs(b.rating - o.rating)).slice(0, o.count);
  await savePuzzles(chosen);
  return chosen;
}

export async function savePuzzles(ps: TPuzzle[]): Promise<void> {
  for (const p of ps) memory.set(p.id, p);
  if (!store || !ps.length) return;
  try {
    await setMany(
      ps.map((p) => [p.id, p]),
      store,
    );
  } catch {
    /* memory only */
  }
}

/** Puzzles by id: from memory, the browser, or Lichess (one request each, for a set made on another device). */
export async function loadPuzzles(ids: string[]): Promise<Map<string, TPuzzle>> {
  const out = new Map<string, TPuzzle>();
  const missing = ids.filter((id) => {
    const hit = memory.get(id);
    if (hit) out.set(id, hit);
    return !hit;
  });
  if (missing.length && store) {
    try {
      const found = (await getMany(missing, store)) as (TPuzzle | undefined)[];
      found.forEach((p) => p && (memory.set(p.id, p), out.set(p.id, p)));
    } catch {
      /* ignore */
    }
  }
  const stillMissing = ids.filter((id) => !out.has(id));
  const fetched: TPuzzle[] = [];
  for (const id of stillMissing) {
    const json = (await getJson(`https://lichess.org/api/puzzle/${encodeURIComponent(id)}`)) as ApiEntry;
    const p = fromApi(json);
    if (p) {
      fetched.push(p);
      out.set(id, p);
    }
  }
  await savePuzzles(fetched);
  return out;
}

/** The game's moves as played moves (with positions), so a puzzle can start a few moves earlier (ghost moves). */
export function gameLine(p: TPuzzle): PlayedMove[] | null {
  return lineFromSans(p.sans, START_KEY);
}

export function lichessPuzzleUrl(id: string): string {
  return `https://lichess.org/training/${id}`;
}
