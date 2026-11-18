// Progress sync engine (issue #67, spec §6).
// Pure core: no framework, DOM, or network imports. The caller injects
// local load/save plus remote GET/PUT, so tests drive it with memory
// doubles and the browser wires it to localStorage and /api/progress.
// Glossary: Mission, Pass, Star, Boss Gate, Account, Save Code.

import {
  emptyProgressV2,
  mergeProgressV2,
  sanitizeProgressV2,
  type ProgressV2,
} from "./progress";

/** Local draft autosave waits 800 ms idle before persisting (spec §6). */
export const LOCAL_AUTOSAVE_IDLE_MS = 800;
/** Logged-in sync waits 3 s idle, plus Run/Pass/page-leave (spec §6). */
export const SYNC_IDLE_MS = 3000;

/** True once the local edit has idled long enough to persist. */
export function isDraftDue(lastEditMs: number | null, nowMs: number): boolean {
  if (lastEditMs === null) return false;
  return nowMs - lastEditMs >= LOCAL_AUTOSAVE_IDLE_MS;
}

/** True once the dirty local record has idled long enough to sync. */
export function isSyncDue(lastLocalChangeMs: number | null, nowMs: number): boolean {
  if (lastLocalChangeMs === null) return false;
  return nowMs - lastLocalChangeMs >= SYNC_IDLE_MS;
}

/**
 * Shared-computer logout wipes the local cache; normal logout keeps the
 * local mirror (spec §7). The server's `wipeLocal` flag decides.
 */
export function applyLogoutWipe(local: ProgressV2, wipeLocal: boolean): ProgressV2 {
  if (wipeLocal) return emptyProgressV2();
  return sanitizeProgressV2(local);
}

export interface SyncTransport {
  loadLocal(): ProgressV2;
  saveLocal(next: ProgressV2): void;
  /** Null when the Account holds no progress yet. Rejects when offline. */
  getRemote(): Promise<ProgressV2 | null>;
  /** Merged record echo from the server. Rejects when offline. */
  putRemote(next: ProgressV2): Promise<ProgressV2>;
}

export interface FlushResult {
  pushed: boolean;
  progress: ProgressV2;
}

/** Sync engine: dirty flag plus offline queue merged on reconnect. */
export function createProgressSync(transport: SyncTransport) {
  let dirty = false;
  let lastChangeMs: number | null = null;

  async function flush(loggedIn: boolean): Promise<FlushResult> {
    const local = sanitizeProgressV2(transport.loadLocal());
    if (!dirty || !loggedIn) return { pushed: false, progress: local };
    let remote: ProgressV2 | null;
    try {
      remote = await transport.getRemote();
    } catch {
      return { pushed: false, progress: local };
    }
    const base = remote ? mergeProgressV2(remote, local) : local;
    try {
      const pushed = sanitizeProgressV2(await transport.putRemote(base));
      transport.saveLocal(pushed);
      dirty = false;
      lastChangeMs = null;
      return { pushed: true, progress: pushed };
    } catch {
      return { pushed: false, progress: local };
    }
  }

  return {
    isDirty(): boolean {
      return dirty;
    },

    /** Record a local edit: persist locally now, queue the 3 s sync. */
    markLocalUpdated(next: ProgressV2, nowMs: number): void {
      transport.saveLocal(sanitizeProgressV2(next));
      dirty = true;
      lastChangeMs = nowMs;
    },

    /** True when the queued record is due for its idle sync. */
    shouldSync(nowMs: number, loggedIn: boolean): boolean {
      return dirty && loggedIn && isSyncDue(lastChangeMs, nowMs);
    },

    flush,

    /** Run/Pass writes through at once when logged in, else stays local. */
    async onRunPass(next: ProgressV2, nowMs: number, loggedIn: boolean): Promise<FlushResult> {
      transport.saveLocal(sanitizeProgressV2(next));
      if (!loggedIn) return { pushed: false, progress: sanitizeProgressV2(next) };
      dirty = true;
      lastChangeMs = nowMs;
      return flush(true);
    },

    /** Page leave: push the queue once when logged in. */
    async onPageLeave(loggedIn: boolean): Promise<FlushResult> {
      return flush(loggedIn);
    },

    /** Reconnect: merge the offline queue with the server, never downgrade. */
    async onReconnect(loggedIn: boolean): Promise<FlushResult> {
      return flush(loggedIn);
    },

    /** Apply the merged login progress returned by the server. */
    applyLoginMerged(merged: ProgressV2): void {
      transport.saveLocal(sanitizeProgressV2(merged));
      dirty = false;
      lastChangeMs = null;
    },

    /** Apply logout: wipe the cache on shared computers, else keep it. */
    applyLogout(wipeLocal: boolean): ProgressV2 {
      const next = applyLogoutWipe(transport.loadLocal(), wipeLocal);
      transport.saveLocal(next);
      dirty = false;
      lastChangeMs = null;
      return next;
    },
  };
}

export type ProgressSync = ReturnType<typeof createProgressSync>;
