// Client auth-progress wiring (issue #67, spec §§6–7).
// Browser caller injects fetch plus v2 load/save so tests drive it with
// memory doubles. Glossary: Account, Mission, Pass, Star, Boss Gate.

import { applyLogoutWipe } from "./progress-sync";
import { sanitizeProgressV2, type ProgressV2 } from "./progress";

export interface LoginCredentials {
  username: string;
  password: string;
  sharedComputer?: boolean;
}

export interface LoginWithProgressResult {
  username: string;
  progress: ProgressV2;
  replaced: boolean;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

function loginBody(local: ProgressV2, creds: LoginCredentials): string {
  return JSON.stringify({
    username: creds.username,
    password: creds.password,
    sharedComputer: creds.sharedComputer === true,
    progress: sanitizeProgressV2(local),
  });
}

/**
 * Login while merging the device record server-side. The server merges
 * only a guest or same-Account local record and replaces a different
 * Account; the caller persists the returned progress as the new local
 * record in both cases.
 */
export async function loginWithLocalProgress(
  fetchFn: FetchFn,
  local: ProgressV2,
  creds: LoginCredentials,
): Promise<LoginWithProgressResult> {
  const res = await fetchFn("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: loginBody(local, creds),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    needsVerification?: boolean;
    username?: string;
    progress?: unknown;
    replaced?: boolean;
  };
  if (!res.ok) {
    const reason = body.error ?? "Login failed.";
    throw new Error(reason);
  }
  return {
    username: typeof body.username === "string" ? body.username : creds.username,
    progress: sanitizeProgressV2(body.progress),
    replaced: body.replaced === true,
  };
}

export interface LogoutResult {
  wipeLocal: boolean;
  progress: ProgressV2;
}

/**
 * Logout then apply the server wipe flag: shared-computer logout wipes
 * the local cache, normal logout keeps the local mirror (spec §7).
 */
export async function logoutAndApplyWipe(
  fetchFn: FetchFn,
  loadLocal: () => ProgressV2,
  saveLocal: (next: ProgressV2) => void,
): Promise<LogoutResult> {
  const res = await fetchFn("/api/auth/logout", { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { wipeLocal?: boolean };
  const wipeLocal = res.ok && body.wipeLocal === true;
  const next = applyLogoutWipe(loadLocal(), wipeLocal);
  saveLocal(next);
  return { wipeLocal, progress: next };
}
