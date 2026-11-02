import { ProgressView } from "@/components/progress-view";

// Parent progress and reset (WF-005) inside the Mission control shell.
// Client-side: the summary reads on-device progress, and reset clears
// the whole record behind an explicit confirmation.
export default function ProgressPage() {
  return <ProgressView />;
}
