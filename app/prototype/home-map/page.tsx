// PROTOTYPE — throwaway, not production. Ticket: Prototype: instant-render solar system home map.
// Three variants of the home map, switchable via ?variant=, on /prototype/home-map.
// Question: can home render instantly (no loading gate), with progress states overlaid after arrival?
import { PrototypeHomeMap } from "@/components/prototype-home-map";

export default function HomeMapPrototypePage() {
  return <PrototypeHomeMap />;
}
