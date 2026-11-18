import { Arena } from "@/components/arena";

// Arena (ADR-0014) inside the Mission control shell. Client-side:
// the Account gate fetches /api/auth/me, ticks run in the language
// workers, replay follows the cockpit model, and one finished battle
// writes once to the v2 record. Abandoned battles write nothing.
export default function ArenaPage() {
  return <Arena />;
}
