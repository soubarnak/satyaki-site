-- Accounts, OTPs, and sessions (spec §7, issue #32).
-- Apply on the Coolify one-click Postgres for the site's destination
-- AFTER checking headroom (scripts/check-postgres-headroom.mjs).
-- The Account holds only username, parent email, password hash, and
-- progress. No real name, no date of birth, ever.

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  deletion_requested_at_ms BIGINT,
  progress_json TEXT,
  progress_updated_at_ms BIGINT
);
CREATE INDEX IF NOT EXISTS accounts_email_idx ON accounts (email);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  expires_at_ms BIGINT NOT NULL,
  attempts BIGINT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  invalidated BOOLEAN NOT NULL DEFAULT FALSE,
  ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS otp_codes_email_idx ON otp_codes (email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at_ms BIGINT NOT NULL,
  expires_at_ms BIGINT NOT NULL,
  last_seen_at_ms BIGINT NOT NULL,
  shared_computer BOOLEAN NOT NULL DEFAULT FALSE,
  ip_hash TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS reserved_usernames (
  username_lower TEXT PRIMARY KEY,
  reserved_until_ms BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_failures (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  at_ms BIGINT NOT NULL
);
