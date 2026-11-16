import { describe, expect, it } from 'vitest';
import { newRepertoire, setPaused, setStudy, type Repertoire } from './repertoire';
import { newCard, State } from './srs';
import { EMPTY_DATA, type AppData } from './store';
import { forStudioScope, studioSummary } from './studioDashboard';
import { legacyPlan, mergeLegacyData, validLegacyData, type LegacySnapshot } from './legacyImport';

const profile = { id: 'old-player', name: 'Original player', color: '#aabbcc', ratings: [1500], speeds: ['rapid'] };
const card = () => ({ ...newCard(), reps: 5, state: State.Review, due: 1750000000000, last_review: 1740000000000, stability: 21 });
const repertoire = (id: string, name: string, study = false, paused = false): Repertoire => {
  const rep = newRepertoire(profile.id, name, 'black');
  return { ...rep, id, cards: { 'position|d7d5': card(), 'position|c7c6': newCard() }, study, paused };
};
const original = () => ({
  data: {
    ...EMPTY_DATA, profiles: [profile],
    repertoires: [
      repertoire('slav', 'Slav', false, false),
      repertoire('dragon', 'Dragon study', true, true),
    ],
    activeProfileId: profile.id, activeRepId: 'slav',
  },
  games: null,
}) as LegacySnapshot;

describe('read-only original-app migration', () => {
  it('recognizes genuine v1 shape without trusting arbitrary JSON', () => {
    expect(validLegacyData(original().data)).toBe(true);
    expect(validLegacyData({ version: 1, profiles: [], repertoires: [{ name: 'bad' }] })).toBe(false);
    expect(validLegacyData({ version: 2, profiles: [], repertoires: [] })).toBe(false);
  });

  it('previews full SRS progress and imports missing roles while preserving review dates', () => {
    const legacy = original();
    const plan = legacyPlan(EMPTY_DATA, [], legacy);
    expect(plan).toMatchObject({ newProfiles: 1, newRepertoires: 2, existingRepertoires: 0, newCards: 4, previouslyReviewed: 2 });
    const merged = mergeLegacyData(EMPTY_DATA, legacy, false, 2000000000000);
    expect(merged.profiles).toHaveLength(1);
    expect(merged.repertoires).toHaveLength(2);
    expect(merged.repertoires[0].cards['position|d7d5'].last_review).toBe(1740000000000);
    expect(merged.repertoires[0].cards['position|d7d5'].stability).toBe(21);
    expect(merged.repertoires[1].study).toBe(true);
    expect(merged.repertoires[1].paused).toBe(true);
    expect(merged.activeProfileId).toBe('old-player');
  });

  it('never replaces an existing v2 repertoire even when v1 SRS differs', () => {
    const old = original();
    const existing = repertoire('slav', 'My changed Slav', false, false);
    existing.cards['position|d7d5'] = { ...card(), reps: 99 };
    const current: AppData = { ...EMPTY_DATA, profiles: [profile], repertoires: [existing], activeProfileId: profile.id, activeRepId: existing.id };
    const merged = mergeLegacyData(current, old, false);
    expect(merged.repertoires).toHaveLength(2);
    expect(merged.repertoires.find((r) => r.id === 'slav')!.cards['position|d7d5'].reps).toBe(99);
    expect(legacyPlan(current, [], old).existingRepertoires).toBe(1);
    expect(old.data.repertoires[0].cards['position|d7d5'].reps).toBe(5);
  });
});

describe('two-axis repertoire purpose and training stats', () => {
  const play = repertoire('slav', 'Slav', false, false);
  const pausedPlay = setPaused(repertoire('caro', 'Caro-Kann'), true);
  const study = setStudy(repertoire('endgame', 'Study only'), true);
  const pausedStudy = setPaused(setStudy(repertoire('french', 'French study'), true), true);
  const all = [play, pausedPlay, study, pausedStudy];

  it('SRS pause is independent of game-use role', () => {
    expect(forStudioScope(all, 'training').map((r) => r.id)).toEqual(['slav', 'endgame']);
    expect(forStudioScope(all, 'play').map((r) => r.id)).toEqual(['slav', 'caro']);
    expect(forStudioScope(all, 'study').map((r) => r.id)).toEqual(['endgame', 'french']);
    expect(forStudioScope(all, 'all')).toHaveLength(4);
  });

  it('calculates overall percentage weighted by SRS moves, never average percentages', () => {
    const tiny = { ...play, cards: { a: card() } };
    const big = { ...study, cards: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i), newCard()])) };
    const result = studioSummary([tiny, big], 0);
    expect(result.learned).toBe(1);
    expect(result.total).toBe(10);
    expect(result.progress).toBe(10);
  });
});
