import { Hangar } from "@/components/hangar";
import { ProgressView } from "@/components/progress-view";

// Parent progress and reset (WF-005) inside the Mission control shell,
// plus the Hangar cosmetic selection (issue #73, spec §6): equipped
// hull, trim, thruster, and laser colour from the #57 catalogue,
// stored in the v2 progress record.
// Client-side: the summary reads on-device progress, and reset clears
// the whole record behind an explicit confirmation.
export default function ProgressPage() {
  return (
    <>
      <ProgressView />
      <Hangar />
    </>
  );
}
