// Account store (spec §7). The Account holds only: username, parent
// email, password hash, progress, saved code. No real name, no date of
// birth, ever. Interface covers Postgres (Drizzle) and the in-memory
// test/route double; handlers depend only on this interface.

import type { OtpRecord } from "./otp";
import type { LoginAttempt } from "./throttle";
import type { ReservedName } from "./deletion";
import type { SessionRecord } from "./session";

export interface AccountRecord {
  id: string;
  username: string;
  usernameLower: string;
  /** Parent/guardian email: OTPs and resets only, never marketing. */
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  createdAtMs: number;
  deletionRequestedAtMs: number | null;
  /** Minimal progress mirror for the sync API (spec §6/§12 wave 5). */
  progressJson: string | null;
  progressUpdatedAtMs: number | null;
}

export interface AuthStore {
  findAccountByUsernameLower(usernameLower: string): Promise<AccountRecord | null>;
  findAccountByEmail(email: string): Promise<AccountRecord | null>;
  findAccountById(id: string): Promise<AccountRecord | null>;
  insertAccount(account: AccountRecord): Promise<void>;
  updateAccount(account: AccountRecord): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  listAccounts(): Promise<AccountRecord[]>;

  otps(): Promise<OtpRecord[]>;
  saveOtp(record: OtpRecord): Promise<void>;
  saveOtps(records: OtpRecord[]): Promise<void>;

  sessions(): Promise<SessionRecord[]>;
  saveSession(record: SessionRecord): Promise<void>;
  deleteSessionsForAccount(accountId: string, exceptTokenHash?: string): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;

  loginFailures(): Promise<LoginAttempt[]>;
  saveLoginFailures(failures: LoginAttempt[]): Promise<void>;

  reservedNames(): Promise<ReservedName[]>;
  saveReservedNames(names: ReservedName[]): Promise<void>;
}

/** In-memory AuthStore for unit + route integration tests (and dev). */
export function createMemoryAuthStore(seed: {
  accounts?: AccountRecord[];
  otps?: OtpRecord[];
  sessions?: SessionRecord[];
  failures?: LoginAttempt[];
  reserved?: ReservedName[];
} = {}): AuthStore {
  const accounts = new Map<string, AccountRecord>();
  for (const a of seed.accounts ?? []) accounts.set(a.id, { ...a });
  const otps = new Map<string, OtpRecord>();
  for (const o of seed.otps ?? []) otps.set(o.id, { ...o });
  const sessions = new Map<string, SessionRecord>();
  for (const s of seed.sessions ?? []) sessions.set(s.id, { ...s });
  let failures: LoginAttempt[] = [...(seed.failures ?? [])];
  let reserved: ReservedName[] = [...(seed.reserved ?? [])];

  return {
    async findAccountByUsernameLower(usernameLower) {
      for (const a of accounts.values()) {
        if (a.usernameLower === usernameLower) return { ...a };
      }
      return null;
    },
    async findAccountByEmail(email) {
      for (const a of accounts.values()) {
        if (a.email === email) return { ...a };
      }
      return null;
    },
    async findAccountById(id) {
      const a = accounts.get(id);
      return a ? { ...a } : null;
    },
    async insertAccount(account) {
      accounts.set(account.id, { ...account });
    },
    async updateAccount(account) {
      accounts.set(account.id, { ...account });
    },
    async deleteAccount(id) {
      accounts.delete(id);
    },
    async listAccounts() {
      return [...accounts.values()].map((a) => ({ ...a }));
    },
    async otps() {
      return [...otps.values()].map((o) => ({ ...o }));
    },
    async saveOtp(record) {
      otps.set(record.id, { ...record });
    },
    async saveOtps(records) {
      for (const r of records) otps.set(r.id, { ...r });
    },
    async sessions() {
      return [...sessions.values()].map((s) => ({ ...s }));
    },
    async saveSession(record) {
      sessions.set(record.id, { ...record });
    },
    async deleteSessionsForAccount(accountId, exceptTokenHash) {
      for (const s of [...sessions.values()]) {
        if (s.accountId !== accountId) continue;
        if (exceptTokenHash && s.tokenHash === exceptTokenHash) continue;
        sessions.delete(s.id);
      }
    },
    async findSessionByTokenHash(tokenHash) {
      for (const s of sessions.values()) {
        if (s.tokenHash === tokenHash) return { ...s };
      }
      return null;
    },
    async loginFailures() {
      return [...failures];
    },
    async saveLoginFailures(next) {
      failures = [...next];
    },
    async reservedNames() {
      return [...reserved];
    },
    async saveReservedNames(next) {
      reserved = [...next];
    },
  };
}

let accountSeq = 0;

/** New unverified Account id. */
export function newAccountId(nowMs: number): string {
  accountSeq += 1;
  return `acct_${nowMs}_${accountSeq}`;
}
