// Mission route `/missions/[slug]` (spec §3, issue #69).
// Server lookup from the Planet packs; the client cockpit owns Run,
// playback, and progress overlay. Unknown slugs show a load error with a
// retry control and no editor.

import Link from "next/link";
import { MissionCockpit } from "@/components/mission-cockpit";
import { PLANET_PACKS } from "@/lib/planet-packs";

function findMission(slug: string) {
  for (const pack of PLANET_PACKS) {
    const mission = pack.missions.find((m) => m.slug === slug);
    if (mission) return mission;
  }
  return undefined;
}

export default async function MissionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mission = findMission(slug);

  if (mission === undefined) {
    return (
      <>
        <h1>Mission {slug}</h1>
        <p>This Mission could not load, Cadet. Check the Mission link and try again.</p>
        <p>
          <Link href={`/missions/${slug}`}>Try again</Link> · <Link href="/">Back to the orbit map</Link>
        </p>
      </>
    );
  }

  return <MissionCockpit mission={mission} />;
}
