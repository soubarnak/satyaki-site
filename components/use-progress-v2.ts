"use client";

// Reads the v2 progress record for client views. Storage access goes
// through the v2 adapter; this hook only owns the React lifecycle: start
// from the empty record (matching the server render), then load the stored
// record after mount and whenever another tab or a back-navigation may
// have changed it. Never gates callers: render the map first, overlay
// states when this reports loaded.

import { useEffect, useState } from "react";
import { EMPTY_PROGRESS_V2, type ProgressV2 } from "@/lib/progress";
import { browserProgressV2Storage } from "@/lib/progress-v2-storage";

export interface ProgressV2State {
  progress: ProgressV2;
  /** False until the stored record has been read on this device. */
  loaded: boolean;
  /** Re-read the stored record. */
  refresh(): void;
}

export function useProgressV2(): ProgressV2State {
  const [state, setState] = useState<{ progress: ProgressV2; loaded: boolean }>({
    progress: EMPTY_PROGRESS_V2,
    loaded: false,
  });

  useEffect(() => {
    const storage = browserProgressV2Storage();
    const reload = (): void => setState({ progress: storage.load(), loaded: true });
    reload();
    window.addEventListener("storage", reload);
    window.addEventListener("pageshow", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("pageshow", reload);
    };
  }, []);

  function refresh(): void {
    setState({ progress: browserProgressV2Storage().load(), loaded: true });
  }

  return { ...state, refresh };
}
