// Re-projects a match from where it actually stands.
//
// A pre-match number is stale the moment a goal goes in. What is left to play
// for is the remaining scoring rate, so the same Poisson runs over the minutes
// still on the clock and the goals already scored are added back on.

import { elapsedShare, intensitySlope, poisson } from "@/lib/model";
import type { Outcome } from "@/lib/model";

const MINUTES = 90;
const MAX_REMAINING = 8;

// A trailing side pushes and a leading side sits, worth roughly a fifth of a
// goal per goal of deficit over a full half. Beyond two goals the effect stops
// growing: three down with twenty left is not chased any harder than two.
const CHASE_PER_GOAL = 0.2;
const MAX_CHASE_GOALS = 2;

export type LiveState = {
  minute: number;
  goalsHome: number;
  goalsAway: number;
  // "HT" pauses the clock without ending the match.
  period?: string | null;
};

export type LiveProjection = {
  outcome: Outcome;
  // What is still expected from here, per side.
  remainingHome: number;
  remainingAway: number;
  minutesLeft: number;
  // Chance of another goal at all, and who gets it.
  nextGoal: { home: number; away: number; none: number };
  btts: number;
  // Over lines counted on the final total, current goals included.
  totals: { line: number; over: number; under: number }[];
  scorelines: { home: number; away: number; probability: number }[];
};

const clampMinute = (state: LiveState) => {
  if (state.period === "HT") return 45;
  return Math.max(0, Math.min(MINUTES, state.minute));
};

// What the two sides are still expected to score, after the clock and the
// scoreline are both taken into account.
export function remainingRates(
  lambdaHome: number,
  lambdaAway: number,
  state: LiveState,
  firstHalfShare = 0.45
) {
  const minute = clampMinute(state);
  const slope = intensitySlope(firstHalfShare);
  const left = Math.max(0, 1 - elapsedShare(minute, slope));

  let home = lambdaHome * left;
  let away = lambdaAway * left;

  // Game state, scaled by how much of the match is left to chase in.
  const deficit = state.goalsHome - state.goalsAway;
  if (deficit !== 0) {
    const size = Math.min(Math.abs(deficit), MAX_CHASE_GOALS);
    const chase = CHASE_PER_GOAL * size * left;
    if (deficit > 0) {
      away += chase;
      home = Math.max(0.02, home - chase * 0.4);
    } else {
      home += chase;
      away = Math.max(0.02, away - chase * 0.4);
    }
  }

  return { home, away, minutesLeft: Math.round(MINUTES - minute), left };
}

export function projectLive(
  lambdaHome: number,
  lambdaAway: number,
  state: LiveState,
  firstHalfShare = 0.45
): LiveProjection {
  const rates = remainingRates(lambdaHome, lambdaAway, state, firstHalfShare);

  // Independent Poisson over what is left. The low-score correction belongs to
  // a whole match, not to a remainder of one.
  const home = Array.from({ length: MAX_REMAINING + 1 }, (_, k) => poisson(k, rates.home));
  const away = Array.from({ length: MAX_REMAINING + 1 }, (_, k) => poisson(k, rates.away));

  const outcome: Outcome = { home: 0, draw: 0, away: 0 };
  const finals = new Map<string, { home: number; away: number; probability: number }>();
  let bothScore = 0;
  const totalsCount = new Map<number, number>();
  let mass = 0;

  for (let h = 0; h <= MAX_REMAINING; h += 1) {
    for (let a = 0; a <= MAX_REMAINING; a += 1) {
      const p = home[h] * away[a];
      if (p < 1e-10) continue;
      mass += p;

      const finalHome = state.goalsHome + h;
      const finalAway = state.goalsAway + a;

      if (finalHome > finalAway) outcome.home += p;
      else if (finalHome === finalAway) outcome.draw += p;
      else outcome.away += p;

      if (finalHome > 0 && finalAway > 0) bothScore += p;

      const total = finalHome + finalAway;
      totalsCount.set(total, (totalsCount.get(total) ?? 0) + p);

      const key = `${finalHome}-${finalAway}`;
      const existing = finals.get(key);
      if (existing) existing.probability += p;
      else finals.set(key, { home: finalHome, away: finalAway, probability: p });
    }
  }

  // The grid is truncated, so give the lost tail back.
  const scale = mass > 0 ? 1 / mass : 1;
  outcome.home *= scale;
  outcome.draw *= scale;
  outcome.away *= scale;
  bothScore *= scale;

  const totals = [0.5, 1.5, 2.5, 3.5, 4.5].map((line) => {
    let over = 0;
    for (const [total, p] of totalsCount) if (total > line) over += p * scale;
    return { line, over, under: 1 - over };
  });

  const combined = rates.home + rates.away;
  const none = Math.exp(-combined);

  return {
    outcome,
    remainingHome: rates.home,
    remainingAway: rates.away,
    minutesLeft: rates.minutesLeft,
    nextGoal: {
      home: combined > 0 ? (rates.home / combined) * (1 - none) : 0,
      away: combined > 0 ? (rates.away / combined) * (1 - none) : 0,
      none,
    },
    btts: bothScore,
    totals,
    scorelines: [...finals.values()]
      .map((entry) => ({ ...entry, probability: entry.probability * scale }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3),
  };
}
