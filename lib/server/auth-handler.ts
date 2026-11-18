// Auth route orchestration (spec §7). Kept out of app/api/auth/*/route.ts
// so route integration tests drive it with a stub mailer and memory store
// (ADR-0007 pattern from run-handler). No test calls live Resend/Postgres.

import { createHash } from "node:crypto";
import { canIssueOtp, issueOtp, verifyOtpAttempt, type OtpPurpose } from "@/lib/auth/otp";
import { hashPassword, sha256Hex, verifyPassword } from "@/lib/auth/password";
import {
  GENERIC_LOGIN_ERROR,
  checkLoginAllowed,
  recordLoginFailure,
} from "@/lib/auth/throttle";
import {
  clearSessionCookie,
  createSession,
  isSessionLive,
  parseSessionToken,
  refreshSession,
  sessionCookie,
} from "@/lib/auth/session";
import {
  cancelDeletionOnLogin,
  isGraceExpired,
  isUsernameReserved,
  requestDeletion,
  sweepAccounts,
} from "@/lib/auth/deletion";
import {
  normalizeEmail,
  normalizeUsername,
  validateConsent,
  validateParentEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth/validation";
import type { OtpMailer } from "@/lib/auth/mailer";
import { newAccountId, type AccountRecord, type AuthStore } from "@/lib/auth/store";
import { mergeProgressV2, sanitizeProgressV2 } from "@/lib/progress";

export interface AuthHandlerDeps {
  store: AuthStore;
  mailer: OtpMailer | null;
  now: () => number;
}

export interface Authed {
  account: AccountRecord;
  tokenHash: string;
  sharedComputer: boolean;
  refreshedCookie: string | null;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers });
}

function bad(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function clientIpHash(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null) return body as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/** Session lookup + sliding refresh. Returns null when no live session. */
export async function getAuthed(
  store: AuthStore,
  request: Request,
  nowMs: number,
): Promise<Authed | null> {
  const token = parseSessionToken(request.headers.get("cookie"));
  if (!token) return null;
  const tokenHash = sha256Hex(token);
  const session = await store.findSessionByTokenHash(tokenHash);
  if (!session || !isSessionLive(session, nowMs)) return null;
  const account = await store.findAccountById(session.accountId);
  if (!account) return null;
  if (account.deletionRequestedAtMs !== null && isGraceExpired(account, nowMs)) return null;
  const refreshed = refreshSession(session, nowMs);
  await store.saveSession(refreshed);
  return {
    account,
    tokenHash,
    sharedComputer: session.sharedComputer,
    refreshedCookie: sessionCookie(token, session.sharedComputer),
  };
}

/** Per-IP register flood guard (build choice): 20/hour per IP. */
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_PER_HOUR = 20;
const registerHits = new Map<string, number[]>();

export function clearRegisterRateState(): void {
  registerHits.clear();
}

function registerAllowed(ipHash: string, nowMs: number): { allowed: boolean; retryAfterMs: number } {
  const cutoff = nowMs - REGISTER_WINDOW_MS;
  const recent = (registerHits.get(ipHash) ?? []).filter((t) => t > cutoff);
  if (recent.length >= REGISTER_MAX_PER_HOUR) {
    registerHits.set(ipHash, recent);
    return { allowed: false, retryAfterMs: recent[0] + REGISTER_WINDOW_MS - nowMs };
  }
  recent.push(nowMs);
  registerHits.set(ipHash, recent);
  return { allowed: true, retryAfterMs: 0 };
}

export function createAuthHandlers(deps: AuthHandlerDeps) {
  const { store, mailer } = deps;
  const now = deps.now ?? Date.now;

  async function requireMailer(): Promise<OtpMailer | Response> {
    if (!mailer) return json({ error: "Email is not configured." }, 503);
    return mailer;
  }

  return {
    async register(request: Request): Promise<Response> {
      const nowMs = now();
      const ipHash = clientIpHash(request);
      const gate = registerAllowed(ipHash, nowMs);
      if (!gate.allowed) {
        return json({ error: "Too many attempts. Try again later." }, 429, {
          "Retry-After": String(Math.max(1, Math.ceil(gate.retryAfterMs / 1000))),
        });
      }
      const body = await readJson(request);
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const emailRaw = typeof body?.email === "string" ? body.email : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const consent = body?.consent;
      const vUser = validateUsername(username);
      if (!vUser.ok) return bad(vUser.reason);
      const vEmail = validateParentEmail(emailRaw);
      if (!vEmail.ok) return bad(vEmail.reason);
      const email = normalizeEmail(emailRaw);
      const vPass = validatePassword(password, { username, email });
      if (!vPass.ok) return bad(vPass.reason);
      const vConsent = validateConsent(consent);
      if (!vConsent.ok) return bad(vConsent.reason, 400);

      const usernameLower = normalizeUsername(username);
      const reserved = await store.reservedNames();
      if (isUsernameReserved(reserved, usernameLower, nowMs)) {
        return json({ error: "Username is taken." }, 409);
      }
      if (await store.findAccountByUsernameLower(usernameLower)) {
        return json({ error: "Username is taken." }, 409);
      }
      const emailOwner = await store.findAccountByEmail(email);
      if (emailOwner) {
        return json({ error: "Email already registered." }, 409);
      }

      const m = await requireMailer();
      if (m instanceof Response) return m;
      const history = await store.otps();
      const check = canIssueOtp(history, email, ipHash, nowMs);
      if (!check.allowed) {
        return json({ error: "Too many codes. Try again later." }, 429, {
          "Retry-After": String(Math.max(1, Math.ceil(check.retryAfterMs / 1000))),
        });
      }

      const account: AccountRecord = {
        id: newAccountId(nowMs),
        username,
        usernameLower,
        email,
        emailVerified: false,
        passwordHash: hashPassword(password),
        createdAtMs: nowMs,
        deletionRequestedAtMs: null,
        progressJson: null,
        progressUpdatedAtMs: null,
      };
      await store.insertAccount(account);
      const { updated, issued } = issueOtp(history, {
        email,
        purpose: "verify",
        ipHash,
        nowMs,
      });
      await store.saveOtps(updated);
      try {
        await m.sendOtpEmail(email, issued.code, "verify");
      } catch {
        return json({ error: "Could not send code." }, 502);
      }
      return json({ accountId: account.id }, 201);
    },

    async verify(request: Request): Promise<Response> {
      const nowMs = now();
      const body = await readJson(request);
      const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
      const code = typeof body?.code === "string" ? body.code.trim() : "";
      if (!email || !code) return bad("Send the email and the 6-digit code.");
      const history = await store.otps();
      const candidates = history
        .filter((r) => r.email === email && r.purpose === "verify")
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      const live = candidates.find(
        (r) => !r.used && !r.invalidated && nowMs < r.expiresAtMs,
      );
      const target = live ?? candidates[0];
      if (!target) return bad("That code has expired. Request a new one.");
      const result = verifyOtpAttempt(target, code, nowMs);
      await store.saveOtp(result.record);
      if (!result.ok) {
        if (result.reason === "expired") return bad("That code has expired. Request a new one.");
        if (result.reason === "locked") {
          return bad("Too many wrong attempts. Request a new code.", 429);
        }
        return bad("That code is wrong.");
      }
      const account = await store.findAccountByEmail(email);
      if (account) {
        account.emailVerified = true;
        await store.updateAccount(account);
      }
      return json({ verified: true });
    },

    async resend(request: Request): Promise<Response> {
      const nowMs = now();
      const ipHash = clientIpHash(request);
      const m = await requireMailer();
      if (m instanceof Response) return m;
      const body = await readJson(request);
      const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
      const purpose = (typeof body?.purpose === "string" ? body.purpose : "verify") as OtpPurpose;
      if (!email) return bad("Send the email address.");
      if (purpose !== "verify" && purpose !== "reset") return bad("Unknown code purpose.");
      const account = await store.findAccountByEmail(email);
      if (purpose === "verify" && account?.emailVerified) {
        return bad("That Account is already verified.");
      }
      const history = await store.otps();
      const check = canIssueOtp(history, email, ipHash, nowMs);
      if (!check.allowed) {
        const status = 429;
        return json(
          {
            error:
              check.reason === "cooldown"
                ? "Wait before requesting a new code."
                : "Too many codes. Try again later.",
          },
          status,
          { "Retry-After": String(Math.max(1, Math.ceil(check.retryAfterMs / 1000))) },
        );
      }
      const { updated, issued } = issueOtp(history, { email, purpose, ipHash, nowMs });
      await store.saveOtps(updated);
      // Generic ok for unknown emails still sends nothing new: avoid
      // enumeration by succeeding only when an Account holds the email,
      // except verify-before-register which has no Account yet.
      if (!account && purpose === "reset") return json({ sent: true });
      try {
        await m.sendOtpEmail(email, issued.code, purpose);
      } catch {
        return json({ error: "Could not send code." }, 502);
      }
      return json({ sent: true });
    },

    async login(request: Request): Promise<Response> {
      const nowMs = now();
      const ipHash = clientIpHash(request);
      const body = await readJson(request);
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const sharedComputer = body?.sharedComputer === true;
      if (!username || !password) return json({ error: GENERIC_LOGIN_ERROR }, 401);

      const account = await store.findAccountByUsernameLower(normalizeUsername(username));
      const key = account ? account.id : `unknown:${normalizeUsername(username)}`;
      const failures = await store.loginFailures();
      const gate = checkLoginAllowed(failures, key, ipHash, nowMs);
      if (!gate.allowed) {
        return json({ error: GENERIC_LOGIN_ERROR }, 429, {
          "Retry-After": String(Math.max(1, Math.ceil(gate.retryAfterMs / 1000))),
        });
      }
      if (!account || !verifyPassword(password, account.passwordHash)) {
        await store.saveLoginFailures(recordLoginFailure(failures, key, ipHash, nowMs));
        return json({ error: GENERIC_LOGIN_ERROR }, 401);
      }
      if (account.deletionRequestedAtMs !== null) {
        if (isGraceExpired(account, nowMs)) return json({ error: GENERIC_LOGIN_ERROR }, 401);
        await store.updateAccount(cancelDeletionOnLogin(account));
      }
      if (!account.emailVerified) {
        return json({ error: "Verify your email first.", needsVerification: true }, 403);
      }
      await store.saveLoginFailures(failures.filter((f) => !(f.accountId === key && f.ipHash === ipHash)));
      const { record, token } = createSession({
        accountId: account.id,
        ipHash,
        nowMs,
        sharedComputer,
      });
      await store.saveSession(record);
      return json(
        { username: account.username },
        200,
        { "Set-Cookie": sessionCookie(token, sharedComputer) },
      );
    },

    async logout(request: Request): Promise<Response> {
      const nowMs = now();
      const authed = await getAuthed(store, request, nowMs);
      if (authed) {
        const sessions = await store.sessions();
        const current = sessions.find((s) => s.tokenHash === authed.tokenHash);
        if (current) {
          await store.saveSession({ ...current, revoked: true });
        }
      }
      return json(
        { loggedOut: true, wipeLocal: authed?.sharedComputer ?? false },
        200,
        { "Set-Cookie": clearSessionCookie() },
      );
    },

    async me(request: Request): Promise<Response> {
      const authed = await getAuthed(store, request, now());
      if (!authed) return json({ error: "Not signed in." }, 401);
      return json(
        {
          username: authed.account.username,
          emailVerified: authed.account.emailVerified,
          sharedComputer: authed.sharedComputer,
        },
        200,
        authed.refreshedCookie ? { "Set-Cookie": authed.refreshedCookie } : {},
      );
    },

    async resetRequest(request: Request): Promise<Response> {
      const nowMs = now();
      const ipHash = clientIpHash(request);
      const body = await readJson(request);
      const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
      if (!email) return bad("Send the parent or guardian email.");
      const account = await store.findAccountByEmail(email);
      if (!account) return json({ sent: true });
      const m = await requireMailer();
      if (m instanceof Response) return json({ sent: true });
      const history = await store.otps();
      const check = canIssueOtp(history, email, ipHash, nowMs);
      if (!check.allowed) {
        return json({ error: "Too many codes. Try again later." }, 429, {
          "Retry-After": String(Math.max(1, Math.ceil(check.retryAfterMs / 1000))),
        });
      }
      const { updated, issued } = issueOtp(history, { email, purpose: "reset", ipHash, nowMs });
      await store.saveOtps(updated);
      try {
        await m.sendOtpEmail(email, issued.code, "reset");
      } catch {
        return json({ error: "Could not send code." }, 502);
      }
      return json({ sent: true });
    },

    async resetConfirm(request: Request): Promise<Response> {
      const nowMs = now();
      const body = await readJson(request);
      const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
      const code = typeof body?.code === "string" ? body.code.trim() : "";
      const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
      if (!email || !code || !newPassword) return bad("Send the email, code, and new password.");
      const account = await store.findAccountByEmail(email);
      if (!account) return bad("That code is wrong.");
      const vPass = validatePassword(newPassword, { username: account.username, email });
      if (!vPass.ok) return bad(vPass.reason);
      const history = await store.otps();
      const candidates = history
        .filter((r) => r.email === email && r.purpose === "reset")
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      const live = candidates.find((r) => !r.used && !r.invalidated && nowMs < r.expiresAtMs);
      const target = live ?? candidates[0];
      if (!target) return bad("That code has expired. Request a new one.");
      const result = verifyOtpAttempt(target, code, nowMs);
      await store.saveOtp(result.record);
      if (!result.ok) {
        if (result.reason === "locked") return bad("Too many wrong attempts. Request a new code.", 429);
        if (result.reason === "expired") return bad("That code has expired. Request a new one.");
        return bad("That code is wrong.");
      }
      account.passwordHash = hashPassword(newPassword);
      account.deletionRequestedAtMs = null;
      await store.updateAccount(account);
      await store.deleteSessionsForAccount(account.id);
      return json({ reset: true });
    },

    async forgotUsername(request: Request): Promise<Response> {
      const body = await readJson(request);
      const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
      if (!email) return bad("Send the parent or guardian email.");
      const account = await store.findAccountByEmail(email);
      if (account && mailer?.sendUsernameEmail) {
        try {
          await mailer.sendUsernameEmail(email, account.username);
        } catch {
          return json({ sent: true });
        }
      }
      return json({ sent: true });
    },

    async changePassword(request: Request): Promise<Response> {
      const nowMs = now();
      const authed = await getAuthed(store, request, nowMs);
      if (!authed) return json({ error: "Not signed in." }, 401);
      const body = await readJson(request);
      const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
      const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
      if (!verifyPassword(currentPassword, authed.account.passwordHash)) {
        return json({ error: GENERIC_LOGIN_ERROR }, 401);
      }
      const vPass = validatePassword(newPassword, {
        username: authed.account.username,
        email: authed.account.email,
      });
      if (!vPass.ok) return bad(vPass.reason);
      authed.account.passwordHash = hashPassword(newPassword);
      await store.updateAccount(authed.account);
      await store.deleteSessionsForAccount(authed.account.id, authed.tokenHash);
      return json(
        { changed: true },
        200,
        authed.refreshedCookie ? { "Set-Cookie": authed.refreshedCookie } : {},
      );
    },

    async deleteRequest(request: Request): Promise<Response> {
      const nowMs = now();
      const ipHash = clientIpHash(request);
      const authed = await getAuthed(store, request, nowMs);
      if (!authed) return json({ error: "Not signed in." }, 401);
      const body = await readJson(request);
      const password = typeof body?.password === "string" ? body.password : "";
      if (!verifyPassword(password, authed.account.passwordHash)) {
        return json({ error: GENERIC_LOGIN_ERROR }, 401);
      }
      const m = await requireMailer();
      if (m instanceof Response) return m;
      const history = await store.otps();
      const check = canIssueOtp(history, authed.account.email, ipHash, nowMs);
      if (!check.allowed) {
        return json({ error: "Too many codes. Try again later." }, 429, {
          "Retry-After": String(Math.max(1, Math.ceil(check.retryAfterMs / 1000))),
        });
      }
      const { updated, issued } = issueOtp(history, {
        email: authed.account.email,
        purpose: "delete",
        ipHash,
        nowMs,
      });
      await store.saveOtps(updated);
      try {
        await m.sendOtpEmail(authed.account.email, issued.code, "delete");
      } catch {
        return json({ error: "Could not send code." }, 502);
      }
      return json(
        { sent: true },
        200,
        authed.refreshedCookie ? { "Set-Cookie": authed.refreshedCookie } : {},
      );
    },

    async deleteConfirm(request: Request): Promise<Response> {
      const nowMs = now();
      const authed = await getAuthed(store, request, nowMs);
      if (!authed) return json({ error: "Not signed in." }, 401);
      const body = await readJson(request);
      const code = typeof body?.code === "string" ? body.code.trim() : "";
      if (!code) return bad("Send the 6-digit code.");
      const history = await store.otps();
      const candidates = history
        .filter((r) => r.email === authed.account.email && r.purpose === "delete")
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      const live = candidates.find((r) => !r.used && !r.invalidated && nowMs < r.expiresAtMs);
      const target = live ?? candidates[0];
      if (!target) return bad("That code has expired. Request a new one.");
      const result = verifyOtpAttempt(target, code, nowMs);
      await store.saveOtp(result.record);
      if (!result.ok) {
        if (result.reason === "locked") return bad("Too many wrong attempts. Request a new code.", 429);
        if (result.reason === "expired") return bad("That code has expired. Request a new one.");
        return bad("That code is wrong.");
      }
      await store.updateAccount(requestDeletion(authed.account, nowMs));
      return json({ deletionRequested: true, graceDays: 30 });
    },

    async getProgress(request: Request): Promise<Response> {
      const nowMs = now();
      const authed = await getAuthed(store, request, nowMs);
      if (!authed) return json({ error: "Not signed in." }, 401);
      return json(
        {
          progress: authed.account.progressJson ? JSON.parse(authed.account.progressJson) : null,
        },
        200,
        authed.refreshedCookie ? { "Set-Cookie": authed.refreshedCookie } : {},
      );
    },

    async putProgress(request: Request): Promise<Response> {
      const nowMs = now();
      const authed = await getAuthed(store, request, nowMs);
      if (!authed) return json({ error: "Not signed in." }, 401);
      const body = await readJson(request);
      if (!body || typeof body.progress !== "object" || body.progress === null) {
        return bad("Send the progress record.");
      }
      const incoming = sanitizeProgressV2(body.progress);
      const current = authed.account.progressJson
        ? sanitizeProgressV2(JSON.parse(authed.account.progressJson))
        : null;
      const merged = current ? mergeProgressV2(current, incoming) : incoming;
      authed.account.progressJson = JSON.stringify(merged);
      authed.account.progressUpdatedAtMs = nowMs;
      // Touch the session so idle sync extends the sliding cookie.
      await store.updateAccount(authed.account);
      const rawToken = parseSessionToken(request.headers.get("cookie")) ?? "";
      return json(
        { progress: merged },
        200,
        { "Set-Cookie": sessionCookie(rawToken, authed.sharedComputer) },
      );
    },

    /** Sweep job: grace expiry, unverified auto-delete, reservation prune. */
    async sweep(nowMs: number): Promise<{ deletedIds: string[] }> {
      const accounts = await store.listAccounts();
      const reserved = await store.reservedNames();
      const result = sweepAccounts({ accounts, reserved, nowMs });
      for (const account of result.deleted) {
        await store.deleteAccount(account.id);
        await store.deleteSessionsForAccount(account.id);
      }
      await store.saveReservedNames(result.reserved);
      return { deletedIds: result.deleted.map((a) => a.id) };
    },
  };
}

export type AuthHandlers = ReturnType<typeof createAuthHandlers>;
