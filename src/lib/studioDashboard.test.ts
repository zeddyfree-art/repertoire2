import { describe, expect, it } from 'vitest';
import { lineFromSans } from './chess';
import { addLine, newRepertoire } from './repertoire';
import { newCard } from './srs';
import { mainlinePreview, recentlyPracticed, studioSummary } from './studioDashboard';

describe('Warm Studio dashboard real data', () => {
  it('previews only the actual moves of the selected repertoire', () => {
    const empty = newRepertoire('player', 'Scotch', 'white');
    expect(mainlinePreview(empty).length).toBe(1);
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'd4'];
    const line = lineFromSans(sans);
    expect(line).not.toBeNull();
    const rep = addLine(empty, line!);
    expect(mainlinePreview(rep).slice(1).map((f) => f.san)).toEqual(sans);
    expect(mainlinePreview(rep, 2).length).toBe(3);
  });

  it('does not fabricate progress when no cards exist', () => {
    const rep = newRepertoire('player', 'Slav', 'black');
    const summary = studioSummary([rep], 0);
    expect(summary.progress).toBeNull();
    expect(summary.total).toBe(0);
    expect(summary.learned).toBe(0);
    expect(summary.lines).toBe(0);
    expect(summary.today).toBe(0);
  });

  it('counts real learned positions and latest reviews', () => {
    const rep = newRepertoire('player', 'Dragon', 'black');
    const now = new Date(2026, 10, 16, 12);
    rep.cards['position|move'] = {
      ...newCard(now.getTime()), state: 2, last_review: now.getTime() - 1000,
    };
    const summary = studioSummary([rep], 3);
    expect(summary.learned).toBe(1);
    expect(summary.total).toBe(1);
    expect(summary.progress).toBe(100);
    expect(summary.today).toBe(3);
    const weekly = recentlyPracticed([rep], now);
    expect(weekly).toHaveLength(7);
    expect(weekly.at(-1)?.count).toBe(1);
  });
});
