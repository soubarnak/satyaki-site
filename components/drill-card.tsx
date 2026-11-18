// Daily Recall Drill card (spec §6, ADR-0015). Glossary: Daily Recall
// Drill, Mission, Pass, Star, Cadet. Presentational: the client wrapper
// resolves the frozen pick with lib/radar and passes one of these states.
// The Cadet-facing reason names the Planet and the missed visit only;
// the selection formula never shows.

import Link from "next/link";

export type DrillCardState =
  | { kind: "first-mission"; missionTitle: string; missionHref: string }
  | { kind: "none-today" }
  | { kind: "ready"; missionTitle: string; missionHref: string; language: string; planetName: string }
  | { kind: "done"; missionTitle: string };

export function DrillCard({ drill }: { drill: DrillCardState }): React.ReactElement {
  return (
    <section aria-label="Daily Recall Drill" className="drill-card">
      <h2>Daily Recall Drill</h2>
      {drill.kind === "first-mission" && (
        <p>
          No Pass yet, Cadet. Pass a Mission and it returns here tomorrow for a replay. Start with{" "}
          <Link href={drill.missionHref}>{drill.missionTitle}</Link>.
        </p>
      )}
      {drill.kind === "none-today" && (
        <p>No drill today, Cadet. Every Passed Mission was passed today. Fly a new Mission.</p>
      )}
      {drill.kind === "ready" && (
        <p>
          Today&apos;s replay, Cadet: <Link href={drill.missionHref}>{drill.missionTitle}</Link> in{" "}
          {drill.language}. The {drill.planetName} Planet needs practice and this Mission has not
          been visited lately. Starter code only, scratch runs, no separate reward.
        </p>
      )}
      {drill.kind === "done" && (
        <p>Drill complete, Cadet. {drill.missionTitle} is done for today. Good flying.</p>
      )}
    </section>
  );
}
