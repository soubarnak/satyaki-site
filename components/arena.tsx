"use client";

// Arena battles (ADR-0014, spec §9): Account-only on_tick battles over
// five drone waves, replayed through the cockpit playback model.
// Glossary: Arena, Account, Cadet, Ship, World State.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ARENA_TICK_CAP,
  ARENA_WAVES,
  arenaHudLabel,
  arenaStepTicks,
  arenaWorldAt,
  runArenaBattleAsync,
  type ArenaBattleResult,
  type ArenaFrame,
} from "@/lib/arena";
import {
  ARENA_COMMANDS,
  ARENA_JAVA_STARTER,
  ARENA_PYTHON_STARTER,
  ARENA_SIGN_IN_LINE,
  arenaAccountOpen,
  arenaBattleLine,
  arenaShouldRecord,
  arenaTickErrorLine,
} from "@/lib/arena-view";
import { runJavaTick } from "@/lib/java-interpreter";
import { normalizeArenaAction } from "@/lib/arena";
import { runPythonTick } from "@/lib/python-worker-client";
import { browserProgressV2Storage } from "@/lib/progress-v2-storage";
import { recordArenaBattleV2, type CadetLanguage } from "@/lib/progress";
import { Bolt } from "./bolt";

/** Milliseconds per tick at 1x; cockpit model is 650 ms per frame. */
const TICK_MS = 650;

type SessionState = "checking" | "in" | "out";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Arena() {
  const [session, setSession] = useState<SessionState>("checking");
  const [language, setLanguage] = useState<CadetLanguage>("python");
  const [code, setCode] = useState(ARENA_PYTHON_STARTER);
  const [running, setRunning] = useState(false);
  const [boltLine, setBoltLine] = useState("Fly five drone waves, Cadet.");
  const [battle, setBattle] = useState<ArenaBattleResult | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [record, setRecord] = useState<{ played: number; won: number; bestWave: number } | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      const arena = browserProgressV2Storage().load().arena;
      return { played: arena.played, won: arena.won, bestWave: arena.bestWave };
    } catch {
      return null;
    }
  });
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => {
    let live = true;
    fetch("/api/auth/me")
      .then((res) => {
        if (live) setSession(res.ok ? "in" : "out");
      })
      .catch(() => {
        if (live) setSession("out");
      });
    cancelRef.current = { cancelled: false };
    return () => {
      live = false;
      cancelRef.current.cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playing || battle === null) return;
    const timer = window.setInterval(() => {
      setCursor((current) => {
        const next = Math.min(battle.frames.length - 1, current + 1);
        if (next >= battle.frames.length - 1) setPlaying(false);
        return next;
      });
    }, TICK_MS / speed);
    return () => window.clearInterval(timer);
  }, [playing, battle, speed]);

  function switchLanguage(next: CadetLanguage): void {
    setLanguage(next);
    setCode(next === "python" ? ARENA_PYTHON_STARTER : ARENA_JAVA_STARTER);
    setBattle(null);
    setCursor(-1);
    setPlaying(false);
    setBoltLine("Fly five drone waves, Cadet.");
  }

  async function handleRun(): Promise<void> {
    if (running || session !== "in") return;
    const snapshot = code;
    const lang = language;
    const cancel = { cancelled: false };
    cancelRef.current = cancel;
    setRunning(true);
    setPlaying(false);
    setBattle(null);
    setCursor(-1);
    setBoltLine("Battle flying, Cadet.");
    try {
      const started = Date.now();
      const result = await runArenaBattleAsync(async (ship, radar) => {
        if (cancel.cancelled) throw { line: 0, excType: "Abandoned", message: "abandoned" };
        if (lang === "java") {
          const tick = runJavaTick({
            code: snapshot,
            ship: { ...ship },
            radar: {
              droneDistance: radar.drone_distance,
              droneDirection: radar.drone_direction,
              wave: radar.wave,
              dronesLeft: radar.drones_left,
            },
          });
          if (tick.error) throw tick.error;
          if (!tick.valid || tick.normalized === null) return tick.action ?? "wait";
          return tick.normalized;
        }
        const tick = await runPythonTick({
          code: snapshot,
          ship: { ...ship },
          radar: { ...radar },
        });
        if (tick.error) throw tick.error;
        if (!tick.valid || typeof tick.action !== "string") return tick.action ?? "wait";
        return normalizeArenaAction(tick.action).normalized ?? tick.action;
      }, cancel);
      if (result === null || cancel.cancelled) return;
      setBattle(result);
      const reduced = prefersReducedMotion();
      setCursor(reduced ? result.frames.length - 1 : -1);
      setPlaying(!reduced && result.frames.length > 0);
      if (result.reason === "error" && result.error) {
        setBoltLine(arenaTickErrorLine(result.error, lang));
      } else {
        setBoltLine(arenaBattleLine(result));
      }
      void started;
      if (arenaShouldRecord(true)) {
        const storage = browserProgressV2Storage();
        const current = storage.load();
        const next = recordArenaBattleV2(current, { won: result.won, wave: result.wave, language: lang });
        storage.save(next);
        setRecord({ played: next.arena.played, won: next.arena.won, bestWave: next.arena.bestWave });
      }
    } finally {
      if (!cancel.cancelled) setRunning(false);
    }
  }

  const open = arenaAccountOpen({ loggedIn: session === "in" });
  const world = battle === null ? arenaWorldAt([], -1) : arenaWorldAt(battle.frames, cursor);
  const steps = battle === null ? [] : arenaStepTicks(battle.frames);
  const frame: ArenaFrame | null =
    battle !== null && cursor >= 0 ? battle.frames[Math.min(cursor, battle.frames.length - 1)] ?? null : null;

  return (
    <>
      <h1>Arena</h1>
      <p className="map-intro">Five drone waves, one tick function, Cadet.</p>

      <div className="bolt-row">
        <Bolt size={72} />
        <p className="bolt-bubble" role="status">
          {session === "checking" ? "Checking your Account, Cadet." : open ? boltLine : ARENA_SIGN_IN_LINE}
        </p>
      </div>

      {session === "checking" ? (
        <p>Loading the arena, Cadet.</p>
      ) : !open ? (
        <p>
          The Arena needs an Account, Cadet. <Link href="/login">Sign in</Link> to fly. No guest battles.
        </p>
      ) : (
        <div className="lesson-grid">
          <section aria-label="Mission">
            <h2>Mission</h2>
            <p>
              Write <code>on_tick</code> ({language === "python" ? "Python" : "Java"}). It runs once per tick for up
              to {ARENA_TICK_CAP} ticks across {ARENA_WAVES} waves and returns exactly one action string. Invalid
              returns waste the tick.
            </p>
            <h3>Tick actions</h3>
            <ul className="arena-commands">
              {ARENA_COMMANDS.map((entry) => (
                <li key={entry.command}>
                  <code>{entry.command}</code> — {entry.meaning}
                </li>
              ))}
            </ul>
            <p className="lesson-goal-output">
              5 waves · wave n fields n+1 drones · shield stops one drone then drops · laser breaks the drone ahead ·
              energy refills to 50 per wave · win clears wave 5.
            </p>
            {record !== null && (
              <p className="lesson-goal-output" aria-label="Arena record">
                Battles {record.played} · won {record.won} · best wave {record.bestWave}
              </p>
            )}
          </section>

          <section aria-label="Code and result">
            <div className="lesson-controls" role="group" aria-label="Language">
              <button type="button" onClick={() => switchLanguage("python")} disabled={language === "python"}>
                Python
              </button>
              <button type="button" onClick={() => switchLanguage("java")} disabled={language === "java"}>
                Java
              </button>
            </div>
            <label className="editor-label" htmlFor="arena-editor">
              {language === "python" ? "Your Python program" : "Your Java program"}
            </label>
            <textarea
              id="arena-editor"
              className="lesson-editor"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={14}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            <div className="lesson-controls">
              <button type="button" onClick={() => void handleRun()} disabled={running}>
                {running ? "Flying…" : "Fly"}
              </button>
            </div>

            <h3>Battle replay</h3>
            <p className="lesson-goal-output" aria-label="Battle state">
              {battle === null
                ? "Press Fly to start wave 1."
                : arenaHudLabel(world, cursor, battle.frames.length)}
            </p>
            <p className="lesson-goal-output" aria-label="Battle detail">
              {battle === null
                ? "Ship holds west while drones cross from the east edge."
                : frame === null
                  ? `Wave ${world.wave}: ${world.drones.length} drones left.`
                  : `Tick ${frame.tick} wave ${frame.wave}: ${frame.valid ? frame.normalized : "wasted tick"} — ${frame.dronesLeft} drones left.`}
            </p>

            {battle !== null && battle.frames.length > 0 && (
              <>
                <div className="lesson-controls arena-replay-controls">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setCursor((index) => Math.max(-1, index - 1));
                    }}
                    disabled={cursor <= -1}
                  >
                    Step back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (playing) {
                        setPlaying(false);
                      } else if (cursor >= battle.frames.length - 1) {
                        setCursor(-1);
                        setPlaying(true);
                      } else {
                        setPlaying(true);
                      }
                    }}
                  >
                    {playing ? "Pause replay" : cursor >= battle.frames.length - 1 ? "Replay again" : "Watch replay"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setCursor((index) => Math.min(battle.frames.length - 1, index + 1));
                    }}
                    disabled={cursor >= battle.frames.length - 1}
                  >
                    Step forward
                  </button>
                  <button type="button" onClick={() => setSpeed(1)} disabled={speed === 1}>
                    1x
                  </button>
                  <button type="button" onClick={() => setSpeed(2)} disabled={speed === 2}>
                    2x
                  </button>
                  <button type="button" onClick={() => setSpeed(4)} disabled={speed === 4}>
                    4x
                  </button>
                </div>
                <label className="editor-label" htmlFor="arena-scrubber">
                  Tick scrubber{steps.length > 0 ? ` · ${steps.length} Ship ticks` : ""}
                </label>
                <input
                  id="arena-scrubber"
                  type="range"
                  min={-1}
                  max={battle.frames.length - 1}
                  value={cursor}
                  onChange={(event) => {
                    setPlaying(false);
                    setCursor(Number(event.target.value));
                  }}
                />
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
