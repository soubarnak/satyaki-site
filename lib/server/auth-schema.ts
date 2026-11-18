// Postgres schema for Accounts, OTPs, and sessions (spec §7).
// Coolify one-click Postgres, accessed via `pg` + Drizzle from Next.js
// route handlers. Check `bongbetic` headroom before creating the resource
// (see scripts/check-postgres-headroom.mjs); scheduled `pg_dump` backups
// rotate deleted rows out within 30 days.
//
// The Account holds only: username, parent email, password hash,
// progress, saved code. No real name, no date of birth, ever.

import { bigint, boolean, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameLower: text("username_lower").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    passwordHash: text("password_hash").notNull(),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
    deletionRequestedAtMs: bigint("deletion_requested_at_ms", { mode: "number" }),
    progressJson: text("progress_json"),
    progressUpdatedAtMs: bigint("progress_updated_at_ms", { mode: "number" }),
  },
  (t) => [uniqueIndex("accounts_username_lower_idx").on(t.usernameLower), index("accounts_email_idx").on(t.email)],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    salt: text("salt").notNull(),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
    expiresAtMs: bigint("expires_at_ms", { mode: "number" }).notNull(),
    attempts: bigint("attempts", { mode: "number" }).notNull().default(0),
    used: boolean("used").notNull().default(false),
    invalidated: boolean("invalidated").notNull().default(false),
    ipHash: text("ip_hash").notNull(),
  },
  (t) => [index("otp_codes_email_idx").on(t.email)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
  expiresAtMs: bigint("expires_at_ms", { mode: "number" }).notNull(),
  lastSeenAtMs: bigint("last_seen_at_ms", { mode: "number" }).notNull(),
  sharedComputer: boolean("shared_computer").notNull().default(false),
  ipHash: text("ip_hash").notNull(),
  revoked: boolean("revoked").notNull().default(false),
});

export const reservedUsernames = pgTable("reserved_usernames", {
  usernameLower: text("username_lower").primaryKey(),
  reservedUntilMs: bigint("reserved_until_ms", { mode: "number" }).notNull(),
});

export const loginFailures = pgTable("login_failures", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  ipHash: text("ip_hash").notNull(),
  atMs: bigint("at_ms", { mode: "number" }).notNull(),
});
