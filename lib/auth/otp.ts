// OTP lifecycle (spec §7, issues #32/#35). Pure core: clock-injected,
// no framework or Node imports except node:crypto for hashing.
// Glossary: Account. OTPs are 6 digits, 10-minute expiry, single use,
// hashed at rest; new code invalidates the old.

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_DIGITS = 6;
export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODES_PER_HOUR = 5;
const OTP_HOUR_MS = 60 * 60 * 1000;

export type OtpPurpose = "verify" | "reset" | "delete" | "email-change";

export interface OtpRecord {
  id: string;
  /** Normalized parent/guardian email the code was sent to. */
  email: string;
  purpose: OtpPurpose;
  /** SHA-256 hex of salt + code; the raw code never rests. */
  codeHash: string;
  salt: string;
  createdAtMs: number;
  expiresAtMs: number;
  attempts: number;
  used: boolean;
  invalidated: boolean;
  /** SHA-256 hex of the requesting IP (raw IPs never stored). */
  ipHash: string;
}

export interface OtpIssue {
  record: OtpRecord;
  /** Raw 6-digit code; sent once via sendOtpEmail(), never stored. */
  code: string;
}

export type OtpIssueDenied =
  | { allowed: false; reason: "cooldown"; retryAfterMs: number }
  | { allowed: false; reason: "rate-limited"; retryAfterMs: number };

function randomSalt(bytes = 16): string {
  return randomInt(0, 2 ** 31).toString(16) + Date.now().toString(16) + bytes.toString(16);
}

/** 6-digit code with leading zeros kept; randomInt is injectable in tests. */
export function generateOtpCode(rand: (min: number, max: number) => number = randomInt): string {
  const n = rand(0, 1_000_000);
  return String(n).padStart(OTP_DIGITS, "0");
}

/** Hash one code with its salt for storage. */
export function hashOtpCode(code: string, salt: string): string {
  return createHash("sha256").update(salt + ":" + code).digest("hex");
}

function codesEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isLive(record: OtpRecord, nowMs: number): boolean {
  return !record.used && !record.invalidated && nowMs < record.expiresAtMs;
}

/**
 * Whether a new code may be issued now. Counts only codes created in the
 * last hour for this email and for this IP hash (spec §7: max 5/hour per
 * email and per IP). Returns cooldown when the newest live code is under
 * 60 s old (spec §7: 60 s resend cooldown).
 */
export function canIssueOtp(
  history: readonly OtpRecord[],
  email: string,
  ipHash: string,
  nowMs: number,
): { allowed: true } | OtpIssueDenied {
  const cutoff = nowMs - OTP_HOUR_MS;
  const emailRecent = history.filter(
    (r) => r.email === email && r.createdAtMs > cutoff,
  );
  if (emailRecent.length >= MAX_CODES_PER_HOUR) {
    const oldest = Math.min(...emailRecent.map((r) => r.createdAtMs));
    return {
      allowed: false,
      reason: "rate-limited",
      retryAfterMs: oldest + OTP_HOUR_MS - nowMs,
    };
  }
  const ipRecent = history.filter((r) => r.ipHash === ipHash && r.createdAtMs > cutoff);
  if (ipRecent.length >= MAX_CODES_PER_HOUR) {
    const oldest = Math.min(...ipRecent.map((r) => r.createdAtMs));
    return {
      allowed: false,
      reason: "rate-limited",
      retryAfterMs: oldest + OTP_HOUR_MS - nowMs,
    };
  }
  const live = history
    .filter((r) => r.email === email && isLive(r, nowMs))
    .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
  if (live && nowMs - live.createdAtMs < RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterMs: live.createdAtMs + RESEND_COOLDOWN_MS - nowMs,
    };
  }
  return { allowed: true };
}

let otpSeq = 0;

/**
 * Issue a new code: a new code invalidates every previous live code for
 * the same email + purpose (spec §7). Returns the stored record plus the
 * raw code for the mailer. The caller appends record to history.
 */
export function issueOtp(
  history: readonly OtpRecord[],
  opts: {
    email: string;
    purpose: OtpPurpose;
    ipHash: string;
    nowMs: number;
    code?: string;
    salt?: string;
    id?: string;
  },
): { updated: OtpRecord[]; issued: OtpIssue } {
  const nowMs = opts.nowMs;
  const code = opts.code ?? generateOtpCode();
  const salt = opts.salt ?? randomSalt();
  const record: OtpRecord = {
    id: opts.id ?? `otp_${nowMs}_${(otpSeq += 1)}`,
    email: opts.email,
    purpose: opts.purpose,
    codeHash: hashOtpCode(code, salt),
    salt,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + OTP_EXPIRY_MS,
    attempts: 0,
    used: false,
    invalidated: false,
    ipHash: opts.ipHash,
  };
  const updated = history.map((r) =>
    r.email === opts.email && r.purpose === opts.purpose && isLive(r, nowMs)
      ? { ...r, invalidated: true }
      : r,
  );
  updated.push(record);
  return { updated, issued: { record, code } };
}

export type OtpVerifyResult =
  | { ok: true; record: OtpRecord }
  | { ok: false; reason: "expired" | "used" | "invalidated" | "mismatch" | "locked"; record: OtpRecord };

/**
 * Verify one code attempt. Wrong attempts count up; the 5th wrong attempt
 * kills the code (spec §7). Success marks single use. Pure: returns the
 * updated record, the caller persists it.
 */
export function verifyOtpAttempt(
  record: OtpRecord,
  code: string,
  nowMs: number,
): OtpVerifyResult {
  if (record.used) return { ok: false, reason: "used", record };
  if (record.invalidated) return { ok: false, reason: "invalidated", record };
  if (nowMs >= record.expiresAtMs) return { ok: false, reason: "expired", record };
  if (record.attempts >= OTP_MAX_ATTEMPTS)
    return { ok: false, reason: "locked", record };
  if (codesEqual(record.codeHash, hashOtpCode(code, record.salt))) {
    return { ok: true, record: { ...record, used: true } };
  }
  const attempts = record.attempts + 1;
  const killed = attempts >= OTP_MAX_ATTEMPTS;
  return {
    ok: false,
    reason: killed ? "locked" : "mismatch",
    record: { ...record, attempts, invalidated: killed ? true : record.invalidated },
  };
}

/** Latest live code for an email + purpose, if any. */
export function latestLiveOtp(
  history: readonly OtpRecord[],
  email: string,
  purpose: OtpPurpose,
  nowMs: number,
): OtpRecord | null {
  const live = history
    .filter((r) => r.email === email && r.purpose === purpose && isLive(r, nowMs))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  return live[0] ?? null;
}
