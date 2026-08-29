// Grades a played fixture against what the model said beforehand, so the site
// carries its own record instead of only its predictions.

import type { Outcome, Projection } from "@/lib/model";
import { lean } from "@/lib/model";
import type { Fixture, Result, Venue } from "@/lib/types";

export type Pick = "home" | "draw" | "away";

export const actualOutcome = (result: Result): Pick =>
  result.goalsHome > result.goalsAway
    ? "home"
    : result.goalsHome === result.goalsAway
      ? "draw"
      : "away";

export type Graded = {
  fixture: Fixture;
  projection: Projection;
  result: Result;
  actual: Pick;
  predicted: Pick;
  outcomeHit: boolean;
  // Null when the model called it goalless or the match was.
  firstGoalHit: boolean | null;
  scorelineHit: boolean;
  // What the model gave the outcome that actually happened.
  probabilityOfActual: number;
};

const probabilityOf = (outcome: Outcome, pick: Pick) => outcome[pick];

export function grade(
  fixture: Fixture,
  projection: Projection
): Graded | null {
  if (!fixture.result) return null;

  const result = fixture.result;
  const actual = actualOutcome(result);
  const predicted = lean(projection.outcome).pick;

  const predictedFirst: Venue | null =
    projection.firstGoal.home > projection.firstGoal.away ? "home" : "away";

  const top = projection.scorelines[0];

  return {
    fixture,
    projection,
    result,
    actual,
    predicted,
    outcomeHit: predicted === actual,
    firstGoalHit: result.firstGoal === null ? null : predictedFirst === result.firstGoal,
    scorelineHit: top.home === result.goalsHome && top.away === result.goalsAway,
    probabilityOfActual: probabilityOf(projection.outcome, actual),
  };
}

export type Tally = {
  played: number;
  outcomeHits: number;
  firstGoalHits: number;
  firstGoalGraded: number;
  scorelineHits: number;
  // Mean probability the model gave the thing that happened. Above the 0.33 a
  // coin-flip would manage means the ordering is doing something.
  meanProbabilityOfActual: number;
};

export function tally(graded: Graded[]): Tally {
  const record: Tally = {
    played: graded.length,
    outcomeHits: 0,
    firstGoalHits: 0,
    firstGoalGraded: 0,
    scorelineHits: 0,
    meanProbabilityOfActual: 0,
  };

  let probabilityTotal = 0;

  for (const match of graded) {
    if (match.outcomeHit) record.outcomeHits += 1;
    if (match.scorelineHit) record.scorelineHits += 1;
    if (match.firstGoalHit !== null) {
      record.firstGoalGraded += 1;
      if (match.firstGoalHit) record.firstGoalHits += 1;
    }
    probabilityTotal += match.probabilityOfActual;
  }

  if (graded.length > 0) {
    record.meanProbabilityOfActual = probabilityTotal / graded.length;
  }

  return record;
}
