import { State } from './srs';
import { movesAt, ROOT, stats, type Repertoire } from './repertoire';

/** Only positions actually stored in the selected repertoire are shown on the home board. */
export function mainlinePreview(rep: Repertoire, maxPlies = 16) {
  const frames: { key: string; san?: string; uci?: string }[] = [{ key: ROOT }];
  const seen = new Set([ROOT]);
  let key = ROOT;
  for (let ply = 0; ply < maxPlies; ply++) {
    const move = movesAt(rep, key)[0];
    if (!move || seen.has(move.to)) break;
    frames.push({ key: move.to, san: move.san, uci: move.uci });
    key = move.to;
    seen.add(key);
  }
  return frames;
}

export type StudioScope = 'training' | 'play' | 'study' | 'all';

/** Two independent axes: role in games and whether SRS is paused. */
export function forStudioScope(reps: readonly Repertoire[], scope: StudioScope): Repertoire[] {
  if (scope === 'training') return reps.filter((r) => !r.paused);
  if (scope === 'play') return reps.filter((r) => !r.study);
  if (scope === 'study') return reps.filter((r) => !!r.study);
  return [...reps];
}

/** "Reviewed" means at least one completed SRS review, never "mastered".
 * Include all prepared moves, even beyond a temporary training-depth limit. */
export function studioSummary(reps: readonly Repertoire[], today: number) {
  const results = reps.map((rep) => {
    const cards = Object.values(rep.cards);
    return { rep, reviewed: cards.filter((c) => c.state !== State.New).length, total: cards.length, stats: stats(rep) };
  });
  const learned = results.reduce((sum, x) => sum + x.reviewed, 0);
  const total = results.reduce((sum, x) => sum + x.total, 0);
  const lines = results.reduce((sum, x) => sum + x.stats.lineEnds, 0);
  const moves = results.reduce((sum, x) => sum + x.stats.myMoves, 0);
  return {
    today,
    learned,
    total,
    lines,
    moves,
    progress: total ? Math.round((learned / total) * 100) : null,
    byRepertoire: results.map(({ rep, reviewed, total: count }) => ({
      id: rep.id, name: rep.name, learned: reviewed, total: count,
      role: rep.study ? 'Study' as const : 'In play' as const,
      paused: !!rep.paused,
      percent: count ? Math.round(reviewed / count * 100) : 0,
    })),
  };
}

/**
 * Count repertoire cards by their most recent review date. This is NOT a total
 * review-history chart (the model only stores the latest review per card).
 */
export function recentlyPracticed(reps: readonly Repertoire[], now = new Date()) {
  const dayKey = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
    return { key: dayKey(day), label: day.toLocaleDateString('en', { weekday: 'short' }), count: 0 };
  });
  const byDate = new Map(days.map((day) => [day.key, day]));
  for (const rep of reps) for (const card of Object.values(rep.cards)) {
    if (!card.last_review) continue;
    const day = byDate.get(dayKey(new Date(card.last_review)));
    if (day) day.count++;
  }
  return days;
}
