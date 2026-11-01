// Thin localStorage adapter for the progress core (ADR-0007). One key
// holds the one JSON record of ADR-0006 (DR-006: 1 progress record per
// browser); the pure core in lib/progress.ts never touches `window`.

import {
  EMPTY_PROGRESS,
  parseProgress,
  serializeProgress,
  type Progress,
} from "./progress";

export const PROGRESS_STORAGE_KEY = "javaquest-progress-v1";

/** The slice of the Web Storage API the adapter needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProgressStorage {
  load(): Progress;
  save(progress: Progress): void;
  clear(): void;
}

/**
 * Progress storage over any StorageLike backend. Every `save` is a single
 * one-key write (ADR-0006), so a pass, its derived-points effect, badge,
 * and streak update land together and the next `load` on this device sees
 * them (DR-008). A backend that throws (storage denied or full) behaves
 * as no stored progress instead of breaking the page.
 */
export function createProgressStorage(
  storage: StorageLike,
  key: string = PROGRESS_STORAGE_KEY,
): ProgressStorage {
  return {
    load(): Progress {
      try {
        return parseProgress(storage.getItem(key));
      } catch {
        return EMPTY_PROGRESS;
      }
    },
    save(progress: Progress): void {
      try {
        storage.setItem(key, serializeProgress(progress));
      } catch {
        // No writable storage: progress simply does not persist.
      }
    },
    clear(): void {
      try {
        storage.removeItem(key);
      } catch {
        // Nothing deletable through a denied backend.
      }
    },
  };
}

const NO_STORAGE: StorageLike = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Progress storage over this browser's localStorage, when there is one. */
export function browserProgressStorage(): ProgressStorage {
  const backend = typeof window === "undefined" ? NO_STORAGE : window.localStorage;
  return createProgressStorage(backend);
}
