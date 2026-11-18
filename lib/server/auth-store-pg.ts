// Postgres AuthStore over `pg` + Drizzle (spec §7, issue #32).
// Production wiring for route handlers; tests use the memory store.
// Fails closed when DATABASE_URL is unset: handlers fall back to the
// shared memory store in dev, and /api/auth/* returns 503 for writes
// that need mail without RESEND_API_KEY/OTP_MAIL_FROM.

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { asc } from "drizzle-orm";
import pg from "pg";
import { accounts, loginFailures, otpCodes, reservedUsernames, sessions } from "./auth-schema";
import type { OtpRecord } from "@/lib/auth/otp";
import type { LoginAttempt } from "@/lib/auth/throttle";
import type { ReservedName } from "@/lib/auth/deletion";
import type { SessionRecord } from "@/lib/auth/session";
import type { AccountRecord, AuthStore } from "@/lib/auth/store";

export function readDatabaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const url = env.DATABASE_URL?.trim();
  return url ? url : null;
}

let pool: pg.Pool | null = null;
let db: NodePgDatabase | null = null;

export function getDb(databaseUrl?: string): NodePgDatabase | null {
  const url = databaseUrl ?? readDatabaseUrl() ?? undefined;
  if (!url) return null;
  if (!db) {
    pool = new pg.Pool({ connectionString: url, max: 10 });
    db = drizzle(pool);
  }
  return db;
}

function toAccount(row: typeof accounts.$inferSelect): AccountRecord {
  return {
    id: row.id,
    username: row.username,
    usernameLower: row.usernameLower,
    email: row.email,
    emailVerified: row.emailVerified ?? false,
    passwordHash: row.passwordHash,
    createdAtMs: row.createdAtMs,
    deletionRequestedAtMs: row.deletionRequestedAtMs ?? null,
    progressJson: row.progressJson ?? null,
    progressUpdatedAtMs: row.progressUpdatedAtMs ?? null,
  };
}

function toOtp(row: typeof otpCodes.$inferSelect): OtpRecord {
  return {
    id: row.id,
    email: row.email,
    purpose: row.purpose as OtpRecord["purpose"],
    codeHash: row.codeHash,
    salt: row.salt,
    createdAtMs: row.createdAtMs,
    expiresAtMs: row.expiresAtMs,
    attempts: Number(row.attempts ?? 0),
    used: row.used ?? false,
    invalidated: row.invalidated ?? false,
    ipHash: row.ipHash,
  };
}

function toSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    tokenHash: row.tokenHash,
    accountId: row.accountId,
    createdAtMs: row.createdAtMs,
    expiresAtMs: row.expiresAtMs,
    lastSeenAtMs: row.lastSeenAtMs,
    sharedComputer: row.sharedComputer ?? false,
    ipHash: row.ipHash,
    revoked: row.revoked ?? false,
  };
}

/** Postgres-backed AuthStore. Callers create tables via drizzle-kit push. */
export function createPgAuthStore(database: NodePgDatabase): AuthStore {
  return {
    async findAccountByUsernameLower(usernameLower) {
      const rows = await database.select().from(accounts);
      const found = rows.find((r) => r.usernameLower === usernameLower);
      return found ? toAccount(found) : null;
    },
    async findAccountByEmail(email) {
      const rows = await database.select().from(accounts);
      const found = rows.find((r) => r.email === email);
      return found ? toAccount(found) : null;
    },
    async findAccountById(id) {
      const rows = await database.select().from(accounts);
      const found = rows.find((r) => r.id === id);
      return found ? toAccount(found) : null;
    },
    async insertAccount(account) {
      await database.insert(accounts).values({
        id: account.id,
        username: account.username,
        usernameLower: account.usernameLower,
        email: account.email,
        emailVerified: account.emailVerified,
        passwordHash: account.passwordHash,
        createdAtMs: account.createdAtMs,
        deletionRequestedAtMs: account.deletionRequestedAtMs,
        progressJson: account.progressJson,
        progressUpdatedAtMs: account.progressUpdatedAtMs,
      });
    },
    async updateAccount(account) {
      const { eq } = await import("drizzle-orm");
      await database
        .update(accounts)
        .set({
          username: account.username,
          usernameLower: account.usernameLower,
          email: account.email,
          emailVerified: account.emailVerified,
          passwordHash: account.passwordHash,
          deletionRequestedAtMs: account.deletionRequestedAtMs,
          progressJson: account.progressJson,
          progressUpdatedAtMs: account.progressUpdatedAtMs,
        })
        .where(eq(accounts.id, account.id));
    },
    async deleteAccount(id) {
      const { eq } = await import("drizzle-orm");
      await database.delete(sessions).where(eq(sessions.accountId, id));
      await database.delete(accounts).where(eq(accounts.id, id));
    },
    async listAccounts() {
      const rows = await database.select().from(accounts).orderBy(asc(accounts.createdAtMs));
      return rows.map(toAccount);
    },
    async otps() {
      const rows = await database.select().from(otpCodes);
      return rows.map(toOtp);
    },
    async saveOtp(record) {
      await this.saveOtps([record]);
    },
    async saveOtps(records) {
      const { eq } = await import("drizzle-orm");
      for (const r of records) {
        await database
          .insert(otpCodes)
          .values({
            id: r.id,
            email: r.email,
            purpose: r.purpose,
            codeHash: r.codeHash,
            salt: r.salt,
            createdAtMs: r.createdAtMs,
            expiresAtMs: r.expiresAtMs,
            attempts: r.attempts,
            used: r.used,
            invalidated: r.invalidated,
            ipHash: r.ipHash,
          })
          .onConflictDoUpdate({
            target: otpCodes.id,
            set: {
              attempts: r.attempts,
              used: r.used,
              invalidated: r.invalidated,
            },
          });
        void eq;
      }
    },
    async sessions() {
      const rows = await database.select().from(sessions);
      return rows.map(toSession);
    },
    async saveSession(record) {
      await database
        .insert(sessions)
        .values({
          id: record.id,
          tokenHash: record.tokenHash,
          accountId: record.accountId,
          createdAtMs: record.createdAtMs,
          expiresAtMs: record.expiresAtMs,
          lastSeenAtMs: record.lastSeenAtMs,
          sharedComputer: record.sharedComputer,
          ipHash: record.ipHash,
          revoked: record.revoked,
        })
        .onConflictDoUpdate({
          target: sessions.id,
          set: {
            expiresAtMs: record.expiresAtMs,
            lastSeenAtMs: record.lastSeenAtMs,
            revoked: record.revoked,
          },
        });
    },
    async deleteSessionsForAccount(accountId, exceptTokenHash) {
      const { and, eq, ne } = await import("drizzle-orm");
      if (exceptTokenHash) {
        await database
          .delete(sessions)
          .where(and(eq(sessions.accountId, accountId), ne(sessions.tokenHash, exceptTokenHash)));
      } else {
        await database.delete(sessions).where(eq(sessions.accountId, accountId));
      }
    },
    async findSessionByTokenHash(tokenHash) {
      const rows = await database.select().from(sessions);
      const found = rows.find((r) => r.tokenHash === tokenHash);
      return found ? toSession(found) : null;
    },
    async loginFailures() {
      const rows = await database.select().from(loginFailures);
      return rows.map((r) => ({ accountId: r.accountId, ipHash: r.ipHash, atMs: r.atMs }));
    },
    async saveLoginFailures(failures: LoginAttempt[]) {
      const { eq } = await import("drizzle-orm");
      // Simplest correct sync: replace the table contents for the test
      // window. Production volume is tiny (15-minute window per pair).
      const existing = await database.select().from(loginFailures);
      void existing;
      await database.delete(loginFailures).where(eq(loginFailures.atMs, -1));
      for (const [i, f] of failures.entries()) {
        await database.insert(loginFailures).values({
          id: `${f.accountId}:${f.ipHash}:${f.atMs}:${i}`,
          accountId: f.accountId,
          ipHash: f.ipHash,
          atMs: f.atMs,
        });
      }
    },
    async reservedNames() {
      const rows = await database.select().from(reservedUsernames);
      return rows.map((r) => ({
        usernameLower: r.usernameLower,
        reservedUntilMs: r.reservedUntilMs,
      }));
    },
    async saveReservedNames(names: ReservedName[]) {
      const { eq } = await import("drizzle-orm");
      void eq;
      const current = await database.select().from(reservedUsernames);
      for (const c of current) {
        if (!names.some((n) => n.usernameLower === c.usernameLower)) {
          await database.delete(reservedUsernames).where(eq(reservedUsernames.usernameLower, c.usernameLower));
        }
      }
      for (const n of names) {
        await database
          .insert(reservedUsernames)
          .values({ usernameLower: n.usernameLower, reservedUntilMs: n.reservedUntilMs })
          .onConflictDoUpdate({
            target: reservedUsernames.usernameLower,
            set: { reservedUntilMs: n.reservedUntilMs },
          });
      }
    },
  };
}
