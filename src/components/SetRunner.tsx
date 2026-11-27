import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { PuzzleRun, type RunOptions, type RunResult } from './PuzzleRun';
import type { TPuzzle } from '../lib/tactics/lichess';

export interface RunSpec extends RunOptions {
  title: string;
  subtitle?: string;
  /** Finds or makes the puzzles (may fetch from Lichess). */
  build: () => Promise<TPuzzle[]>;
  /** Saved after every puzzle, so stopping halfway keeps what was done. */
  onResult?: (r: RunResult, p: TPuzzle) => void;
  /** Saved when the whole set was played. Returns lines for the summary. */
  onComplete?: (results: RunResult[]) => string[] | void;
}

/** Fetches a set, runs it, and shows a summary. */
export function SetRunner({ spec, onExit }: { spec: RunSpec; onExit: () => void }) {
  const [puzzles, setPuzzles] = useState<TPuzzle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ results: RunResult[]; lines: string[] } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    spec
      .build()
      .then((ps) => {
        if (!alive) return;
        if (!ps.length) setError('Lichess sent no puzzles for this. Try again later.');
        else setPuzzles(ps);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (summary) {
    const solved = summary.results.filter((r) => r.solved).length;
    const ms = summary.results.reduce((s, r) => s + r.ms, 0);
    const motifs = summary.results.filter((r) => r.motifOk !== undefined);
    return (
      <div style={{ maxWidth: 620, margin: '24px auto' }} className="card card-pad stack">
        <h2>{spec.title}: done</h2>
        <div className="stat-row">
          <div className="stat">
            <b style={{ color: 'var(--mine)' }}>{solved}</b>
            <span>first try</span>
          </div>
          <div className="stat">
            <b style={{ color: summary.results.length - solved ? 'var(--gap)' : undefined }}>{summary.results.length - solved}</b>
            <span>missed</span>
          </div>
          <div className="stat">
            <b>{fmt(ms)}</b>
            <span>time</span>
          </div>
          {motifs.length > 0 && (
            <div className="stat">
              <b>
                {motifs.filter((r) => r.motifOk).length}/{motifs.length}
              </b>
              <span>motifs named</span>
            </div>
          )}
        </div>
        {summary.lines.map((l, i) => (
          <div key={i} className="feedback info">
            {l}
          </div>
        ))}
        <div className="row">
          <button className="btn primary" onClick={onExit} autoFocus>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: '24px auto' }} className="card card-pad stack">
        <h2>{spec.title}</h2>
        <div className="feedback bad">{error}</div>
        <div className="row">
          <button className="btn primary" onClick={() => setAttempt((a) => a + 1)}>
            <Icon name="refresh" size={14} /> Try again
          </button>
          <button className="btn ghost" onClick={onExit}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!puzzles) {
    return (
      <div style={{ maxWidth: 560, margin: '24px auto' }} className="card card-pad stack">
        <h2>{spec.title}</h2>
        <div className="muted">Fetching puzzles from Lichess… The first time a set is made this takes a few seconds; after that it works offline.</div>
        <div className="progress tc-indeterminate">
          <div />
        </div>
        <div className="row">
          <button className="btn ghost" onClick={onExit}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <PuzzleRun
      {...spec}
      puzzles={puzzles}
      onResult={(r, p) => spec.onResult?.(r, p)}
      onDone={(results) => setSummary({ results, lines: spec.onComplete?.(results) || [] })}
      onExit={onExit}
    />
  );
}

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
