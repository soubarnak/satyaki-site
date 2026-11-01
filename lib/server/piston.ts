// Piston execute client (ADR-0003). Fixed request shape, none of it
// client-selectable: language java 15.0.2, one file Main.java, empty
// stdin, the ADR-0003 time and memory budget. The 9500 ms abort keeps
// every run inside the CR-004 route ceiling with a mapped
// runner-unavailable result instead of a dropped request.

import {
  parsePistonResponse,
  type PistonExecuteResponse,
} from "./classify";
import type { RunnerEnv } from "./env";

export const COMPILE_TIMEOUT_MS = 3000;
export const RUN_TIMEOUT_MS = 5000;
export const COMPILE_MEMORY_BYTES = 512 * 1024 * 1024;
export const RUN_MEMORY_BYTES = 256 * 1024 * 1024;
export const RUNNER_ABORT_MS = 9500;

/** Thrown for every runner-side failure: network, abort, HTTP error, bad body. */
export class RunnerUnavailableError extends Error {
  constructor() {
    super("runner unavailable");
    this.name = "RunnerUnavailableError";
  }
}

export interface ExecuteResult {
  response: PistonExecuteResponse;
  /** Server-measured execute round trip (FR-005 run duration). */
  durationMs: number;
}

type FetchFn = typeof fetch;

/**
 * Execute one learner program on the runner. `abortMs` is injectable only
 * so route tests can fault-inject a hang without waiting out the real
 * budget; production always uses RUNNER_ABORT_MS.
 */
export async function executeProgram(
  env: RunnerEnv,
  program: string,
  options: { fetchFn?: FetchFn; abortMs?: number; now?: () => number } = {},
): Promise<ExecuteResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const started = now();
  let raw: unknown;
  try {
    const res = await fetchFn(`${env.url}/api/v2/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Runner-Key": env.key,
      },
      body: JSON.stringify({
        language: "java",
        version: "15.0.2",
        files: [{ name: "Main.java", content: program }],
        stdin: "",
        compile_timeout: COMPILE_TIMEOUT_MS,
        run_timeout: RUN_TIMEOUT_MS,
        compile_memory_limit: COMPILE_MEMORY_BYTES,
        run_memory_limit: RUN_MEMORY_BYTES,
      }),
      signal: AbortSignal.timeout(options.abortMs ?? RUNNER_ABORT_MS),
    });
    if (!res.ok) throw new RunnerUnavailableError();
    raw = await res.json();
  } catch (error) {
    if (error instanceof RunnerUnavailableError) throw error;
    throw new RunnerUnavailableError();
  }
  const response = parsePistonResponse(raw);
  if (!response) throw new RunnerUnavailableError();
  return { response, durationMs: Math.max(0, now() - started) };
}
