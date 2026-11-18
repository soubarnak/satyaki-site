// Login throttle (spec §7): 10 failures lock the Account+IP pair for
// 15 minutes. Pure core, clock-injected. Errors stay generic at the seam.

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export interface LoginAttempt {
  accountId: string;
  ipHash: string;
  atMs: number;
}

export interface ThrottleVerdict {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Check the Account+IP pair at nowMs. Only failures inside the 15-minute
 * window count; a 10th recent failure locks with the remaining wait.
 */
export function checkLoginAllowed(
  failures: readonly LoginAttempt[],
  accountId: string,
  ipHash: string,
  nowMs: number,
): ThrottleVerdict {
  const cutoff = nowMs - LOGIN_LOCK_MS;
  const recent = failures
    .filter((f) => f.accountId === accountId && f.ipHash === ipHash && f.atMs > cutoff)
    .sort((a, b) => a.atMs - b.atMs);
  if (recent.length >= LOGIN_MAX_FAILURES) {
    return {
      allowed: false,
      retryAfterMs: recent[0].atMs + LOGIN_LOCK_MS - nowMs,
    };
  }
  return { allowed: true, retryAfterMs: 0 };
}

/** Record one failed login; callers append to the failure log and prune. */
export function recordLoginFailure(
  failures: readonly LoginAttempt[],
  accountId: string,
  ipHash: string,
  nowMs: number,
): LoginAttempt[] {
  const cutoff = nowMs - LOGIN_LOCK_MS;
  return [
    ...failures.filter((f) => f.atMs > cutoff),
    { accountId, ipHash, atMs: nowMs },
  ];
}

/** Generic login error (spec §7): never reveals which field was wrong. */
export const GENERIC_LOGIN_ERROR = "Username or password is wrong.";
