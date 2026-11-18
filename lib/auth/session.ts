// Sessions (spec §7, issue #35). Pure core: clock-injected token records
// plus cookie serialization. Sliding 30-day cookie, httpOnly, Secure,
// SameSite=Lax, no remember-me. Unlimited concurrent sessions.

import { randomBytes } from "node:crypto";
import { sha256Hex } from "./password";

export const SESSION_COOKIE_NAME = "satyaki_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface SessionRecord {
  id: string;
  /** SHA-256 hex of the raw token; the raw token lives only in the cookie. */
  tokenHash: string;
  accountId: string;
  createdAtMs: number;
  expiresAtMs: number;
  lastSeenAtMs: number;
  /** Shared-computer mode: ends at browser close; logout wipes local cache. */
  sharedComputer: boolean;
  ipHash: string;
  revoked: boolean;
}

let sessionSeq = 0;

export interface IssuedSession {
  record: SessionRecord;
  /** Raw token for the Set-Cookie value; stored only as a hash. */
  token: string;
}

/** Create one session; callers persist the record and set the cookie. */
export function createSession(opts: {
  accountId: string;
  ipHash: string;
  nowMs: number;
  sharedComputer?: boolean;
  token?: string;
}): IssuedSession {
  const token = opts.token ?? randomBytes(32).toString("base64url");
  const record: SessionRecord = {
    id: `sess_${opts.nowMs}_${(sessionSeq += 1)}`,
    tokenHash: sha256Hex(token),
    accountId: opts.accountId,
    createdAtMs: opts.nowMs,
    expiresAtMs: opts.nowMs + SESSION_TTL_MS,
    lastSeenAtMs: opts.nowMs,
    sharedComputer: opts.sharedComputer ?? false,
    ipHash: opts.ipHash,
    revoked: false,
  };
  return { record, token };
}

/** Live when not revoked and not past expiry at nowMs. */
export function isSessionLive(record: SessionRecord, nowMs: number): boolean {
  return !record.revoked && nowMs < record.expiresAtMs;
}

/**
 * Sliding refresh on activity (spec §7): extend expiry to now + 30 days.
 * Returns the updated record; the caller re-sets the cookie.
 */
export function refreshSession(record: SessionRecord, nowMs: number): SessionRecord {
  return { ...record, expiresAtMs: nowMs + SESSION_TTL_MS, lastSeenAtMs: nowMs };
}

/** Cookie for a raw token. Secure always per spec; shared-computer omits Max-Age. */
export function sessionCookie(token: string, sharedComputer: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (!sharedComputer) parts.push(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  return parts.join("; ");
}

/** Clearing cookie on logout. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Parse the session token from a Cookie header. */
export function parseSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) {
      const value = rest.join("=").trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
