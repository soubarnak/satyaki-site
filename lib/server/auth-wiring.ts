// Shared wiring for /api/auth/* and /api/progress (spec §7).
// Postgres via pg + Drizzle when DATABASE_URL is set; otherwise a process
// memory store (dev/test). Mailer is Resend when keys exist, else null and
// handlers fail closed with 503. Route tests inject their own stub.

import { createAuthHandlers } from "./auth-handler";
import { createPgAuthStore, getDb } from "./auth-store-pg";
import { createResendMailer, readMailerEnv } from "@/lib/auth/mailer";
import { createMemoryAuthStore, type AuthStore } from "@/lib/auth/store";

let memory: AuthStore | null = null;

export function getAuthStore(): AuthStore {
  const db = getDb();
  if (db) return createPgAuthStore(db);
  if (!memory) memory = createMemoryAuthStore();
  return memory;
}

/** Test hook: replace the shared memory store. */
export function setAuthStoreForTests(store: AuthStore): void {
  memory = store;
}

export function getAuthHandlers() {
  const mailerEnv = readMailerEnv();
  const mailer = mailerEnv
    ? createResendMailer({ apiKey: mailerEnv.apiKey, from: mailerEnv.from })
    : null;
  return createAuthHandlers({ store: getAuthStore(), mailer, now: Date.now });
}
