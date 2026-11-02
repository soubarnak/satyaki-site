"use client";

// Robot arena at `/arena` (WF-004): gate on levels 1 to 9 passed
// (FR-010), robot commands plus starter code plus battle board on one
// screen (WF-004 step 1), engine replay animated step by step with a
// win recording level 10 passed in one storage write (FR-011).

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ARENA_ATTACK_DAMAGE,
  ARENA_MAX_COMMANDS,
  ARENA_OPPONENT_HEALTH,
  ARENA_START_DISTANCE,
  runArenaBattle,
  type ArenaResult,
} from "@/lib/arena";
import {
  ARENA_COMMANDS,
  ARENA_LEVEL_ID,
  ARENA_STARTER,
  arenaBattleLine,
  arenaErrorFeedback,
  arenaGate,
  arenaLockLine,
} from "@/lib/arena-view";
import { parseRunOutcome, type RunOutcome } from "@/lib/lesson-player";
import { localDateString, recordPass, recordRunDay } from "@/lib/progress";
import { browserProgressStorage } from "@/lib/progress-storage";
import { Bolt } from "./bolt";
import { useProgress } from "./use-progress";

/** Milliseconds between replay steps while the battle animates. */
const STEP_MS = 600;

function submitOutcome(outcome: RunOutcome, status: number): RunOutcome {
  // A refused run (rate limit) still arrives classed per ADR-0005; only
  // fall back to busy when the route gave no class to render.
  if (outcome.resultClass === "unknown" && (status === 429 || status === 503)) {
    return { ...outcome, resultClass: "busy" };
  }
  return outcome;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface BoardState {
  boltPos: number;
  boltDir: 1 | -1;
  opponentHealth: number;
}

function boardAt(battle: ArenaResult | null, stepIndex: number): BoardState {
  if (battle === null || stepIndex <= 0) {
    return { boltPos: 0, boltDir: 1, opponentHealth: ARENA_OPPONENT_HEALTH };
  }
  const step = battle.steps[Math.min(stepIndex, battle.steps.length) - 1];
  return { boltPos: step.boltPos, boltDir: step.boltDir, opponentHealth: step.opponentHealth };
}

export function Arena() {
  const { progress, loaded } = useProgress();
  const [code, setCode] = useState(ARENA_STARTER);
  const [running, setRunning] = useState(false);
  const [boltLine, setBoltLine] = useState(
    "Final mission, Cadet. Print MOVE, TURN, and ATTACK to wake the station.",
  );
  const [stdout, setStdout] = useState("");
  const [rawError, setRawError] = useState("");
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [battle, setBattle] = useState<ArenaResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const gate = arenaGate(progress);

  // Step the replay forward while it plays; the final tick lands on
  // the verdict and stops. Manual stepping pauses the replay.
  useEffect(() => {
    if (!playing || battle === null || stepIndex >= battle.steps.length) return;
    const timer = window.setTimeout(() => {
      const next = stepIndex + 1;
      setStepIndex(next);
      if (next >= battle.steps.length) setPlaying(false);
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, battle, stepIndex]);

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
      // One storage write per completed run (ADR-0006): a win records
      // level 10 passed plus its streak day together (FR-011, FR-008
      // once-semantics by set); any other run only marks the run day
      // (FR-015) with no points change.
      const storage = browserProgressStorage();
      const today = localDateString(new Date());
      const current = storage.load();
      if (outcome.resultClass !== "ok") {
        const feedback = arenaErrorFeedback(outcome, outcome.stderr);
        setBattle(null);
        setStepIndex(0);
        setPlaying(false);
        setBoltLine(feedback.boltLine);
        setStdout(outcome.stdout);
        setRawError(feedback.rawError);
        setDurationMs(outcome.durationMs);
        storage.save(recordRunDay(current, today));
        return;
      }
      const result = runArenaBattle(outcome.stdout);
      setBattle(result);
      setStdout(outcome.stdout);
      setRawError("");
      setDurationMs(outcome.durationMs);
      setBoltLine(arenaBattleLine(result));
      // Jump straight to the verdict when the learner prefers no
      // motion; otherwise replay from the first command.
      const reduced = prefersReducedMotion();
      setStepIndex(reduced || result.steps.length === 0 ? result.steps.length : 0);
      setPlaying(!reduced && result.steps.length > 0);
      storage.save(
        result.won ? recordPass(current, ARENA_LEVEL_ID, today) : recordRunDay(current, today),
      );
    } finally {
      setRunning(false);
    }
  }

  const board = boardAt(battle, stepIndex);
  const currentStep = stepIndex > 0 ? battle?.steps[stepIndex - 1] ?? null : null;

  return (
    <>
      <h1>Robot arena</h1>
      <p className="map-intro">
        Final mission, Cadet. Walk Bolt to the station and wake it before the rescue window closes.
      </p>

      <div className="bolt-row">
        <Bolt size={72} />
        <p className="bolt-bubble" role="status">
          {!loaded ? "Loading your quest, Cadet." : gate.open ? boltLine : arenaLockLine(gate)}
        </p>
      </div>

      {!loaded ? (
        <p>Loading the arena, Cadet.</p>
      ) : !gate.open ? (
        <>
          <p>
            The battle board stays dark until the earlier planets are passed, Cadet.{" "}
            <Link href="/">Back to the level map</Link>
          </p>
        </>
      ) : (
        <div className="lesson-grid">
          <section aria-label="Mission">
            <h2>Mission</h2>
            <p>
              Print one command per line. Bolt walks the lane in your print order, and the station
              wakes only when its health reaches 0 within {ARENA_MAX_COMMANDS} commands.
            </p>
            <h3>Robot commands</h3>
            <ul className="arena-commands">
              {ARENA_COMMANDS.map((entry) => (
                <li key={entry.command}>
                  <code>{entry.command}</code> — {entry.meaning}
                </li>
              ))}
            </ul>
            <p className="lesson-goal-output">
              Station health {ARENA_OPPONENT_HEALTH} · {ARENA_ATTACK_DAMAGE} damage per facing hit ·{" "}
              {ARENA_START_DISTANCE} cells apart
            </p>
          </section>

          <section aria-label="Code and result">
            <label className="editor-label" htmlFor="arena-editor">
              Your Java program
            </label>
            <textarea
              id="arena-editor"
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

            <h3>Battle board</h3>
            <div className="arena-board" aria-label="Battle board">
              {Array.from({ length: ARENA_START_DISTANCE + 1 }, (_, cell) => (
                <div
                  key={cell}
                  className={
                    cell === board.boltPos
                      ? "arena-cell arena-cell-bolt"
                      : cell === ARENA_START_DISTANCE
                        ? "arena-cell arena-cell-station"
                        : "arena-cell"
                  }
                >
                  {cell === board.boltPos ? (
                    <span>
                      Bolt {board.boltDir === 1 ? "→" : "←"}
                    </span>
                  ) : cell === ARENA_START_DISTANCE ? (
                    <span>Station ♥{board.opponentHealth}</span>
                  ) : (
                    <span aria-hidden="true">·</span>
                  )}
                </div>
              ))}
            </div>
            <p className="lesson-goal-output" aria-label="Battle state">
              {battle === null
                ? "Run your program to light up the battle board."
                : currentStep === null
                  ? `Bolt at cell ${board.boltPos}, facing ${board.boltDir === 1 ? "east" : "west"}. Station health ${board.opponentHealth}.`
                  : `Command ${currentStep.index} of ${battle.steps.length}: ${currentStep.command} — Bolt at cell ${currentStep.boltPos}, station health ${currentStep.opponentHealth}.`}
            </p>

            {battle !== null && battle.steps.length > 0 && (
              <>
                <div className="lesson-controls arena-replay-controls">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setStepIndex((index) => Math.max(0, index - 1));
                    }}
                    disabled={stepIndex <= 0}
                  >
                    Step back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (playing) {
                        setPlaying(false);
                      } else if (stepIndex >= battle.steps.length) {
                        setStepIndex(0);
                        setPlaying(true);
                      } else {
                        setPlaying(true);
                      }
                    }}
                  >
                    {playing ? "Pause replay" : stepIndex >= battle.steps.length ? "Replay again" : "Watch replay"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setStepIndex((index) => Math.min(battle.steps.length, index + 1));
                    }}
                    disabled={stepIndex >= battle.steps.length}
                  >
                    Step forward
                  </button>
                </div>
                <ol className="arena-steps" aria-label="Replayed commands">
                  {battle.steps.map((step) => (
                    <li
                      key={step.index}
                      aria-current={step.index === stepIndex ? "step" : undefined}
                      className={step.index === stepIndex ? "arena-step-current" : undefined}
                    >
                      <code>{step.command}</code>
                      {step.damageDealt > 0 ? ` hits for ${step.damageDealt}` : ""}
                    </li>
                  ))}
                </ol>
              </>
            )}

            <h3>What happened</h3>
            {battle?.won === true && (
              <p className="lesson-pass">
                Station awake, Cadet. The quest is complete.{" "}
                <Link href="/progress">See your progress</Link> · <Link href="/">Level map</Link>
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

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}
