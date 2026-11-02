"use client";

// Playground view (WF-003, FR-009): free practise reusing the lesson
// player's editor and run wiring. Runs show output only: never judged,
// never scored, and never written to progress storage.

import { useState } from "react";
import { parseRunOutcome, type RunOutcome } from "@/lib/lesson-player";
import { PLAYGROUND_EXAMPLE, playgroundFeedback } from "@/lib/playground";
import { Bolt } from "./bolt";

function submitOutcome(outcome: RunOutcome, status: number): RunOutcome {
  // A refused run (rate limit) still arrives classed per ADR-0005; only
  // fall back to busy when the route gave no class to render.
  if (outcome.resultClass === "unknown" && (status === 429 || status === 503)) {
    return { ...outcome, resultClass: "busy" };
  }
  return outcome;
}

export function Playground() {
  const [code, setCode] = useState(PLAYGROUND_EXAMPLE);
  const [running, setRunning] = useState(false);
  const [boltLine, setBoltLine] = useState(
    "Try your own code, Cadet. Press Run to see what it does.",
  );
  const [stdout, setStdout] = useState("");
  const [rawError, setRawError] = useState("");
  const [durationMs, setDurationMs] = useState<number | null>(null);

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
      const feedback = playgroundFeedback(outcome, outcome.stderr);
      setBoltLine(feedback.boltLine);
      setStdout(outcome.stdout);
      setRawError(feedback.rawError);
      setDurationMs(outcome.durationMs);
      // No progress writes: playground runs leave storage untouched (FR-009).
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <h1>Playground</h1>
      <p className="map-intro">Free practise, Cadet. Runs here change no points, badges, or streaks.</p>

      <div className="bolt-row">
        <Bolt size={72} />
        <p className="bolt-bubble" role="status">
          {boltLine}
        </p>
      </div>

      <section aria-label="Code and result">
        <label className="editor-label" htmlFor="playground-editor">
          Your Java program
        </label>
        <textarea
          id="playground-editor"
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
        </div>

        <h3>What happened</h3>
        <pre className="lesson-output" aria-label="Program output">
          {stdout}
          {rawError !== "" ? `\n${rawError}` : ""}
          {stdout === "" && rawError === "" ? "Press Run to see your output here." : ""}
        </pre>
        {durationMs !== null && <p className="lesson-duration">Run time: {formatDuration(durationMs)}</p>}
      </section>
    </>
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}
