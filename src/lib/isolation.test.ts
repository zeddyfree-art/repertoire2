import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Regression guard: both apps are hosted on the SAME origin. Different URL paths
// do not isolate localStorage, IndexedDB or Drive appProperties.
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Repertoire 2 data isolation', () => {
  it('uses a distinct IndexedDB for repertoire, games and checks', () => {
    for (const path of ['./store.ts', './gamesStore.ts', './checkResults.ts']) {
      expect(source(path)).toContain("createStore('repertoire2-data', 'app')");
      expect(source(path)).not.toContain("createStore('repertoire-data', 'app')");
    }
  });

  it('separates caches and model storage', () => {
    expect(source('./lichess.ts')).toContain("createStore('repertoire2-cache', 'lichess')");
    expect(source('./maia.ts')).toContain("createStore('repertoire2-models', 'models')");
  });

  it('never discovers or updates legacy Drive files', () => {
    const drive = source('./drive.ts');
    expect(drive).toContain("const APP_KEY = 'repertoire2App'");
    expect(drive).toContain("const FOLDER_NAME = 'Repertoire 2 app'");
    expect(drive).toContain("const TOKEN_KEY = 'repertoire2-google-token'");
    expect(source('./sync.ts')).toContain("const META_KEY = 'repertoire2-drive-sync'");
  });

  it('keeps the service-worker cache cleanup inside v2', () => {
    const sw = source('../../pwa/sw.js');
    expect(sw).toContain("const CACHE = 'repertoire2-__BUILD__'");
    expect(sw).toContain("k.startsWith('repertoire2-')");
    expect(sw).not.toContain("k.startsWith('repertoire-')");
  });
});
