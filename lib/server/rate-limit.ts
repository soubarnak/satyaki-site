// In-memory sliding-window rate limiter (ADR-0005, NFR-009). Pure and
// clock-injected: every method takes the current time, so tests drive it
// with a fake clock and no HTTP. Keys are SHA-256 hashes of client IPs;
// the hashing happens in the run handler and raw IPs never reach here.

export const WINDOW_MS = 60_000;
export const MAX_RUNS_PER_WINDOW = 20;
export const MAX_CONCURRENT_RUNS = 4;

export type WindowVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export interface RateLimiter {
  /**
   * Count one run-route request for the key at `nowMs` (ADR-0005 counting
   * order: before input validation). The 21st request inside the window
   * is refused and does not itself extend the window.
   */
  recordRequest(key: string, nowMs: number): WindowVerdict;
  /**
   * Take one of the shared runner slots. Returns false when all slots are
   * busy; there is no queue (ADR-0005).
   */
  tryAcquireSlot(): boolean;
  /** Return a slot taken by tryAcquireSlot. */
  releaseSlot(): void;
}

export function createRateLimiter(): RateLimiter {
  const windows = new Map<string, number[]>();
  let activeSlots = 0;

  return {
    recordRequest(key, nowMs) {
      const cutoff = nowMs - WINDOW_MS;
      const recent = (windows.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= MAX_RUNS_PER_WINDOW) {
        windows.set(key, recent);
        return { allowed: false, retryAfterMs: recent[0] + WINDOW_MS - nowMs };
      }
      recent.push(nowMs);
      windows.set(key, recent);
      return { allowed: true };
    },
    tryAcquireSlot() {
      if (activeSlots >= MAX_CONCURRENT_RUNS) return false;
      activeSlots += 1;
      return true;
    },
    releaseSlot() {
      if (activeSlots > 0) activeSlots -= 1;
    },
  };
}
