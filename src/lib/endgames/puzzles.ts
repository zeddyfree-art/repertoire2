// Puzzles by theme from Lichess (no account needed): the start position, the move that led to it, and the solution.

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

export async function nextPuzzle(theme: string, difficulty: PuzzleDifficulty, signal?: AbortSignal): Promise<Puzzle> {
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
