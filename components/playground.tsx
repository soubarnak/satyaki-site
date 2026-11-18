"use client";

// Playground view (WF-003, FR-009): free practise reusing the lesson
// player's editor and run wiring. Runs show output only: never judged,
// never scored, and never written to progress storage.

import { useState } from "react";
import { parseRunOutcome, type RunOutcome } from "@/lib/lesson-player";
import { PLAYGROUND_EXAMPLE, playgroundFeedback } from "@/lib/playground";
import {
  decodeShareLink,
  previewShareImport,
  startSharedChallenge,
  type ShareData,
  type SharePreview,
} from "@/lib/playground";
import { shareLinkBrokenLine } from "@/lib/kid-errors";
import { browserProgressV2Storage } from "@/lib/progress-v2-storage";
import { Bolt } from "./bolt";

type ShareLanding =
  | { status: "none" }
  | { status: "preview"; data: ShareData; preview: SharePreview }
  | { status: "broken" };

/** Read the Share Link landing once: preview data, or broken, or none. */
function readShareLanding(): ShareLanding {
  if (typeof window === "undefined") return { status: "none" };
  const hash = window.location.hash;
  if (!hash.startsWith("#c=")) return { status: "none" };
  const decoded = decodeShareLink(hash);
  if (!decoded.ok) return { status: "broken" };
  return { status: "preview", data: decoded.data, preview: previewShareImport(decoded.data) };
}

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
  // Share Link landing (ADR-0014): preview first, nothing auto-runs.
  // Read once at mount; the hash is external state the view never writes.
  const [landing] = useState<ShareLanding>(() => readShareLanding());
  const [notice, setNotice] = useState("");

  // Start saves a Creation copy and loads its starter; at the cap it blocks.
  function handleStartChallenge(): void {
    if (landing.status !== "preview") return;
    const storage = browserProgressV2Storage();
    const started = startSharedChallenge(storage.load(), landing.data);
    if (!started.ok) {
      setNotice(started.message);
      return;
    }
    storage.save(started.progress);
    const starter =
      started.creation.drafts.java !== "" ? started.creation.drafts.java : started.creation.drafts.python;
    setCode(starter);
    setNotice(`Saved “${started.creation.title}” to your shelf, Cadet.`);
  }

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

      {landing.status === "broken" && (
        <section aria-label="Shared Challenge">
          <p className="bolt-bubble" role="status">
            {shareLinkBrokenLine()}
          </p>
        </section>
      )}

      {landing.status === "preview" && (
        <section aria-label="Shared Challenge">
          <h2>Shared Challenge: {landing.preview.title}</h2>
          <ul>
            {landing.preview.goalLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <p>
            {landing.preview.entityCount} entities, {landing.preview.bounds.maxX}×
            {landing.preview.bounds.maxZ}×{landing.preview.bounds.maxY} world (
            {landing.preview.languages.join(" + ")} starter
            {landing.preview.languages.length === 1 ? "" : "s"}).
          </p>
          <div className="lesson-controls">
            <button type="button" onClick={handleStartChallenge}>
              Start Challenge
            </button>
          </div>
          {notice !== "" && <p role="status">{notice}</p>}
        </section>
      )}

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
