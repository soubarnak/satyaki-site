import { LevelMap } from "@/components/level-map";

// Level map (WF-001) inside the Mission control shell. Progress lives
// in browser storage only, so the map itself is a client component
// deriving from the pure core in lib/level-map.ts.
export default function LevelMapPage() {
  return <LevelMap />;
}
