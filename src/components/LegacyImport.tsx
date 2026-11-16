import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { useGames } from '../lib/gamesStore';
import { useApp } from '../lib/store';
import {
  dismissLegacyPrompt, findLegacySnapshot, importLegacy, legacyPlan, legacyTotal,
  shouldShowLegacyPrompt, validLegacyData, type LegacySnapshot,
} from '../lib/legacyImport';

function LegacyImportDialog({ snapshot, onClose, origin }: {
  snapshot: LegacySnapshot;
  onClose: () => void;
  origin: 'browser' | 'backup';
}) {
  const data = useApp((s) => s.data);
  const games = useGames((s) => s.data.games);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = legacyPlan(data, games.map((g) => g.id), snapshot, history);
  const totals = legacyTotal(snapshot.data.repertoires);
  const missing = plan.newRepertoires > 0 || plan.newProfiles > 0 || plan.newMistakes > 0 || plan.newGames > 0;
  const close = () => { dismissLegacyPrompt(); onClose(); };
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const done = await importLegacy(snapshot, history);
      useApp.getState().showToast(`Imported ${done.newRepertoires} repertoires with ${done.newCards} SRS cards from Repertoire 1.`);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Move your Repertoire 1 studies?" onClose={close}>
      <div className="stack studio-legacy-import" style={{ gap: 14 }}>
        <p className="muted">We found your old Repertoire data {origin === 'browser' ? 'in this browser' : 'in this backup file'}.
          You can bring the missing repertoires and their complete SRS schedules into Repertoire 2.</p>
        <div className="studio-legacy-counts" aria-label="Old app overview">
          <div><strong>{totals.repertoires}</strong><span>Repertoires</span></div>
          <div><strong>{totals.cards}</strong><span>SRS moves</span></div>
          <div><strong>{totals.reviewed}</strong><span>Reviewed before</span></div>
        </div>
        <div className="studio-legacy-list" aria-label="Repertoires from Repertoire 1">
          {snapshot.data.repertoires.map((rep) => {
            const cards = Object.values(rep.cards);
            const seen = cards.filter((card) => card.state !== 0).length;
            const exists = data.repertoires.some((existing) => existing.id === rep.id);
            return (
              <div className="studio-legacy-item" key={rep.id}>
                <span aria-hidden="true">{rep.side === 'white' ? '♔' : '♚'}</span>
                <span><b>{rep.name}</b><small>{rep.study ? 'Study' : 'In play'}{rep.paused ? ' · SRS paused' : ''}
                  {' · '}{seen}/{cards.length} moves reviewed</small></span>
                <span className={exists ? 'badge' : 'badge mine'}>{exists ? 'Already here' : 'Import'}</span>
              </div>
            );
          })}
        </div>
        {plan.existingRepertoires > 0 && (
          <p className="help">The {plan.existingRepertoires} repertoire(s) already in Repertoire 2 will <b>not</b> be overwritten.
            Their current training progress takes priority. Repertoires with a different ID but the same name are added separately.</p>
        )}
        {origin === 'browser' && snapshot.games && snapshot.games.games.length > 0 && (
          <label className="row studio-legacy-history" style={{ gap: 10 }}>
            <input type="checkbox" checked={history} onChange={(event) => setHistory(event.target.checked)}/>
            <span><b>Also import game history and mistake cards</b>
              <small>{snapshot.games.games.length} games and {(snapshot.data.mistakes ?? []).length} mistake cards in Repertoire 1</small>
            </span>
          </label>
        )}
        <p className="help"><b>Safe and additive:</b> Repertoire 1 stays untouched. Existing Repertoire 2 work is kept.
          SRS review dates, intervals, In play/Study status and Pause training settings are preserved.
          If Drive sync is enabled, new items will sync to the separate Repertoire 2 folder.</p>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="row wrap" style={{ justifyContent: 'flex-end', gap: 9 }}>
          <button className="btn ghost" onClick={close} disabled={busy}>Not now</button>
          <button className="btn primary" onClick={() => void run()} disabled={busy || !missing}>
            <Icon name="download" size={16}/>{busy ? 'Importing…' : missing ? 'Import missing data' : 'Already up to date'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** First-visit nudge; never interrupts the user again after "Not now". */
export function LegacyImportPrompt() {
  const [snapshot, setSnapshot] = useState<LegacySnapshot | null>(null);
  useEffect(() => {
    if (!shouldShowLegacyPrompt()) return;
    let alive = true;
    void findLegacySnapshot().then((found) => {
      if (!alive || !found) return;
      const current = useApp.getState().data;
      const gameIds = useGames.getState().data.games.map((g) => g.id);
      const plan = legacyPlan(current, gameIds, found);
      if (plan.newRepertoires > 0 || plan.newProfiles > 0) setSnapshot(found);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return snapshot && <LegacyImportDialog snapshot={snapshot} onClose={() => setSnapshot(null)} origin="browser"/>;
}

/** Settings always offers another, explicit check, even if the first prompt was declined. */
export function LegacyImportSettings() {
  const [snapshot, setSnapshot] = useState<LegacySnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const found = await findLegacySnapshot();
      if (found) setSnapshot(found);
      else setMessage('No Repertoire 1 data found in this browser. If you used another device, export a backup JSON there and select it below.');
    } catch {
      setMessage('Could not read the old app data. You can select a backup file instead.');
    } finally {
      setChecking(false);
    }
  };
  const file = async (chosen: File | undefined) => {
    if (!chosen) return;
    try {
      const json: unknown = JSON.parse(await chosen.text());
      if (!validLegacyData(json)) throw new Error('This is not a compatible Repertoire backup.');
      setMessage(null);
      setSnapshot({ data: json, games: null });
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <>
      <section className="card studio-legacy-settings">
        <div className="section">
          <h2>Import from Repertoire 1</h2>
        </div>
        <div className="section stack" style={{ gap: 12 }}>
          <p className="help">Bring your old opening repertoires, SRS schedules and training settings into Repertoire 2.
            This adds missing items; it does not replace existing repertoires or modify the old app.</p>
          <div className="row wrap" style={{ gap: 10 }}>
            <button className="btn" onClick={() => void check()} disabled={checking}>
              <Icon name="refresh" size={16}/>{checking ? 'Checking…' : 'Find old app in this browser'}
            </button>
            <label className="btn">
              <Icon name="upload" size={16}/> Or choose an old backup JSON
              <input type="file" hidden accept=".json,application/json" onChange={(e) => { void file(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {message && <p className="help" role="status">{message}</p>}
          <p className="small muted">A backup JSON contains repertoire and SRS data; game history lives in a separate file.
            To include old games, use the same-browser import when available.</p>
        </div>
      </section>
      {snapshot && <LegacyImportDialog snapshot={snapshot} onClose={() => setSnapshot(null)} origin={snapshot.games ? 'browser' : 'backup'}/>}
    </>
  );
}
