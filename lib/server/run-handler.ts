// Run route orchestration (IR-003): rate-limit, validate, execute,
// classify. Kept out of app/api/run/route.ts so route integration tests
// can drive it against a stub Piston server with injected deps
// (ADR-0007). No test calls the live runner.

import { createHash } from "node:crypto";
import {
  capStream,
  classifyRun,
  stripRunnerPaths,
  type RunClass,
} from "./classify";
import { readRunnerEnv, type RunnerEnv } from "./env";
import {
  RunnerUnavailableError,
  executeProgram,
  type ExecuteResult,
} from "./piston";
import { createRateLimiter, type RateLimiter } from "./rate-limit";

/** DR-001: program text length bounds, inclusive. */
export const MIN_PROGRAM_CHARS = 1;
export const MAX_PROGRAM_CHARS = 20000;

export interface RunResponseBody {
  resultClass: RunClass;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  /** Server-measured execute round trip (FR-005). */
  durationMs: number;
}

export interface RunHandlerDeps {
  limiter: RateLimiter;
  readEnv: () => RunnerEnv | null;
  execute: (env: RunnerEnv, program: string) => Promise<ExecuteResult>;
  now: () => number;
}

function defaultDeps(): RunHandlerDeps {
  return {
    limiter: createRateLimiter(),
    readEnv: () => readRunnerEnv(),
    execute: (env, program) => executeProgram(env, program),
    now: Date.now,
  };
}

// ADR-0005: client key is the SHA-256 hash of the client IP from
// Traefik's forwarded header; raw IPs are never logged or persisted.
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function classified(
  resultClass: RunClass,
  stdout: string,
  stderr: string,
  durationMs: number,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  const out = capStream(stdout);
  const err = capStream(stripRunnerPaths(stderr));
  const body: RunResponseBody = {
    resultClass,
    stdout: out.text,
    stderr: err.text,
    stdoutTruncated: out.truncated,
    stderrTruncated: err.truncated,
    durationMs,
  };
  return Response.json(body, { status, headers: extraHeaders });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function createRunHandler(
  deps: RunHandlerDeps = defaultDeps(),
): (request: Request) => Promise<Response> {
  return async (request) => {
    // ADR-0005 counting order: every request counts before validation,
    // so malformed floods consume quota too.
    const verdict = deps.limiter.recordRequest(clientKey(request), deps.now());
    if (!verdict.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(verdict.retryAfterMs / 1000));
      return classified("busy", "", "", 0, 429, {
        "Retry-After": String(retryAfterSeconds),
      });
    }

    let program: unknown;
    try {
      const body: unknown = await request.json();
      program =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>).program
          : undefined;
    } catch {
      return badRequest("Send the program as JSON text.");
    }
    // DR-001: rejected with a length message and no run submitted.
    if (
      typeof program !== "string" ||
      program.length < MIN_PROGRAM_CHARS ||
      program.length > MAX_PROGRAM_CHARS
    ) {
      return badRequest(
        `Your program must be between ${MIN_PROGRAM_CHARS} and ${MAX_PROGRAM_CHARS} characters long.`,
      );
    }

    const env = deps.readEnv();
    if (!env) return classified("runner-unavailable", "", "", 0);

    if (!deps.limiter.tryAcquireSlot()) {
      return classified("busy", "", "", 0, 429, { "Retry-After": "1" });
    }
    try {
      const { response, durationMs } = await deps.execute(env, program);
      const resultClass = classifyRun(response);
      // Compile errors live in the compile phase stderr; everything else
      // reports the run phase stderr.
      const stderr =
        resultClass === "compile" && response.compile
          ? response.compile.stderr
          : response.run.stderr;
      return classified(
        resultClass,
        response.run.stdout,
        stderr,
        durationMs,
      );
    } catch (error) {
      if (error instanceof RunnerUnavailableError) {
        return classified("runner-unavailable", "", "", 0);
      }
      throw error;
    } finally {
      deps.limiter.releaseSlot();
    }
  };
}
