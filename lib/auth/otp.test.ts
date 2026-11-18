import { describe, expect, it } from "vitest";
import {
  MAX_CODES_PER_HOUR,
  OTP_EXPIRY_MS,
  OTP_MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  canIssueOtp,
  hashOtpCode,
  issueOtp,
  latestLiveOtp,
  verifyOtpAttempt,
  type OtpRecord,
} from "./otp";

const EMAIL = "parent@example.com";
const IP = "iphash1";

function historyAt(nowMs: number, n: number, gapMs = 10 * 60 * 1000): OtpRecord[] {
  let history: OtpRecord[] = [];
  for (let i = 0; i < n; i++) {
    const at = nowMs - (n - 1 - i) * gapMs;
    const out = issueOtp(history, { email: EMAIL, purpose: "verify", ipHash: IP, nowMs: at });
    history = out.updated;
  }
  return history;
}

describe("OTP lifecycle (spec §7 acceptance)", () => {
  it("expires after 10 minutes and is single use", () => {
    const t0 = 1_000_000;
    const { updated, issued } = issueOtp([], {
      email: EMAIL,
      purpose: "verify",
      ipHash: IP,
      nowMs: t0,
      code: "123456",
      salt: "s1",
    });
    expect(issued.code).toBe("123456");
    expect(issued.record.expiresAtMs).toBe(t0 + OTP_EXPIRY_MS);
    const ok = verifyOtpAttempt(updated[0], "123456", t0 + 1000);
    expect(ok.ok).toBe(true);
    expect(ok.record.used).toBe(true);
    // Second use of the same code fails.
    expect(verifyOtpAttempt(ok.record, "123456", t0 + 2000).ok).toBe(false);
    // Untouched code past expiry fails.
    const fresh = issueOtp([], {
      email: EMAIL,
      purpose: "verify",
      ipHash: IP,
      nowMs: t0,
      code: "654321",
      salt: "s2",
    });
    expect(verifyOtpAttempt(fresh.updated[0], "654321", t0 + OTP_EXPIRY_MS + 1).ok).toBe(false);
  });

  it("5 wrong attempts kill the code", () => {
    const t0 = 2_000_000;
    const { updated } = issueOtp([], {
      email: EMAIL,
      purpose: "verify",
      ipHash: IP,
      nowMs: t0,
      code: "111111",
      salt: "s3",
    });
    let record = updated[0];
    for (let i = 1; i <= OTP_MAX_ATTEMPTS; i++) {
      const r = verifyOtpAttempt(record, "000000", t0 + i * 1000);
      record = r.record;
      if (i < OTP_MAX_ATTEMPTS) {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("mismatch");
      } else {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe("locked");
      }
    }
    expect(record.invalidated).toBe(true);
    // The right code no longer works after the lock.
    expect(verifyOtpAttempt(record, "111111", t0 + 9999).ok).toBe(false);
  });

  it("60 s resend cooldown per email", () => {
    const t0 = 3_000_000;
    const history = historyAt(t0, 1, 0);
    const denied = canIssueOtp(history, EMAIL, IP, t0 + RESEND_COOLDOWN_MS - 1000);
    expect(denied.allowed).toBe(false);
    const allowed = canIssueOtp(history, EMAIL, IP, t0 + RESEND_COOLDOWN_MS + 1);
    expect(allowed.allowed).toBe(true);
  });

  it("max 5 codes per hour per email and per IP", () => {
    const t0 = 4_000_000;
    const emailHistory = historyAt(t0, MAX_CODES_PER_HOUR, 5 * 60 * 1000);
    expect(canIssueOtp(emailHistory, EMAIL, IP, t0 + 1000).allowed).toBe(false);
    const otherEmail = historyAt(t0, MAX_CODES_PER_HOUR, 5 * 60 * 1000).map((r) => ({
      ...r,
      email: "other@example.com",
    }));
    expect(canIssueOtp(otherEmail, "other@example.com", IP, t0 + 1000).allowed).toBe(false);
  });

  it("a new code invalidates the old one and latestLiveOtp follows it", () => {
    const t0 = 5_000_000;
    const first = issueOtp([], {
      email: EMAIL,
      purpose: "verify",
      ipHash: IP,
      nowMs: t0,
      code: "111111",
      salt: "a",
    });
    const second = issueOtp(first.updated, {
      email: EMAIL,
      purpose: "verify",
      ipHash: IP,
      nowMs: t0 + RESEND_COOLDOWN_MS + 1,
      code: "222222",
      salt: "b",
    });
    expect(second.updated.find((r) => r.id === first.issued.record.id)?.invalidated).toBe(true);
    // Old code fails as invalidated even with the right digits.
    const old = second.updated.find((r) => r.id === first.issued.record.id)!;
    const attempt = verifyOtpAttempt(old, "111111", t0 + RESEND_COOLDOWN_MS + 2);
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("invalidated");
    expect(latestLiveOtp(second.updated, EMAIL, "verify", t0 + RESEND_COOLDOWN_MS + 2)?.id).toBe(
      second.issued.record.id,
    );
    expect(hashOtpCode("222222", "b")).toBe(second.issued.record.codeHash);
  });
});
