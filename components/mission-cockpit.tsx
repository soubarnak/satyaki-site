"use client";

// Mission cockpit (issue #69, spec §§3,4,10).
// Glossary: Mission, Pass, Star, Par, Seed, World State, Training Wheels,
// Rosetta Pair, Cadet. Variant C (issue #38): briefing top strip, slim
// Monaco left, wide simulator right, collapsible console drawer below.
// Variant A (issue #44): frame = one executed line, slider plus gold Ship
// ticks, step-back by pure re-fold, 1x = 650 ms with 2x/4x, manual cameras,
// coordinate HUD plus hover inspection. Language toggle Python/Java with
// Training Wheels display. Run presses snapshot the exact editor code and
// grade every Seed through lib/run; only the practice trace replays.

import { useEffect, useMemo, useState } from "react";
import type { Mission } from "@/lib/content";
import {
  clampCursor,
  hudLabel,
  isShipStep,
  playbackWorldAt,
  replayWorldFromLayout,
  shipStepIndices,
  speedDelayMs,
  type PlaybackCamera,
  type PlaybackEvent,
  type PlaybackHeader,
  type PlaybackSpeed,
  type PlaybackWorld,
} from "@/lib/cockpit-playback";
import { browserProgressV2Storage } from "@/lib/progress-v2-storage";
import { emptyProgressV2, localDateString, type CadetLanguage } from "@/lib/progress";
import { generateSeedLayout, ShipSim } from "@/lib/ship-sim";
import { runMission, type RunMissionResult } from "@/lib/run";
import { MissionEditor, doneLinesFor } from "./mission-editor";
import { MissionSimulator } from "./mission-simulator";

function headerFor(mission: Mission): PlaybackHeader {
  const practiceSeed = mission.seedPool[0];
  const { layout } = generateSeedLayout(mission.layout, practiceSeed, practiceSeed);
  const sim = new ShipSim(layout);
  const snapshot = sim.snapshot();
  return {
    initial: {
      ship: { ...snapshot.ship },
      entities: JSON.parse(JSON.stringify(snapshot.entities)) as Record<string, Record<string, unknown>>,
    },
    bounds: { ...snapshot.bounds },
  };
}

function toPlaybackTrace(trace: RunMissionResult["trace"]): PlaybackEvent[] {
  return trace.map((event) => ({
    step: event.step,
    line: event.line,
    kind: "line" as const,
    locals: event.locals,
    shipDelta:
      event.shipDelta === null
        ? null
        : {
            action: event.shipDelta.action,
            blocked: event.shipDelta.blocked,
            reason: event.shipDelta.reason,
            ship: { ...event.shipDelta.ship },
            changed: [...event.shipDelta.changed],
          },
    log: event.log,
  }));
}

export function MissionCockpit({ mission }: { mission: Mission }): React.ReactElement {
  const [language, setLanguage] = useState<CadetLanguage>("python");
  const [pythonCode, setPythonCode] = useState(mission.pythonStarter);
  const [javaCode, setJavaCode] = useState(mission.javaStarter);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunMissionResult | null>(null);
  const [runError, setRunError] = useState("");
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [camera, setCamera] = useState<PlaybackCamera>("top");
  const [azimuth, setAzimuth] = useState(35);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [hintsShown, setHintsShown] = useState(0);

  const code = language === "python" ? pythonCode : javaCode;
  const practiceLayout = useMemo(() => {
    const practiceSeed = mission.seedPool[0];
    return generateSeedLayout(mission.layout, practiceSeed, practiceSeed).layout;
  }, [mission]);
  const initialHeader = useMemo(() => headerFor(mission), [mission]);
  const trace: PlaybackEvent[] = useMemo(
    () => (result === null ? [] : toPlaybackTrace(result.trace)),
    [result],
  );
  const header: PlaybackHeader = useMemo(() => {
    if (result === null) return initialHeader;
    const first = result.trace.length > 0 ? null : null;
    void first;
    // Practice trace header arrives through the folded world; keep the
    // authored practice header so reset matches the start the Cadet sees.
    return initialHeader;
  }, [initialHeader, result]);
  const world: PlaybackWorld = useMemo(() => {
    if (trace.length === 0) return playbackWorldAt(header, trace, cursor);
    const replayed = replayWorldFromLayout(practiceLayout, trace, cursor);
    return {
      ship: {
        x: replayed.ship.x,
        y: replayed.ship.y,
        z: replayed.ship.z,
        heading: replayed.ship.heading,
        energy: replayed.ship.energy,
        shield: replayed.ship.shield,
        crystals: replayed.ship.crystals,
      },
      entities: JSON.parse(JSON.stringify(replayed.entities)) as Record<string, Record<string, unknown>>,
      bounds: { ...replayed.bounds },
    };
  }, [header, trace, cursor, practiceLayout]);
  const gold = useMemo(() => shipStepIndices(trace), [trace]);
  const event = cursor >= 0 && cursor < trace.length ? trace[cursor] : null;

  useEffect(() => {
    if (!playing || trace.length === 0) return;
    const delay = speedDelayMs(speed);
    const timer = setInterval(() => {
      setCursor((current) => {
        const next = clampCursor(current + 1, trace.length);
        if (next >= trace.length - 1) setPlaying(false);
        return next;
      });
    }, delay);
    return () => clearInterval(timer);
  }, [playing, speed, trace.length]);

  async function handleRun(): Promise<void> {
    if (running) return;
    setRunning(true);
    setRunError("");
    setPlaying(false);
    try {
      const storage = browserProgressV2Storage();
      const progress = (() => {
        try {
          return storage.load();
        } catch {
          return emptyProgressV2();
        }
      })();
      const out = await runMission({
        slug: mission.slug,
        language,
        code,
        target: {
          checks: mission.checks,
          par: mission.par,
          star3Concept: mission.star3Concept,
          seedPool: mission.seedPool,
          layout: mission.layout,
        },
        progress,
        conceptName: mission.planetConceptId,
        date: localDateString(new Date()),
      });
      setResult(out);
      setCursor(out.trace.length > 0 ? 0 : -1);
      try {
        storage.save(out.progress);
      } catch {
        // Private mode: the run still replays without persisting.
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Run failed, Cadet. Try again.");
    } finally {
      setRunning(false);
    }
  }

  function switchLanguage(next: CadetLanguage): void {
    setLanguage(next);
    setPlaying(false);
  }

  const doneLines = doneLinesFor(trace, cursor);

  return (
    <div className="cockpit">
      <section aria-label="Briefing" className="cockpit-strip">
        <div>
          <h1>{mission.title}</h1>
          <p>{mission.briefing}</p>
          <ul className="cockpit-objectives">
            {mission.objectives.map((objective) => (
              <li key={objective.text}>{objective.text}</li>
            ))}
          </ul>
        </div>
        <div className="cockpit-strip-side">
          <span className="cockpit-training">Training Wheels: {mission.trainingWheels ?? "full-scaffold"}</span>
          <button
            disabled={hintsShown >= mission.hints.length}
            onClick={() => setHintsShown((n) => Math.min(n + 1, mission.hints.length))}
            type="button"
          >
            Hint {hintsShown}/{mission.hints.length}
          </button>
          {hintsShown > 0 && <p className="cockpit-hint">{mission.hints[hintsShown - 1]}</p>}
        </div>
      </section>

      <div className="cockpit-theatre">
        <div className="cockpit-left">
          <div aria-label="Language" className="cockpit-lang" role="group">
            <button
              className={language === "python" ? "cockpit-on" : ""}
              onClick={() => switchLanguage("python")}
              type="button"
            >
              Python
            </button>
            <button
              className={language === "java" ? "cockpit-on" : ""}
              onClick={() => switchLanguage("java")}
              type="button"
            >
              Java
            </button>
            <button
              disabled={running}
              onClick={() => void handleRun()}
              type="button"
            >
              {running ? "Running…" : "Run"}
            </button>
          </div>
          <MissionEditor
            code={code}
            currentLine={event?.line ?? null}
            language={language}
            onCode={(next) => (language === "python" ? setPythonCode(next) : setJavaCode(next))}
            traceLines={doneLines}
            trainingWheels={mission.trainingWheels ?? "full-scaffold"}
          />
        </div>
        <div className="cockpit-right">
          <p aria-label="Playback position" className="cockpit-hud" role="status">
            {hudLabel(world, cursor, trace.length, event)}
          </p>
          <MissionSimulator
            azimuth={azimuth}
            camera={camera}
            hover={hover}
            onAzimuth={setAzimuth}
            onCamera={setCamera}
            onHover={setHover}
            world={world}
          />
        </div>
      </div>

      <div aria-label="Playback" className="cockpit-transport" role="group">
        <button
          onClick={() => {
            if (trace.length === 0) return;
            if (cursor >= trace.length - 1) setCursor(-1);
            setPlaying((p) => !p);
          }}
          type="button"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setCursor((c) => clampCursor(c - 1, trace.length));
          }}
          type="button"
        >
          Step back
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setCursor((c) => clampCursor(c + 1, trace.length));
          }}
          type="button"
        >
          Step forward
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setCursor(-1);
          }}
          type="button"
        >
          Reset
        </button>
        <button onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))} type="button">
          Speed {speed}x
        </button>
        <label className="cockpit-scrub">
          Frame
          <input
            aria-label="Frame scrubber"
            max={trace.length - 1}
            min={trace.length === 0 ? 0 : -1}
            onChange={(e) => {
              setPlaying(false);
              setCursor(clampCursor(Number(e.target.value), trace.length));
            }}
            type="range"
            value={trace.length === 0 ? 0 : cursor}
          />
        </label>
        <span className="cockpit-ticks" aria-label="Ship steps">
          {trace.length === 0
            ? "Press Run, Cadet."
            : gold.map((index) => (
                <button
                  aria-label={`Ship step at frame ${index + 1}`}
                  className={index === cursor ? "cockpit-on" : ""}
                  key={index}
                  onClick={() => {
                    setPlaying(false);
                    setCursor(index);
                  }}
                  type="button"
                >
                  ◆
                </button>
              ))}
        </span>
      </div>
      {trace.length > 0 && (
        <p className="cockpit-frame-note" aria-live="polite">
          {event
            ? `Frame ${cursor + 1}/${trace.length}: line ${event.line}${isShipStep(event) ? `, Ship step ${event.step}` : ""}${event.log ? `, log: ${event.log}` : ""}`
            : `Reset: before line 1. ${trace.length} frames ready.`}
        </p>
      )}

      <section aria-label="Console" className="cockpit-console">
        <button onClick={() => setConsoleOpen((o) => !o)} type="button">
          Console {consoleOpen ? "▾ collapse" : "▸ expand"}
        </button>
        {consoleOpen && (
          <div className="cockpit-console-body">
            {runError !== "" && <p role="alert">{runError}</p>}
            {result === null && <p>Press Run to see your World State here, Cadet.</p>}
            {result !== null && (
              <>
                <ul className="cockpit-feedback">
                  {result.feedback.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {result.kidLines.length > 0 && (
                  <ul className="cockpit-kid">
                    {result.kidLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {result.result.pass && (
                  <ul className="cockpit-rosetta">
                    <li>Python: {mission.rosetta.python.split("\n")[0]}…</li>
                    <li>Java: {mission.rosetta.java.split("\n")[0]}…</li>
                    <li>{mission.rosetta.note}</li>
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
