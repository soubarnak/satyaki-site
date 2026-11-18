// Deletion and retention (spec §7, issue #35). Pure core, clock-injected.
// Deletion needs password + OTP, then a 30-day grace (any login cancels),
// then hard delete. Unverified Accounts auto-delete after 7 days.
// Deleted usernames stay reserved 90 days; backups rotate rows out within
// 30 days (Coolify pg_dump retention, stated in privacy text).

export const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
export const UNVERIFIED_AUTO_DELETE_MS = 7 * 24 * 60 * 60 * 1000;
export const USERNAME_RESERVED_MS = 90 * 24 * 60 * 60 * 1000;

export interface DeletableAccount {
  id: string;
  usernameLower: string;
  emailVerified: boolean;
  createdAtMs: number;
  deletionRequestedAtMs: number | null;
}

export interface ReservedName {
  usernameLower: string;
  reservedUntilMs: number;
}

/** Mark deletion requested now (after password + OTP checks at the seam). */
export function requestDeletion<T extends DeletableAccount>(account: T, nowMs: number): T {
  return { ...account, deletionRequestedAtMs: nowMs };
}

/** Any login inside grace cancels deletion (spec §7). */
export function cancelDeletionOnLogin<T extends DeletableAccount>(account: T): T {
  if (account.deletionRequestedAtMs === null) return account;
  return { ...account, deletionRequestedAtMs: null };
}

/** True once the 30-day grace has fully passed. */
export function isGraceExpired(account: DeletableAccount, nowMs: number): boolean {
  return (
    account.deletionRequestedAtMs !== null &&
    nowMs - account.deletionRequestedAtMs >= DELETION_GRACE_MS
  );
}

/** True for unverified Accounts older than 7 days: auto-delete candidates. */
export function isUnverifiedExpired(account: DeletableAccount, nowMs: number): boolean {
  return (
    !account.emailVerified &&
    account.deletionRequestedAtMs === null &&
    nowMs - account.createdAtMs >= UNVERIFIED_AUTO_DELETE_MS
  );
}

/** Reserve a deleted username for 90 days against impersonation. */
export function reserveUsername(usernameLower: string, nowMs: number): ReservedName {
  return { usernameLower, reservedUntilMs: nowMs + USERNAME_RESERVED_MS };
}

/** True while the reservation window still holds at nowMs. */
export function isUsernameReserved(
  reserved: readonly ReservedName[],
  usernameLower: string,
  nowMs: number,
): boolean {
  return reserved.some((r) => r.usernameLower === usernameLower && nowMs < r.reservedUntilMs);
}

/** Drop expired reservations; callers run this in the same sweep job. */
export function pruneReserved(
  reserved: readonly ReservedName[],
  nowMs: number,
): ReservedName[] {
  return reserved.filter((r) => nowMs < r.reservedUntilMs);
}

export interface SweepInput<T extends DeletableAccount> {
  accounts: readonly T[];
  reserved: readonly ReservedName[];
  nowMs: number;
}

export interface SweepResult<T extends DeletableAccount> {
  /** Accounts that survive this sweep. */
  kept: T[];
  /** Accounts to hard-delete now (grace expired or unverified expired). */
  deleted: T[];
  /** Updated reservation list (new holds added, expired pruned). */
  reserved: ReservedName[];
}

/**
 * One sweep job for grace expiry, unverified auto-delete, and reservation
 * pruning (acceptance: jobs covered by tests). Hard delete is the caller's
 * store removal plus reserving the username.
 */
export function sweepAccounts<T extends DeletableAccount>(
  input: SweepInput<T>,
): SweepResult<T> {
  const kept: T[] = [];
  const deleted: T[] = [];
  for (const account of input.accounts) {
    if (isGraceExpired(account, input.nowMs) || isUnverifiedExpired(account, input.nowMs)) {
      deleted.push(account);
    } else {
      kept.push(account);
    }
  }
  let reserved = pruneReserved(input.reserved, input.nowMs);
  for (const account of deleted) {
    if (!reserved.some((r) => r.usernameLower === account.usernameLower && input.nowMs < r.reservedUntilMs)) {
      reserved = [...reserved, reserveUsername(account.usernameLower, input.nowMs)];
    }
  }
  return { kept, deleted, reserved };
}
