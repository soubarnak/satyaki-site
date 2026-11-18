// Module Web Worker entry for Cadet Java Missions (issue #64, spec §3).
// Created lazily on the first Java Mission entry, never on `/`. The one
// ShipSim lives here; Ship calls are synchronous in-worker interpreter calls
// against it. Main thread receives one batched result per Run press and replays.

import { validateJavaRunRequest } from "@/lib/java-worker-binding";
import { JAVA_WORKER_TIMEOUT_MS } from "@/lib/java-worker-config";
import { emptyJavaResult, type JavaRunResult } from "@/lib/java-trace";
import { runCadetJava, runJavaTick } from "@/lib/java-interpreter";
import type { ArenaRadarSnapshot } from "@/lib/java-worker-binding";

interface WorkerRequest {
  id: number;
  kind?: "run" | "tick";
  code: string;
  layout?: unknown;
  ship?: { x: number; y: number; z: number; heading: string; energy: number; shield: boolean; crystals: number };
  radar?: ArenaRadarSnapshot;
}

async function handleRun(message: WorkerRequest): Promise<JavaRunResult> {
  if (message.kind === "tick") {
    if (!message.ship || !message.radar) {
      return emptyJavaResult("error", "InvalidRequest", "Tick needs ship and radar.");
    }
    const tick = runJavaTick({ code: message.code, ship: message.ship, radar: message.radar });
    return {
      status: tick.error ? "error" : "ok",
      trace: tick.trace,
      stdout: tick.stdout,
      error: tick.error,
      stopReason: tick.error ? "error" : "none",
      initial: { ship: { ...message.ship }, entities: {} },
      bounds: { maxX: 12, maxY: 5, maxZ: 12 },
    };
  }
  const validated = validateJavaRunRequest({ code: message.code, layout: message.layout });
  if (!validated.ok) {
    return emptyJavaResult("error", "InvalidRequest", validated.message);
  }
  try {
    // The interpreter owns its in-worker ShipSim and reports the run header
    // from the sim that ran; no second sim, no payload conversion.
    return runCadetJava({ code: validated.request.code, layout: validated.request.layout });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return emptyJavaResult("time-cap", "WorkerError", text.slice(0, 200));
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  void handleRun(message)
    .then((result) => self.postMessage({ id: message.id, ...result }))
    .catch((error: unknown) =>
      self.postMessage({
        id: message.id,
        ...emptyJavaResult("time-cap", "WorkerError", String(error).slice(0, 200)),
      }),
    );
};

export { JAVA_WORKER_TIMEOUT_MS };
