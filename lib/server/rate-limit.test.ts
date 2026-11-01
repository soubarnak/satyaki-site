import { describe, expect, it } from "vitest";
import {
  MAX_CONCURRENT_RUNS,
  MAX_RUNS_PER_WINDOW,
  WINDOW_MS,
  createRateLimiter,
} from "./rate-limit";

describe("sliding window (ADR-0005, NFR-009, fake clock)", () => {
  it("allows 20 runs in the window and refuses run 21", () => {
    const limiter = createRateLimiter();
    for (let i = 1; i <= MAX_RUNS_PER_WINDOW; i++) {
      expect(limiter.recordRequest("key-a", 1000 + i)).toEqual({
        allowed: true,
      });
    }
    const refused = limiter.recordRequest("key-a", 2000);
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      // Retry when the oldest run (at 1001) leaves the window.
      expect(refused.retryAfterMs).toBe(1001 + WINDOW_MS - 2000);
    }
  });

  it("refused requests do not extend the window", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < MAX_RUNS_PER_WINDOW; i++) {
      limiter.recordRequest("key-a", 0);
    }
    for (let i = 0; i < 5; i++) {
      expect(limiter.recordRequest("key-a", WINDOW_MS - 1).allowed).toBe(false);
    }
    expect(limiter.recordRequest("key-a", WINDOW_MS + 1)).toEqual({
      allowed: true,
    });
  });

  it("slides: old runs stop counting once outside 60 s", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < MAX_RUNS_PER_WINDOW; i++) {
      limiter.recordRequest("key-a", i * 1000);
    }
    // At 60.5 s the runs at 0 s has slid out, so one more fits.
    expect(limiter.recordRequest("key-a", 60_500)).toEqual({ allowed: true });
    expect(limiter.recordRequest("key-a", 60_500).allowed).toBe(false);
  });

  it("counts each client key separately", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < MAX_RUNS_PER_WINDOW; i++) {
      limiter.recordRequest("key-a", 0);
    }
    expect(limiter.recordRequest("key-a", 0).allowed).toBe(false);
    expect(limiter.recordRequest("key-b", 0)).toEqual({ allowed: true });
  });
});

describe("concurrency cap (ADR-0005)", () => {
  it("allows 4 simultaneous slots and refuses the 5th until one frees", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < MAX_CONCURRENT_RUNS; i++) {
      expect(limiter.tryAcquireSlot()).toBe(true);
    }
    expect(limiter.tryAcquireSlot()).toBe(false);
    limiter.releaseSlot();
    expect(limiter.tryAcquireSlot()).toBe(true);
  });

  it("release below zero is a no-op", () => {
    const limiter = createRateLimiter();
    limiter.releaseSlot();
    expect(limiter.tryAcquireSlot()).toBe(true);
  });
});
