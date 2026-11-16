/**
 * Read-only bridge from the first Repertoire app.
 *
 * Both apps are hosted on the same github.io origin, so the old IndexedDB
 * database is accessible from Repertoire 2 on the SAME browser/profile.
 * Never create/upgrade/write/delete the old database: the upgrade is aborted
 * if it does not exist.
 */
import type { GamesData } from './games';
import { useGames, flushGames } from './gamesStore';
import type { AppData, Profile } from './store';
import { flushLocal, useApp, useSaveState } from './store';
import type { Repertoire } from './repertoire';
import { State } from './srs';

export const LEGACY_PROMPT_KEY = 'repertoire2-legacy-import-dismissed';
const LEGACY_DATABASE = 'repertoire-data';
const LEGACY_STORE = 'app';

export interface LegacySnapshot {
  data: AppData;
  games: GamesData | null;
}

export interface LegacyPlan {
  newProfiles: number;
  newRepertoires: number;
  existingRepertoires: number;
  newMistakes: number;
  newGames: number;
  newCards: number;
  previouslyReviewed: number;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function validLegacyData(value: unknown): value is AppData {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.profiles) || !Array.isArray(value.repertoires)) return false;
  const profilesOkay = value.profiles.every((p: unknown) => record(p) && typeof p.id === 'string' && typeof p.name === 'string');
  const repertoiresOkay = value.repertoires.every((r: unknown) =>
    record(r) && typeof r.id === 'string' && typeof r.profileId === 'string' &&
    typeof r.name === 'string' && (r.side === 'white' || r.side === 'black') &&
    record(r.positions) && record(r.cards) && record(r.notes) && record(r.engine) &&
    Object.values(r.cards).every((c) => record(c) && typeof c.state === 'number' && typeof c.due === 'number'),
  );
  return profilesOkay && repertoiresOkay;
}

function validLegacyGames(value: unknown): value is GamesData {
  return record(value) && value.version === 1 && Array.isArray(value.games);
}

/** Open only an existing DB. An attempt to create a missing database is aborted. */
async function readOldDatabase(): Promise<{ data: unknown; games: unknown } | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(LEGACY_DATABASE);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE)) {
        db.close();
        resolve(null);
        return;
      }
      try {
        const tx = db.transaction(LEGACY_STORE, 'readonly');
        const store = tx.objectStore(LEGACY_STORE);
        const data = store.get('data');
        const games = store.get('games');
        tx.oncomplete = () => {
          db.close();
          resolve({ data: data.result, games: games.result });
        };
        tx.onerror = () => { db.close(); resolve(null); };
        tx.onabort = () => { db.close(); resolve(null); };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

/** Does not ask to connect to Google, even if the legacy app used Drive sync. */
export async function findLegacySnapshot(): Promise<LegacySnapshot | null> {
  const raw = await readOldDatabase();
  if (!raw || !validLegacyData(raw.data) || !raw.data.repertoires.length) return null;
  return { data: raw.data, games: validLegacyGames(raw.games) ? raw.games : null };
}

/** Pure preview; no state changes, no writes to either app. */
export function legacyPlan(current: AppData, currentGameIds: readonly string[], snapshot: LegacySnapshot, includeHistory = false): LegacyPlan {
  const profiles = new Set(current.profiles.map((p) => p.id));
  const repertoires = new Set(current.repertoires.map((r) => r.id));
  const mistakes = new Set((current.mistakes ?? []).map((m) => m.id));
  const games = new Set(currentGameIds);
  const fresh = snapshot.data.repertoires.filter((r) => !repertoires.has(r.id));
  const cards = fresh.flatMap((r) => Object.values(r.cards));
  return {
    newProfiles: snapshot.data.profiles.filter((p) => !profiles.has(p.id)).length,
    newRepertoires: fresh.length,
    existingRepertoires: snapshot.data.repertoires.length - fresh.length,
    newMistakes: includeHistory ? (snapshot.data.mistakes ?? []).filter((m) => !mistakes.has(m.id)).length : 0,
    newGames: includeHistory ? (snapshot.games?.games ?? []).filter((g) => !games.has(g.id)).length : 0,
    newCards: cards.length,
    previouslyReviewed: cards.filter((c) => c.state !== State.New).length,
  };
}

export function mergeLegacyData(current: AppData, snapshot: LegacySnapshot, includeHistory: boolean, now = Date.now()): AppData {
  const profileIds = new Set(current.profiles.map((p) => p.id));
  const repIds = new Set(current.repertoires.map((r) => r.id));
  const mistakesIds = new Set((current.mistakes ?? []).map((m) => m.id));
  const profiles: Profile[] = snapshot.data.profiles
    .filter((p) => !profileIds.has(p.id))
    .map((p) => ({ ...p, updatedAt: now }));
  const repertoires: Repertoire[] = snapshot.data.repertoires
    .filter((r) => !repIds.has(r.id) && (profileIds.has(r.profileId) || profiles.some((p) => p.id === r.profileId)))
    .map((r) => ({ ...r, updatedAt: now }));
  const importedRepIds = new Set(repertoires.map((r) => r.id));
  const allProfiles = [...current.profiles, ...profiles];
  const allRepertoires = [...current.repertoires, ...repertoires];
  // After an explicit import, show the imported study immediately, even when v2
  // already has another active player; never overwrite their records.
  const firstImported = repertoires.find((r) => r.id === snapshot.data.activeRepId) ?? repertoires[0];
  const mistakes = includeHistory
    ? (snapshot.data.mistakes ?? []).filter((m) =>
      !mistakesIds.has(m.id) && allProfiles.some((p) => p.id === m.profileId),
    ).map((m) => ({ ...m, updatedAt: now }))
    : [];
  const deleted = { ...(current.deleted ?? {}) };
  for (const id of [...profiles.map((p) => p.id), ...repertoires.map((r) => r.id), ...mistakes.map((m) => m.id)]) delete deleted[id];
  return {
    ...current,
    profiles: allProfiles,
    repertoires: allRepertoires,
    mistakes: [...(current.mistakes ?? []), ...mistakes],
    checks: {
      ...(current.checks ?? {}),
      ...Object.fromEntries(Object.entries(snapshot.data.checks ?? {}).filter(([id]) => importedRepIds.has(id))),
    },
    deleted,
    activeProfileId: firstImported?.profileId ?? current.activeProfileId ?? (
      allProfiles.some((p) => p.id === snapshot.data.activeProfileId) ? snapshot.data.activeProfileId : allProfiles[0]?.id ?? null
    ),
    activeRepId: firstImported?.id ?? current.activeRepId ?? (
      allRepertoires.some((r) => r.id === snapshot.data.activeRepId) ? snapshot.data.activeRepId : allRepertoires[0]?.id ?? null
    ),
  };
}

/**
 * Additive import. Existing v2 IDs (and their SRS progress) take priority.
 * Includes stored FSRS cards intact; no auto-reset or due-date changes.
 */
export async function importLegacy(snapshot: LegacySnapshot, includeHistory: boolean): Promise<LegacyPlan> {
  if (!validLegacyData(snapshot.data)) throw new Error('Old app data was not recognized.');
  const current = useApp.getState().data;
  const gameStore = useGames.getState();
  const preview = legacyPlan(current, gameStore.data.games.map((g) => g.id), snapshot, includeHistory);
  const merged = mergeLegacyData(current, snapshot, includeHistory);
  if (merged.repertoires.length !== current.repertoires.length || merged.profiles.length !== current.profiles.length ||
      (merged.mistakes?.length ?? 0) !== (current.mistakes?.length ?? 0)) {
    useApp.setState({ data: merged, view: 'home', line: [], ply: 0, undo: [], redo: [], trainScope: null });
  }
  if (includeHistory && snapshot.games) {
    // Games with the same ID are kept as they already exist in v2.
    const existing = new Set(gameStore.data.games.map((g) => g.id));
    useGames.getState().addGames(snapshot.games.games.filter((g) =>
      !existing.has(g.id) && merged.profiles.some((p) => p.id === g.profileId),
    ));
  }
  await Promise.all([flushLocal(), flushGames()]);
  if (useSaveState.getState().status === 'error') throw new Error('Saving the imported repertoires failed. Check browser storage.');
  try { localStorage.setItem(LEGACY_PROMPT_KEY, '1'); } catch { /* no browser storage */ }
  return preview;
}

export function dismissLegacyPrompt() {
  try { localStorage.setItem(LEGACY_PROMPT_KEY, '1'); } catch { /* ignore */ }
}

export function shouldShowLegacyPrompt() {
  try { return localStorage.getItem(LEGACY_PROMPT_KEY) !== '1'; } catch { return true; }
}

export const legacyTotal = (reps: readonly Repertoire[]) => {
  const cards = reps.flatMap((r) => Object.values(r.cards));
  return { repertoires: reps.length, cards: cards.length, reviewed: cards.filter((c) => c.state !== State.New).length };
};
