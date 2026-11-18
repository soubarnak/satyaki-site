"use client";

// Boss Gate flow (issue #70, spec §§5,8, ADR-0010/0011).
// Glossary: Boss Gate, Pass, Cadet. Part A is five authored quiz items
// with a 4/5 gate, one-line explanations, and unlimited retakes with no
// cooldown (grading is stateless; a pass persists on this device only).
// Part B stays locked until Part A passes and reuses the Mission
// cockpit run/grader with 3 Seeds and no Stars; each Run records a Boss
// attempt (passed flag, attempts, last attempt) and a clear unlocks the
// next Planet through the derived unlock state, which survives sync
// merge by union (never downgrades).

import { useEffect, useMemo, useState } from "react";
import type { BossGate, Mission, PlanetConceptId } from "@/lib/content";
import { gradeBossPartA, isBossPartBUnlocked, type BossPartAResult } from "@/lib/boss-gate";
import { isBossPassedV2 } from "@/lib/progress";
import { MissionCockpit } from "./mission-cockpit";
import { useProgressV2 } from "./use-progress-v2";

function partAKey(slug: string): string {
  return `boss-partA-passed:${slug}`;
}

function loadPartAPass(slug: string): boolean {
  try {
    return window.localStorage.getItem(partAKey(slug)) === "1";
  } catch {
    return false;
  }
}

export function BossGateFlow({
  boss,
  planetConceptId,
  planetName,
}: {
  boss: BossGate;
  planetConceptId: PlanetConceptId;
  planetName: string;
}): React.ReactElement {
  const [answers, setAnswers] = useState<Array<number | null>>(() => boss.partA.map(() => null));
  const [attempt, setAttempt] = useState<BossPartAResult | null>(null);
  const [partAPassed, setPartAPassed] = useState(false);
  const { progress } = useProgressV2();
  const gatePassed = isBossPassedV2(progress, boss.planet);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync persisted Part A pass after mount; first paint matches the server
      setPartAPassed(loadPartAPass(boss.slug));
    } catch {
      // Private mode: Part A pass lasts this visit only.
    }
  }, [boss.slug]);

  const partBUnlocked = isBossPartBUnlocked(partAPassed);

  const partBMission: Mission = useMemo(
    () => ({
      slug: boss.partB.slug,
      planet: boss.planet,
      position: 5,
      conceptId: "sequence",
      planetConceptId,
      tier: "stretch",
      title: `${boss.title}: Part B`,
      story: boss.partB.briefing,
      briefing: boss.partB.briefing,
      objectives: boss.partB.objectives,
      pythonStarter: boss.partB.pythonStarter,
      javaStarter: boss.partB.javaStarter,
      trainingWheels: boss.partB.trainingWheels,
      layout: boss.partB.layout,
      seedPool: boss.partB.seedPool,
      checks: boss.partB.checks,
      par: { maxSteps: 500, maxEnergy: 500 },
      star3Concept: planetConceptId,
      hints: boss.partB.hints,
      rosetta: {
        python: "log(0)",
        java: "log(0);",
        note: "Boss Part B carries no Rosetta Pair.",
      },
    }),
    [boss, planetConceptId],
  );

  function pick(item: number, option: number): void {
    setAnswers((prev) => prev.map((each, index) => (index === item ? option : each)));
  }

  function checkPartA(): void {
    const graded = gradeBossPartA(
      boss,
      answers.map((each) => (each === null ? -1 : each)),
    );
    setAttempt(graded);
    if (graded.passed) {
      setPartAPassed(true);
      try {
        window.localStorage.setItem(partAKey(boss.slug), "1");
      } catch {
        // Private mode: pass lasts this visit only.
      }
    }
  }

  function retryPartA(): void {
    setAnswers(boss.partA.map(() => null));
    setAttempt(null);
  }

  return (
    <div className="boss-gate">
      <section aria-label="Briefing" className="cockpit-strip">
        <div>
          <h1>{boss.title}</h1>
          <p>
            Part A is a five-question quiz. Answer 4 of 5 to open Part B, the {planetName} coding
            challenge.
          </p>
        </div>
        <div className="cockpit-strip-side">
          <span className="boss-state">
            {gatePassed ? "Gate passed" : partAPassed ? "Part A passed" : "Part A open"}
          </span>
        </div>
      </section>

      <section aria-label="Part A quiz" className="boss-part-a">
        <h2>Part A — Quiz</h2>
        <p>Try again as often as you like, Cadet. No cooldown.</p>
        <ol>
          {boss.partA.map((item, index) => (
            <li key={`${boss.slug}-q${index}`}>
              <p>{item.prompt}</p>
              <div role="radiogroup" aria-label={`Question ${index + 1}`}>
                {item.options.map((option, optionIndex) => (
                  <label key={`${boss.slug}-q${index}-o${optionIndex}`}>
                    <input
                      checked={answers[index] === optionIndex}
                      name={`${boss.slug}-q${index}`}
                      onChange={() => pick(index, optionIndex)}
                      type="radio"
                    />
                    {option}
                  </label>
                ))}
              </div>
              {attempt !== null && (
                <p>
                  {attempt.items[index].correct ? "Right." : "Not quite."}{" "}
                  {attempt.items[index].explanation}
                </p>
              )}
            </li>
          ))}
        </ol>
        {attempt !== null && (
          <p role="status">
            Part A: {attempt.correct} of {attempt.total}.{" "}
            {attempt.passed ? "Part B is open." : "Not yet — try again."}
          </p>
        )}
        <button onClick={checkPartA} type="button">
          Check Part A
        </button>{" "}
        <button onClick={retryPartA} type="button">
          Try Part A again
        </button>
      </section>

      <section aria-label="Part B challenge" className="boss-part-b">
        <h2>Part B — Challenge</h2>
        {partBUnlocked ? (
          <>
            <p>Clear this challenge to pass the {planetName} Gate and open the next Planet.</p>
            <MissionCockpit bossPlanet={boss.planet} mission={partBMission} />
          </>
        ) : (
          <p>Part B stays locked until Part A passes, Cadet.</p>
        )}
      </section>
    </div>
  );
}
