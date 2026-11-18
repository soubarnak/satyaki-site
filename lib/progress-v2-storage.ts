// v2 localStorage adapter (spec §6, ADR-0010).
// Pure core stays in lib/progress.ts; this module only owns the one-key
// JSON read/write for the v2 record. Storage key differs from the v1 key
// so v1 migration reads stay explicit via migrateV1StreakToV2.

import {
  PROGRESS_V2_STORAGE_KEY,
  emptyProgressV2,
  parseProgressV2,
  serializeProgressV2,
  type ProgressV2,
} from "./progress";
import type { StorageLike } from "./progress-storage";

export { PROGRESS_V2_STORAGE_KEY };
export type { StorageLike };

export interface ProgressV2Storage {
  load(): ProgressV2;
  save(progress: ProgressV2): void;
  clear(): void;
}

/** v2 storage over any StorageLike backend. One-key write per save. */
export function createProgressV2Storage(
  storage: StorageLike,
  key: string = PROGRESS_V2_STORAGE_KEY,
): ProgressV2Storage {
  return {
    load(): ProgressV2 {
      try {
        return parseProgressV2(storage.getItem(key));
      } catch {
        return emptyProgressV2();
      }
    },
    save(progress: ProgressV2): void {
      try {
        storage.setItem(key, serializeProgressV2(progress));
      } catch {
        // Storage denied or full: progress stays in memory only.
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

/** v2 storage over this browser's localStorage, when there is one. */
export function browserProgressV2Storage(): ProgressV2Storage {
  const backend =
    typeof window === "undefined" ? NO_STORAGE : window.localStorage;
  return createProgressV2Storage(backend);
}
