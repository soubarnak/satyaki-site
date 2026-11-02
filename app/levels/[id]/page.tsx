import Link from "next/link";
import { LessonPlayer } from "@/components/lesson-player";
import { getLevel } from "@/lib/levels";

export default async function LevelPage({ params }: PageProps<"/levels/[id]">) {
  const { id } = await params;
  const levelId = Number(id);
  const level = Number.isInteger(levelId) ? getLevel(levelId) : undefined;

  if (level === undefined) {
    // FR-003 AC-2: failed level load shows a load error with a retry
    // control, and no editor.
    return (
      <>
        <h1>Level {id}</h1>
        <p>This level could not load, Cadet. Check the level number and try again.</p>
        <p>
          <Link href={`/levels/${id}`}>Try again</Link> · <Link href="/">Back to the level map</Link>
        </p>
      </>
    );
  }

  if (level.id === 10) {
    // FR-002 AC-2: level 10 is the robot arena, never a lesson level.
    return (
      <>
        <h1>Level 10: Rescue Signal</h1>
        <p>
          The final mission plays in the robot arena, Cadet. Send Bolt there to
          win the rescue signal.
        </p>
        <p>
          <Link href="/arena">To the robot arena</Link> · <Link href="/">Back to the level map</Link>
        </p>
      </>
    );
  }

  return <LessonPlayer level={level} />;
}
