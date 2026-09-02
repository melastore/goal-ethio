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
  // Squared error over the three outcomes, and the surprise in bits.
  brier: number;
  logLoss: number;
  bttsHit: boolean;
  overHit: boolean;
};

const probabilityOf = (outcome: Outcome, pick: Pick) => outcome[pick];

// Three-outcome Brier: 0 is perfect, 2 is as wrong as it gets, 0.67 is a coin.
function brierOf(outcome: Outcome, actual: Pick): number {
  let total = 0;
  for (const pick of ["home", "draw", "away"] as const) {
    const hit = pick === actual ? 1 : 0;
    total += (outcome[pick] - hit) ** 2;
  }
  return total;
}

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
  const probability = probabilityOf(projection.outcome, actual);
  const goals = result.goalsHome + result.goalsAway;
  const bothScored = result.goalsHome > 0 && result.goalsAway > 0;

  return {
    fixture,
    projection,
    result,
    actual,
    predicted,
    outcomeHit: predicted === actual,
    firstGoalHit: result.firstGoal === null ? null : predictedFirst === result.firstGoal,
    scorelineHit: top.home === result.goalsHome && top.away === result.goalsAway,
    probabilityOfActual: probability,
    brier: brierOf(projection.outcome, actual),
    // Floored so one badly missed match cannot swallow the whole average.
    logLoss: -Math.log(Math.max(probability, 1e-4)),
    bttsHit: (projection.board.btts.yes >= 0.5) === bothScored,
    overHit: (projection.board.totals[2].over >= 0.5) === (goals > 2.5),
  };
}

// Buckets for the reliability read. A model is calibrated when the matches it
// called at 60% came in about 60% of the time.
const BANDS = [
  { from: 0, to: 0.2 },
  { from: 0.2, to: 0.35 },
  { from: 0.35, to: 0.5 },
  { from: 0.5, to: 0.65 },
  { from: 0.65, to: 0.8 },
  { from: 0.8, to: 1.01 },
];

export type Band = {
  from: number;
  to: number;
  // Selections that landed in this band, and how many came in.
  n: number;
  hits: number;
  // Mean probability the model gave them, to set the hit rate against.
  claimed: number;
};

// Every outcome of every graded match is one selection, so a match contributes
// three: what it said about home, about the draw and about away.
export function reliability(graded: Graded[]): Band[] {
  const bands: Band[] = BANDS.map((band) => ({ ...band, n: 0, hits: 0, claimed: 0 }));

  for (const match of graded) {
    for (const pick of ["home", "draw", "away"] as const) {
      const p = match.projection.outcome[pick];
      const band = bands.find((b) => p >= b.from && p < b.to);
      if (!band) continue;
      band.n += 1;
      band.claimed += p;
      if (match.actual === pick) band.hits += 1;
    }
  }

  for (const band of bands) {
    if (band.n > 0) band.claimed /= band.n;
  }

  return bands.filter((band) => band.n > 0);
}

export type Tally = {
  played: number;
  outcomeHits: number;
  firstGoalHits: number;
  firstGoalGraded: number;
  scorelineHits: number;
  bttsHits: number;
  overHits: number;
  // Mean probability the model gave the thing that happened. Above the 0.33 a
  // coin-flip would manage means the ordering is doing something.
  meanProbabilityOfActual: number;
  // Brier and log loss say whether the numbers are honest, not just ordered.
  // A three-way coin sits at 0.667 and 1.099; lower is better on both.
  brier: number;
  logLoss: number;
  bands: Band[];
};

export function tally(graded: Graded[]): Tally {
  const record: Tally = {
    played: graded.length,
    outcomeHits: 0,
    firstGoalHits: 0,
    firstGoalGraded: 0,
    scorelineHits: 0,
    bttsHits: 0,
    overHits: 0,
    meanProbabilityOfActual: 0,
    brier: 0,
    logLoss: 0,
    bands: reliability(graded),
  };

  let probabilityTotal = 0;
  let brierTotal = 0;
  let logLossTotal = 0;

  for (const match of graded) {
    if (match.outcomeHit) record.outcomeHits += 1;
    if (match.scorelineHit) record.scorelineHits += 1;
    if (match.bttsHit) record.bttsHits += 1;
    if (match.overHit) record.overHits += 1;
    if (match.firstGoalHit !== null) {
      record.firstGoalGraded += 1;
      if (match.firstGoalHit) record.firstGoalHits += 1;
    }
    probabilityTotal += match.probabilityOfActual;
    brierTotal += match.brier;
    logLossTotal += match.logLoss;
  }

  if (graded.length > 0) {
    record.meanProbabilityOfActual = probabilityTotal / graded.length;
    record.brier = brierTotal / graded.length;
    record.logLoss = logLossTotal / graded.length;
  }

  return record;
}
