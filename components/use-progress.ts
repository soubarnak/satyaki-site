"use client";

// Reads the on-device progress record for client views. Storage access
// goes through the ADR-0007 adapter; this hook only owns the React
// lifecycle: start from empty progress (matching the server render),
// then load the stored record after mount and whenever another tab or
// a back-navigation may have changed it (DR-008 same-device freshness).

import { useEffect, useState } from "react";
import { EMPTY_PROGRESS, type Progress } from "@/lib/progress";
import { browserProgressStorage } from "@/lib/progress-storage";

export interface ProgressState {
  progress: Progress;
  /** False until the stored record has been read on this device. */
  loaded: boolean;
  /** Re-read the stored record (for example after this tab cleared it). */
  refresh(): void;
}

export function useProgress(): ProgressState {
  const [state, setState] = useState<{ progress: Progress; loaded: boolean }>({
    progress: EMPTY_PROGRESS,
    loaded: false,
  });

  useEffect(() => {
    const storage = browserProgressStorage();
    const reload = () => setState({ progress: storage.load(), loaded: true });
    reload();
    window.addEventListener("storage", reload);
    window.addEventListener("pageshow", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("pageshow", reload);
    };
  }, []);

  function refresh(): void {
    setState({ progress: browserProgressStorage().load(), loaded: true });
  }

  return { ...state, refresh };
}
