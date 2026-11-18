// Mission route `/missions/[slug]` (spec §3, issues #69, #70).
// Server lookup from the Planet packs; the client cockpit owns Run,
// playback, and progress overlay. Boss Gate slugs render the Boss Gate
// flow (Part A quiz, then the Part B challenge); unknown slugs show a
// load error with a retry control and no editor.

import Link from "next/link";
import { BossGateFlow } from "@/components/boss-gate";
import { MissionCockpit } from "@/components/mission-cockpit";
import { PLANET_PACKS } from "@/lib/planet-packs";

function findMission(slug: string) {
  for (const pack of PLANET_PACKS) {
    const mission = pack.missions.find((m) => m.slug === slug);
    if (mission) return mission;
  }
  return undefined;
}

function findBoss(slug: string) {
  for (const pack of PLANET_PACKS) {
    if (pack.boss.slug === slug) return { pack, boss: pack.boss };
    // Older orbit links pointed at the Part B slug; resolve those to
    // the parent Boss Gate so Part B stays behind the Part A gate.
    if (pack.boss.partB.slug === slug) return { pack, boss: pack.boss };
  }
  return undefined;
}

export default async function MissionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mission = findMission(slug);

  if (mission !== undefined) {
    return <MissionCockpit mission={mission} />;
  }

  const found = findBoss(slug);
  if (found !== undefined) {
    return (
      <BossGateFlow
        boss={found.boss}
        planetConceptId={found.pack.planet.planetConceptId}
        planetName={found.pack.planet.name}
      />
    );
  }

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
