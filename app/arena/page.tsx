import { Arena } from "@/components/arena";

// Robot arena (WF-004) inside the Mission control shell. Client-side:
// the gate reads on-device progress, runs post to /api/run, and a win
// records level 10 passed in one storage write.
export default function ArenaPage() {
  return <Arena />;
}
