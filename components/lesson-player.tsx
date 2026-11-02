"use client";

// Lesson player at `/levels/[id]` (WF-002): story, objective, starter
// code in the editor, hint through Bolt's speech bubble, Run control,
// output, and child-readable feedback (child line first) on one screen
// at 1024 px width. Run goes to /api/run, the result is judged, and a
// first pass records progress (points, badge, streak) in one write.

import Link from "next/link";
import { useState } from "react";
import { levelHref, levelState } from "@/lib/level-map";
import { parseRunOutcome, runFeedback, type RunFeedback, type RunOutcome } from "@/lib/lesson-player";
import { getLevel, type Level } from "@/lib/levels";
import { localDateString, recordPass, recordRunDay } from "@/lib/progress";
import { browserProgressStorage, PROGRESS_STORAGE_KEY } from "@/lib/progress-storage";
import { Bolt } from "./bolt";
import { useProgress } from "./use-progress";

function defaultBoltLine(level: Level): string {
  return `Level ${level.id} on planet ${level.planet}, Cadet. Read the mission, then press Run.`;
}

function submitOutcome(outcome: RunOutcome, status: number): RunOutcome {
  // A refused run (rate limit) still arrives classed per ADR-0005; only
  // fall back to busy when the route gave no class to render.
  if (outcome.resultClass === "unknown" && (status === 429 || status === 503)) {
    return { ...outcome, resultClass: "busy" };
  }
  return outcome;
}

export function LessonPlayer({ level }: { level: Level }) {
  const { progress, loaded } = useProgress();
  const [code, setCode] = useState(level.starterCode);
  const [running, setRunning] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [feedback, setFeedback] = useState<RunFeedback | null>(null);
  const [stdout, setStdout] = useState("");
  const [rawError, setRawError] = useState("");
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const state = loaded ? levelState(progress, level.id) : null;

  async function handleRun(): Promise<void> {
    if (running) return;
    setRunning(true);
    try {
      let outcome: RunOutcome;
      let status = 200;
      try {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ program: code }),
        });
        status = response.status;
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        outcome = submitOutcome(parseRunOutcome(body), status);
      } catch {
        // The fetch itself failed: the runner is unreachable from here.
        outcome = { resultClass: "runner-unavailable", stdout: "", stderr: "", durationMs: 0 };
      }
      const next = runFeedback(level, code, outcome, outcome.stderr);
      setFeedback(next);
      setStdout(outcome.stdout);
      setRawError(next.rawError);
      setDurationMs(outcome.durationMs);
      // One storage write per completed run (ADR-0006): a pass records
      // the pass plus its streak day together, so points, badge, and
      // streak land together or not at all; any other run only marks
      // the run day (FR-015) with no points change.
      const storage = browserProgressStorage();
      const today = localDateString(new Date());
      const current = storage.load();
      storage.save(next.passed ? recordPass(current, level.id, today) : recordRunDay(current, today));
    } finally {
      setRunning(false);
    }
  }

  const boltLine = feedback?.boltLine ?? (hintShown ? level.hint : defaultBoltLine(level));

  return (
    <>
      <h1>
        Level {level.id}: {level.title}
      </h1>
      <p className="map-intro">
        Planet {level.planet} · New skill: {level.concept} · {level.points} points
        {level.badge ? ` · Badge: ${level.badge}` : ""}
      </p>

      <div className="bolt-row">
        <Bolt size={72} />
        <p className="bolt-bubble" role="status">
          {boltLine}
        </p>
      </div>

      {!loaded ? (
        <p>Loading your quest, Cadet.</p>
      ) : state === "locked" ? (
        <>
          <p>
            This planet is locked, Cadet. Pass the earlier level first to open it.
          </p>
          <p>
            <Link href="/">Back to the level map</Link>
          </p>
        </>
      ) : (
        <div className="lesson-grid">
          <section aria-label="Mission">
            <h2>Mission</h2>
            <p>{level.story}</p>
            <h3>Mission goal</h3>
            <p>{level.objective}</p>
            <p className="lesson-goal-output">
              Goal output: <code>{level.expectedOutput}</code>
            </p>
          </section>

          <section aria-label="Code and result">
            <label className="editor-label" htmlFor="lesson-editor">
              Your Java program
            </label>
            <textarea
              id="lesson-editor"
              className="lesson-editor"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={10}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <div className="lesson-controls">
              <button type="button" onClick={() => void handleRun()} disabled={running}>
                {running ? "Running…" : "Run"}
              </button>
              <button
                type="button"
                className="lesson-hint-button"
                onClick={() => {
                  setHintShown(true);
                  setFeedback(null);
                }}
              >
                Hint
              </button>
            </div>

            <h3>What happened</h3>
            {feedback?.passed === true && (
              <p className="lesson-pass">
                Level passed, Cadet.{" "}
                {nextHref(level.id) !== null ? (
                  <>
                    <Link href={nextHref(level.id)!}>{nextLabel(level.id)}</Link> ·{" "}
                  </>
                ) : null}
                <Link href="/">Level map</Link>
              </p>
            )}
            <pre className="lesson-output" aria-label="Program output">
              {stdout}
              {rawError !== "" ? `\n${rawError}` : ""}
              {stdout === "" && rawError === "" ? "Press Run to see your output here." : ""}
            </pre>
            {durationMs !== null && <p className="lesson-duration">Run time: {formatDuration(durationMs)}</p>}
          </section>
        </div>
      )}
    </>
  );
}

function nextHref(levelId: number): string | null {
  const next = getLevel(levelId + 1);
  if (!next) return null;
  return levelHref(next.id);
}

function nextLabel(levelId: number): string {
  const next = getLevel(levelId + 1);
  return next && next.id === 10 ? "To the robot arena" : "Next level";
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

// Re-exported for tests that seed browser storage through the real key.
export { PROGRESS_STORAGE_KEY };
