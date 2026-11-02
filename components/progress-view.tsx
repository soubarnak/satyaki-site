"use client";

// Parent progress view at `/progress` (WF-005, FR-012, FR-013): levels
// passed, derived points, earned badges, streak dates, the browser
// storage-loss warning (DR-009), and reset behind an explicit
// confirmation that clears the whole on-device record in one action
// (DR-007). All numbers derive from the pure core in
// lib/progress-view.ts; this component only renders them.

import { useState } from "react";
import { EMPTY_PROGRESS, localDateString } from "@/lib/progress";
import { browserProgressStorage } from "@/lib/progress-storage";
import { PROGRESS_STORAGE_WARNING, progressSummary } from "@/lib/progress-view";
import { Bolt } from "./bolt";
import { useProgress } from "./use-progress";

function boltMessage(loaded: boolean, hasProgress: boolean, passedCount: number): string {
  if (!loaded) return "Loading your progress, Cadet.";
  if (!hasProgress) return "No quest progress yet, Cadet. Pass Level 1 on Volta to begin.";
  if (passedCount === 10) return "Every planet passed, Cadet. What a quest!";
  return "Good flying, Cadet. Your grown-up can check your quest here.";
}

export function ProgressView() {
  const { progress, loaded, refresh } = useProgress();
  const [confirming, setConfirming] = useState(false);
  const view = progressSummary(loaded ? progress : EMPTY_PROGRESS, localDateString(new Date()));

  function handleConfirmReset(): void {
    browserProgressStorage().clear();
    refresh();
    setConfirming(false);
  }

  return (
    <>
      <h1>Progress</h1>
      <p className="map-intro">A page for your grown-up, Cadet. Your quest so far shows below.</p>

      <div className="bolt-row">
        <Bolt size={72} />
        <p className="bolt-bubble" role="status">
          {confirming
            ? "Reset erases everything, Cadet. Is your grown-up sure?"
            : boltMessage(loaded, view.hasProgress, view.passedCount)}
        </p>
      </div>

      {loaded && (
        <section className="map-stats" aria-label="Quest progress summary">
          <p>
            Levels passed:{" "}
            <strong>
              {view.passedCount} of {view.totalLevels}
            </strong>
          </p>
          <p>
            Total points: <strong>{view.totalPoints}</strong>
          </p>
          <p>
            Day streak: <strong>{view.streak}</strong>
          </p>
          <p>
            Badges: <strong>{view.badges.length > 0 ? view.badges.join(", ") : "None yet"}</strong>
          </p>
          <p>
            Streak days:{" "}
            <strong>{view.streakDates.length > 0 ? view.streakDates.join(", ") : "None yet"}</strong>
          </p>
        </section>
      )}

      <section className="progress-warning" aria-label="Storage warning">
        <p>
          <strong>Warning.</strong> {PROGRESS_STORAGE_WARNING}
        </p>
      </section>

      <section aria-label="Reset progress">
        <h2>Reset progress</h2>
        {!confirming ? (
          <p>
            <button
              type="button"
              className="progress-reset"
              disabled={!loaded || !view.hasProgress}
              onClick={() => setConfirming(true)}
            >
              Reset progress
            </button>
          </p>
        ) : (
          <div className="progress-confirm">
            <p>
              Reset all progress? This erases every passed level, point, badge, and streak day.
              This cannot be undone.
            </p>
            <div className="progress-confirm-row">
              <button type="button" className="progress-reset" onClick={handleConfirmReset}>
                Yes, reset everything
              </button>
              <button
                type="button"
                className="progress-keep"
                onClick={() => setConfirming(false)}
              >
                Keep progress
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
