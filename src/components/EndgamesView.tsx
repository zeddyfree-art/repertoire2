import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { DrillSession, Stars } from './EndgameDrill';
import { PuzzleSession } from './EndgamePuzzles';
import { activeProfile, useApp } from '../lib/store';
import { LEVEL_LABEL, PUZZLE_GROUPS, STAGES, type Drill, type PuzzleTest, type Section } from '../lib/endgames/curriculum';
import {
  BOX_DAYS,
  drillStatus,
  dueDrills,
  EMPTY_PROGRESS,
  formatDue,
  formatMs,
  MASTERED_BOX,
  nextSection,
  sectionMastery,
  sectionQueue,
  summary,
  testScore,
  weakSpots,
  weakTests,
  type EndgameProgress,
} from '../lib/endgames/progress';
import { DIFFICULTIES, lichessThemeUrl, type PuzzleDifficulty } from '../lib/endgames/puzzles';

type Mode = { kind: 'overview' } | { kind: 'drills'; drills: Drill[]; title: string } | { kind: 'puzzles'; test: PuzzleTest; count: number };

const DIFFICULTY_KEY = 'repertoire2-puzzle-difficulty';

function savedDifficulty(): PuzzleDifficulty {
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY);
    if (DIFFICULTIES.some((d) => d.value === v)) return v as PuzzleDifficulty;
  } catch {
    /* ignore */
  }
  return 'normal';
}

/** The active player's endgame progress (empty for someone who has not started). */
export function useEndgameProgress(): EndgameProgress {
  return useApp((s) => activeProfile(s)?.endgames) ?? EMPTY_PROGRESS;
}

export function EndgamesView() {
  const progress = useEndgameProgress();
  const [mode, setMode] = useState<Mode>({ kind: 'overview' });
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>(savedDifficulty);
  const [open, setOpen] = useState<string | null>(null);
  // A session starts at the top of the page, with the board in view.
  useEffect(() => window.scrollTo({ top: 0 }), [mode]);

  // Recomputed when the progress changes (the overview is shown again after every session).
  const sum = useMemo(() => summary(progress), [progress]);
  const due = useMemo(() => dueDrills(progress), [progress]);
  const next = useMemo(() => nextSection(progress), [progress]);
  const weak = useMemo(() => weakSpots(progress), [progress]);
  const weakT = useMemo(() => weakTests(progress), [progress]);

  const back = () => setMode({ kind: 'overview' });

  if (mode.kind === 'drills') return <DrillSession drills={mode.drills} title={mode.title} onExit={back} />;
  if (mode.kind === 'puzzles') return <PuzzleSession test={mode.test} count={mode.count} difficulty={difficulty} onExit={back} />;

  const startDrills = (drills: Drill[], title: string) => drills.length && setMode({ kind: 'drills', drills, title });
  const chooseDifficulty = (d: PuzzleDifficulty) => {
    setDifficulty(d);
    try {
      localStorage.setItem(DIFFICULTY_KEY, d);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="stack eg-overview" style={{ gap: 22 }}>
      <section className="card card-pad stack eg-hero">
        <div className="eg-hero-top">
          <div className="stack" style={{ gap: 6, flex: '1 1 280px' }}>
            <div className="studio-overline">YOUR ENDGAME SCORE</div>
            <div className="eg-score">
              <b>{Math.round(sum.mastery * 100)}%</b>
              <span className="muted">
                {sum.mastered} of {sum.total} drills mastered · {sum.testsPassed} of {sum.tests} puzzle tests passed
              </span>
            </div>
            <div className="progress eg-progress" title="Each drill counts a third per pass in a row, up to three">
              <div style={{ width: `${sum.mastery * 100}%` }} />
            </div>
          </div>
          <div className="stat-row eg-stats">
            <div className="stat" title="Drills you have not tried yet">
              <b>{sum.fresh}</b>
              <span>new</span>
            </div>
            <div className="stat" title="Passed once or twice in a row">
              <b style={{ color: sum.learning ? 'var(--accent)' : undefined }}>{sum.learning}</b>
              <span>learning</span>
            </div>
            <div className="stat" title="Passed three times in a row; they come back for upkeep">
              <b style={{ color: sum.mastered ? 'var(--mine)' : undefined }}>{sum.mastered}</b>
              <span>mastered</span>
            </div>
            <div className="stat" title="Missed last time, or due for upkeep">
              <b style={{ color: sum.due ? 'var(--due)' : undefined }}>{sum.due}</b>
              <span>due</span>
            </div>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className={`btn ${due.length ? 'primary' : ''}`} disabled={!due.length} onClick={() => startDrills(due, 'Review')}>
            <Icon name="train" size={16} /> {due.length ? `Review due (${due.length})` : 'Nothing due'}
          </button>
          {next && (
            <button className={`btn ${due.length ? '' : 'primary'}`} onClick={() => startDrills(sectionQueue(next, progress), next.title)}>
              <Icon name="next" size={16} /> Continue: {next.title}
            </button>
          )}
          {!next && <span className="badge mine">Every drill mastered — keep them up with the reviews.</span>}
        </div>
      </section>

      {(weak.length > 0 || weakT.length > 0) && (
        <section className="card card-pad stack">
          <h2 style={{ fontSize: 17 }}>Still to train</h2>
          <div className="eg-weak">
            {weak.map(({ drill, section, misses }) => (
              <button key={drill.id} className="eg-weak-item" onClick={() => startDrills([drill], drill.title)}>
                <span className="badge gap">{misses}× missed</span>
                <span>
                  <b>{drill.title}</b>
                  <small>{section.title}</small>
                </span>
                <Icon name="next" size={16} />
              </button>
            ))}
            {weakT.slice(0, 4).map(({ test, score }) => (
              <button key={test.theme} className="eg-weak-item" onClick={() => setMode({ kind: 'puzzles', test, count: 10 })}>
                <span className="badge due">
                  {score.solved}/{score.played}
                </span>
                <span>
                  <b>{test.title}</b>
                  <small>puzzles · {score.need} of {score.size} needed</small>
                </span>
                <Icon name="next" size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      {STAGES.map((stage, si) => (
        <section key={stage.id} className="stack" style={{ gap: 12 }}>
          <div className="studio-section-heading">
            <div>
              <h2>
                {si + 1}. {stage.title}
              </h2>
              <span>{stage.lead}</span>
            </div>
          </div>
          <div className="eg-sections">
            {stage.sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                progress={progress}
                open={open === section.id}
                onToggle={() => setOpen(open === section.id ? null : section.id)}
                onPractise={(drills) => startDrills(drills, section.title)}
                onPuzzles={(theme) => {
                  const test = PUZZLE_GROUPS.flatMap((g) => g.tests).find((t) => t.theme === theme);
                  if (test) setMode({ kind: 'puzzles', test, count: 10 });
                }}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="stack" style={{ gap: 12 }}>
        <div className="studio-section-heading">
          <div>
            <h2>{STAGES.length + 1}. Patterns and puzzle tests</h2>
            <span>Puzzles from Lichess by theme. A test is passed when 80% of your last puzzles were right at the first try.</span>
          </div>
          <label className="row small" style={{ gap: 6 }}>
            <span className="muted">Difficulty</span>
            <select className="input" value={difficulty} onChange={(e) => chooseDifficulty(e.target.value as PuzzleDifficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="eg-sections eg-puzzle-groups">
          {PUZZLE_GROUPS.map((group) => (
            <div key={group.id} className="card card-pad stack eg-section">
              <div>
                <h3>{group.title}</h3>
                <div className="small muted">{group.lead}</div>
              </div>
              <div className="eg-tests">
                {group.tests.map((test) => {
                  const sc = testScore(test, progress.puzzles[test.theme]);
                  return (
                    <div key={test.theme} className="eg-test" title={test.about}>
                      <span className={`eg-dot ${sc.passed ? 'mastered' : sc.played ? 'learning' : 'new'}`} />
                      <span className="eg-test-name">{test.title}</span>
                      <span className="small muted eg-test-score">
                        {sc.passed ? '✓ passed' : sc.played ? `${sc.solved}/${sc.played}` : '—'}
                      </span>
                      <button className="btn sm" onClick={() => setMode({ kind: 'puzzles', test, count: test.size })} title={`Take the test: ${test.size} puzzles, ${sc.need} right at the first try`}>
                        Test {test.size}
                      </button>
                      <button className="btn sm ghost" onClick={() => setMode({ kind: 'puzzles', test, count: 5 })} title="Five puzzles for practice (they count towards the test too)">
                        5
                      </button>
                      <a className="btn sm icon ghost" href={lichessThemeUrl(test.theme)} target="_blank" rel="noopener noreferrer" title="This theme on Lichess">
                        <Icon name="external" size={13} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <details className="card card-pad eg-howto">
        <summary>
          <b>How the scores work</b>
        </summary>
        <div className="stack small" style={{ gap: 8, marginTop: 10 }}>
          <p>
            <b>Drills</b> are played out against perfect defence: the Lichess tablebase for up to seven pieces, Stockfish in your browser for
            more (or without a connection). A move that throws the result away is taken back at once and counts as a mistake.
          </p>
          <p>
            <b>Stars</b>: ★★★ clean — no mistake, no hint, within the time target of the basic mates and close to the shortest mate. ★★ solved
            without a mistake. ★ solved after a mistake or a wrong win-or-draw call. No stars: not solved. Two stars or more is a pass.
          </p>
          <p>
            <b>Mastery</b>: a pass moves a drill one box up, a miss sends it back to the start. Three passes in a row and it is mastered, as the
            checklist asks. Then it comes back for upkeep after {BOX_DAYS.slice(MASTERED_BOX).join(', ')} days. Starting over after a mistake or a
            hint counts as a miss.
          </p>
          <p>
            <b>Levels</b>: L1 must be automatic (do these first), L2 is required, L3 is for 1500–1800. <i>Continue</i> takes you through all L1
            sections first, then L2, then L3.
          </p>
          <p>
            <b>Puzzle tests</b> use Lichess puzzles of one theme (difficulty above). Only the first try counts, and a hint is a miss. Each test looks at
            your last 20 or 30 puzzles.
          </p>
        </div>
      </details>
    </div>
  );
}

function SectionCard({
  section,
  progress,
  open,
  onToggle,
  onPractise,
  onPuzzles,
}: {
  section: Section;
  progress: EndgameProgress;
  open: boolean;
  onToggle: () => void;
  onPractise: (drills: Drill[]) => void;
  onPuzzles: (theme: string) => void;
}) {
  const mastery = sectionMastery(section, progress);
  const done = mastery >= 1;
  return (
    <div className={`card card-pad stack eg-section ${done ? 'done' : ''}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{section.title}</h3>
          <span className={`badge eg-level-${section.level}`}>{LEVEL_LABEL[section.level]}</span>
        </div>
        <span className="eg-pct" title="Mastery of this section">
          {done ? '✓' : `${Math.round(mastery * 100)}%`}
        </span>
      </div>
      <div className="progress">
        <div style={{ width: `${mastery * 100}%` }} />
      </div>
      <div className="eg-drills">
        {section.drills.map((d) => (
          <DrillRow key={d.id} drill={d} progress={progress} onPlay={() => onPractise([d])} />
        ))}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <button className={`btn sm ${done ? '' : 'primary'}`} onClick={() => onPractise(sectionQueue(section, progress))}>
          <Icon name="play" size={13} /> {done ? 'Practise again' : 'Practise'}
        </button>
        <button className="btn sm ghost" onClick={onToggle} aria-expanded={open}>
          <Icon name="hint" size={13} /> {open ? 'Hide the method' : 'The method'}
        </button>
        {section.puzzles?.[0] && (
          <button className="btn sm ghost" onClick={() => onPuzzles(section.puzzles![0])} title="Ten Lichess puzzles of this theme">
            Puzzles
          </button>
        )}
      </div>
      {open && (
        <div className="stack small eg-method" style={{ gap: 6 }}>
          <div>{section.rule}</div>
          {section.learn.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={12} /> {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DrillRow({ drill, progress, onPlay }: { drill: Drill; progress: EndgameProgress; onPlay: () => void }) {
  const r = progress.drills[drill.id];
  const status = drillStatus(r);
  const label =
    status === 'new'
      ? 'new'
      : status === 'due'
        ? r && r.box >= MASTERED_BOX
          ? 'due for upkeep'
          : 'practise again'
        : status === 'mastered'
          ? `mastered · ${formatDue(r!.due)}`
          : `${r!.box} of 3 in a row`;
  return (
    <button className="eg-drill-row" onClick={onPlay} title={`Practise “${drill.title}”`}>
      <span className={`eg-dot ${status}`} />
      <span className="eg-drill-name">
        {drill.title}
        {drill.random && <span className="faint"> · random</span>}
        {drill.verdict && <span className="faint"> · win or draw?</span>}
      </span>
      <span className="eg-boxes" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i key={i} className={(r?.box ?? 0) > i ? 'on' : ''} />
        ))}
      </span>
      {r && r.attempts > 0 && <Stars n={r.recent.at(-1) ?? 0} />}
      <span className="small muted eg-drill-state">
        {label}
        {r?.bestMs && drill.targetSec ? ` · best ${formatMs(r.bestMs)}` : ''}
      </span>
    </button>
  );
}
