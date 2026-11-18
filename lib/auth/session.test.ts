import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSession,
  isSessionLive,
  parseSessionToken,
  refreshSession,
  sessionCookie,
} from "./session";
import { checkLoginAllowed, recordLoginFailure, type LoginAttempt } from "./throttle";

describe("sessions (spec §7)", () => {
  it("30-day sliding cookie is httpOnly/Secure/SameSite=Lax; shared omits Max-Age", () => {
    const t0 = 1_000_000;
    const { record, token } = createSession({ accountId: "a", ipHash: "h", nowMs: t0 });
    expect(isSessionLive(record, t0 + 29 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(isSessionLive(record, t0 + 30 * 24 * 60 * 60 * 1000)).toBe(false);
    const cookie = sessionCookie(token, false);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=2592000");
    expect(sessionCookie(token, true)).not.toContain("Max-Age");
    expect(refreshSession(record, t0 + 1000).expiresAtMs).toBe(t0 + 1000 + 30 * 24 * 60 * 60 * 1000);
    const header = `other=1; ${SESSION_COOKIE_NAME}=${token}`;
    expect(parseSessionToken(header)).toBe(token);
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("passwords verify and reject wrong ones", () => {
    const stored = hashPassword("correct horse?");
    expect(verifyPassword("correct horse?", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(verifyPassword("x", "broken")).toBe(false);
  });
});

describe("login throttle (spec §7)", () => {
  it("10 failures lock the Account+IP pair for 15 minutes", () => {
    const t0 = 5_000_000;
    let failures: LoginAttempt[] = [];
    for (let i = 0; i < 10; i++) {
      failures = recordLoginFailure(failures, "acct1", "ip1", t0 + i * 1000);
    }
    const locked = checkLoginAllowed(failures, "acct1", "ip1", t0 + 11 * 1000);
    expect(locked.allowed).toBe(false);
    const after = checkLoginAllowed(failures, "acct1", "ip1", t0 + 16 * 60 * 1000);
    expect(after.allowed).toBe(true);
    // A different IP is not locked.
    expect(checkLoginAllowed(failures, "acct1", "ip2", t0 + 11 * 1000).allowed).toBe(true);
  });
});
