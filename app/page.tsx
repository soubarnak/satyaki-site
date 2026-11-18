// Orbit home route `/` (spec §3, issue #68, Variant A from issue #39).
// Server component, statically prerendered: the map paints before progress
// arrives and states overlay from the client wrapper with no loading gate.
// Zero three/monaco JS on this route by construction: only the orbit,
// radar, and drill modules load here.

import { OrbitHome } from "@/components/orbit-home";

export default function OrbitHomePage(): React.ReactElement {
  return <OrbitHome />;
}
