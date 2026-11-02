import { Playground } from "@/components/playground";

// Playground (WF-003) inside the Mission control shell. Client-side
// only: runs post to /api/run and never touch progress storage.
export default function PlaygroundPage() {
  return <Playground />;
}
