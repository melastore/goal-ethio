// Dixon-Coles: two Poisson rates from the sides' fitted attack and defence, with
// a correction on the low scores where independence is known to be wrong. The
// ratings come from ratings.ts, so a rate here is already opponent-adjusted.

import { board, type Board } from "@/lib/markets";
import { keyOf, ratingOf, weightOf, type Ratings, type TeamRating } from "@/lib/ratings";
import type { Fixture, H2HMatch, TeamForm, Venue } from "@/lib/types";

export { weightOf };

// Negative firms up 0-0 and 1-1. Fitted values for top leagues sit near -0.05.
const RHO = -0.06;

const MAX_GOALS = 10;
const MINUTES = 90;

// Rates below this stop being football and start being arithmetic.
const MIN_LAMBDA = 0.15;
const MAX_LAMBDA = 4.5;

// How far a head-to-head record may move a match, in goals of swing. Small on
// purpose: once both sides are rated against every opponent they have faced, a
// few past meetings add very little the ratings do not already have.
const MAX_H2H_SWING = 0.18;
const H2H_PRIOR = 4;

export type Sides = {
  home: TeamRating;
  away: TeamRating;
};

export function ratingsFor(fixture: Fixture, ratings: Ratings): Sides {
  return {
    home: ratingOf(ratings, keyOf(fixture.home.team.id, fixture.home.team.logo, fixture.home.team.short)),
    away: ratingOf(ratings, keyOf(fixture.away.team.id, fixture.away.team.logo, fixture.away.team.short)),
  };
}

// One league rate per end of the pitch, times the scorer's attack and the
// conceder's defence. Everything after this product is a named adjustment.
export function ratesFrom(ratings: Ratings, home: TeamRating, away: TeamRating) {
  // The pooled rate, not the league's. A rating is already on the common scale,
  // and the anchor that put it there carries the league's own goal rate: using
  // the league mean here as well applies it twice.
  const mean = ratings.pooled;
  return {
    home: mean.home * home.attack * away.defence,
    away: mean.away * away.attack * home.defence,
  };
}

export function expectedGoals(fixture: Fixture, ratings: Ratings) {
  const sides = ratingsFor(fixture, ratings);
  const rates = ratesFrom(ratings, sides.home, sides.away);

  let lambdaHome = rates.home;
  let lambdaAway = rates.away;

  // Venue records as swing that leaves the total alone: a fortress redistributes
  // goals, it does not add them.
  const edge = (sides.home.homeEdge - sides.away.homeEdge) / 2;
  lambdaHome += edge / 2;
  lambdaAway -= edge / 2;

  const swing = h2hSwing(fixture);
  lambdaHome += swing / 2;
  lambdaAway -= swing / 2;

  return {
    home: clamp(lambdaHome),
    away: clamp(lambdaAway),
    sides,
    homeEdge: edge,
    h2hSwing: swing,
  };
}

const clamp = (lambda: number) => Math.max(MIN_LAMBDA, Math.min(MAX_LAMBDA, lambda));

// Goals of swing toward the home side from the record between the two.
function h2hSwing(fixture: Fixture): number {
  const meetings = fixture.h2h ?? [];
  if (meetings.length < 2) return 0;

  const homeId = fixture.home.team.id;
  let margin = 0;
  let weight = 0;

  for (const meeting of meetings) {
    const wasHome = meeting.homeId === homeId;
    const forHome = wasHome ? meeting.goalsHome : meeting.goalsAway;
    const forAway = wasHome ? meeting.goalsAway : meeting.goalsHome;
    // Both grounds count: a meeting at the other one still says something.
    const w = weightOf(meeting.kickoff, fixture.kickoff);
    margin += (forHome - forAway) * w;
    weight += w;
  }

  if (weight <= 0) return 0;

  const perMeeting = margin / weight;
  const shrunk = perMeeting * (weight / (weight + H2H_PRIOR));
  return Math.max(-MAX_H2H_SWING, Math.min(MAX_H2H_SWING, shrunk * 0.25));
}

const factorial = (n: number) => {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
};

export const poisson = (k: number, lambda: number) =>
  (Math.exp(-lambda) * lambda ** k) / factorial(k);

// Independent Poisson puts 0-0 and 1-1 too low and the 1-0s too high.
function tau(x: number, y: number, lh: number, la: number, rho: number) {
  if (x === 0 && y === 0) return 1 - lh * la * rho;
  if (x === 0 && y === 1) return 1 + lh * rho;
  if (x === 1 && y === 0) return 1 + la * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

// matrix[h][a] is the probability of exactly that scoreline. Turn `correct` off
// for a half or a remainder: the low-score correction is fitted against ninety
// minutes, and applying it per piece double-counts it.
export function scoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  correct = true
): number[][] {
  const matrix: number[][] = [];
  let total = 0;

  const home = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, lambdaHome));
  const away = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, lambdaAway));

  for (let h = 0; h <= MAX_GOALS; h += 1) {
    matrix[h] = [];
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const p = home[h] * away[a] * (correct ? tau(h, a, lambdaHome, lambdaAway, RHO) : 1);
      matrix[h][a] = p;
      total += p;
    }
  }

  // The correction and the truncation each cost a little mass. Give it back so
  // what lands on screen adds to a hundred.
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) matrix[h][a] /= total;
  }

  return matrix;
}

export type Outcome = { home: number; draw: number; away: number };

export function outcomeFrom(matrix: number[][]): Outcome {
  let home = 0;
  let draw = 0;
  let away = 0;

  matrix.forEach((row, h) =>
    row.forEach((p, a) => {
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    })
  );

  return { home, draw, away };
}

export type Scoreline = { home: number; away: number; probability: number };

export function likeliestScorelines(matrix: number[][], count = 3): Scoreline[] {
  const all: Scoreline[] = [];
  matrix.forEach((row, home) =>
    row.forEach((probability, away) => all.push({ home, away, probability }))
  );

  return all.sort((a, b) => b.probability - a.probability).slice(0, count);
}

export function goalMarkets(matrix: number[][]) {
  let btts = 0;
  let overTwoFive = 0;

  matrix.forEach((row, h) =>
    row.forEach((p, a) => {
      if (h > 0 && a > 0) btts += p;
      if (h + a > 2.5) overTwoFive += p;
    })
  );

  return { btts, overTwoFive };
}

/* -------------------------------------------------------------------------- */
/* When the goals arrive                                                       */
/* -------------------------------------------------------------------------- */

// Scoring rises through a match, so a flat rate puts the opening goal too early
// and the early windows too high. Taken as rising linearly, with the slope set
// by the share of goals landing before the break.
export function intensitySlope(firstHalfShare: number): number {
  return Math.max(-0.8, Math.min(0.8, 8 * (0.5 - firstHalfShare)));
}

// Goals expected in the opening `minute` minutes, as a share of the match's.
export function elapsedShare(minute: number, slope: number): number {
  const x = Math.max(0, Math.min(1, minute / MINUTES));
  const flat = 1 - slope / 2;
  return flat * x + (slope * x * x) / 2;
}

export type FirstGoal = {
  home: number;
  away: number;
  none: number;
  // Expected minute of the opening goal, given the match has one.
  expectedMinute: number;
  // Chance a goal has arrived by 15, 30, 45, 60, 75.
  byMinute: { minute: number; scored: number }[];
};

const WINDOWS = [15, 30, 45, 60, 75];

// Two rates are two competing processes, so the first goal splits by share of
// the combined rate, nudged a little toward what each side has actually done.
export function firstGoalFrom(
  lambdaHome: number,
  lambdaAway: number,
  options: { homeFirstRate?: number; awayFirstRate?: number; decided?: number; slope?: number } = {}
): FirstGoal {
  const combined = lambdaHome + lambdaAway;
  if (combined <= 0) {
    return { home: 0, away: 0, none: 1, expectedMinute: 0, byMinute: [] };
  }

  const slope = options.slope ?? 0;
  const none = Math.exp(-combined);
  const scored = 1 - none;

  let homeShare = lambdaHome / combined;

  const { homeFirstRate, awayFirstRate, decided = 0 } = options;
  if (homeFirstRate !== undefined && awayFirstRate !== undefined && decided > 0) {
    const total = homeFirstRate + awayFirstRate;
    if (total > 0) {
      // Caps around a tenth: who starts fast is real, and small.
      const trust = 0.2 * (decided / (decided + 6));
      homeShare = (1 - trust) * homeShare + trust * (homeFirstRate / total);
    }
  }

  const byMinute = WINDOWS.map((minute) => ({
    minute,
    scored: 1 - Math.exp(-combined * elapsedShare(minute, slope)),
  }));

  return {
    home: homeShare * scored,
    away: (1 - homeShare) * scored,
    none,
    expectedMinute: expectedFirstMinute(combined, slope),
    byMinute,
  };
}

// Mean minute of the opening goal given there is one. Integrated rather than
// solved: the rising rate has no tidy closed form, and a minute of resolution is
// all anything on screen shows.
function expectedFirstMinute(combined: number, slope: number): number {
  let weighted = 0;
  let mass = 0;
  let previous = 0;

  for (let minute = 1; minute <= MINUTES; minute += 1) {
    const cumulative = 1 - Math.exp(-combined * elapsedShare(minute, slope));
    const inThisMinute = cumulative - previous;
    weighted += (minute - 0.5) * inThisMinute;
    mass += inThisMinute;
    previous = cumulative;
  }

  return mass > 0 ? weighted / mass : MINUTES;
}

/* -------------------------------------------------------------------------- */
/* Form, read rather than modelled                                             */
/* -------------------------------------------------------------------------- */

export type FormSummary = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  // Most recent first.
  sequence: ("W" | "D" | "L")[];
  scoredFirst: number;
  // Matches that had a first goal at all, the denominator for scoredFirst.
  decided: number;
  averageFirstGoalMinute: number | null;
};

// Pass a venue to read only the home or only the away half of the ten, and a
// limit to cut the overall read back to a headline last five.
export function summariseForm(form: TeamForm, venue?: Venue, limit?: number): FormSummary {
  const at = venue ? form.matches.filter((match) => match.venue === venue) : form.matches;
  const matches = limit === undefined ? at : at.slice(0, limit);

  const summary: FormSummary = {
    played: matches.length,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    sequence: [],
    scoredFirst: 0,
    decided: 0,
    averageFirstGoalMinute: null,
  };

  let minuteTotal = 0;
  let minuteCount = 0;

  for (const match of matches) {
    summary.goalsFor += match.goalsFor;
    summary.goalsAgainst += match.goalsAgainst;

    if (match.goalsFor > match.goalsAgainst) {
      summary.won += 1;
      summary.sequence.push("W");
    } else if (match.goalsFor === match.goalsAgainst) {
      summary.drawn += 1;
      summary.sequence.push("D");
    } else {
      summary.lost += 1;
      summary.sequence.push("L");
    }

    if (match.firstGoal !== null) {
      summary.decided += 1;
      if (match.firstGoal === "for") summary.scoredFirst += 1;
    }

    if (match.firstGoalMinute !== null) {
      minuteTotal += match.firstGoalMinute;
      minuteCount += 1;
    }
  }

  if (minuteCount > 0) summary.averageFirstGoalMinute = minuteTotal / minuteCount;

  return summary;
}

// The head-to-head record, always told from the fixture's home side.
export type H2HSummary = {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  // Goals scored by each side of the coming fixture, across every meeting.
  goalsHome: number;
  goalsAway: number;
  // Meetings played at the coming fixture's home ground.
  atThisVenue: number;
  homeWinsAtThisVenue: number;
};

export function summariseH2H(meetings: H2HMatch[], homeTeamId: number): H2HSummary {
  const summary: H2HSummary = {
    played: meetings.length,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    goalsHome: 0,
    goalsAway: 0,
    atThisVenue: 0,
    homeWinsAtThisVenue: 0,
  };

  for (const meeting of meetings) {
    // The coming fixture's home side was not necessarily at home that day.
    const wasHome = meeting.homeId === homeTeamId;
    const forHome = wasHome ? meeting.goalsHome : meeting.goalsAway;
    const forAway = wasHome ? meeting.goalsAway : meeting.goalsHome;

    summary.goalsHome += forHome;
    summary.goalsAway += forAway;

    if (forHome > forAway) summary.homeWins += 1;
    else if (forHome === forAway) summary.draws += 1;
    else summary.awayWins += 1;

    if (wasHome) {
      summary.atThisVenue += 1;
      if (forHome > forAway) summary.homeWinsAtThisVenue += 1;
    }
  }

  return summary;
}

/* -------------------------------------------------------------------------- */
/* The projection                                                              */
/* -------------------------------------------------------------------------- */

export type Confidence = "thin" | "fair" | "solid";

export type SideRating = {
  attack: number;
  defence: number;
  homeEdge: number;
  sample: number;
  overall: number;
};

export type Projection = {
  lambdaHome: number;
  lambdaAway: number;
  outcome: Outcome;
  firstGoal: FirstGoal;
  scorelines: Scoreline[];
  markets: { btts: number; overTwoFive: number };
  homeRating: SideRating;
  awayRating: SideRating;
  homeForm: { overall: FormSummary; venue: FormSummary };
  awayForm: { overall: FormSummary; venue: FormSummary };
  h2h: H2HSummary;
  confidence: Confidence;
  // Every other market the goal data supports.
  board: Board;
};

const sideRating = (rating: TeamRating): SideRating => ({
  attack: rating.attack,
  defence: rating.defence,
  homeEdge: rating.homeEdge,
  sample: rating.sample,
  overall: Math.round((rating.attack / Math.max(rating.defence, 0.2)) * 100),
});

export function project(fixture: Fixture, ratings: Ratings): Projection {
  const { home, away, sides } = expectedGoals(fixture, ratings);
  const matrix = scoreMatrix(home, away);

  // The thinner of the two ratings sets the confidence, counted after decay:
  // four matches from last spring are not four matches.
  const evidence = Math.min(sides.home.sample, sides.away.sample);
  const confidence: Confidence = evidence >= 4 ? "solid" : evidence >= 2 ? "fair" : "thin";

  const built = board(matrix, home, away, fixture.home, fixture.away);

  const homeSummary = summariseForm(fixture.home, undefined, 5);
  const awaySummary = summariseForm(fixture.away, undefined, 5);
  const decided = homeSummary.decided + awaySummary.decided;
  const homeRate = homeSummary.decided > 0 ? homeSummary.scoredFirst / homeSummary.decided : 0.5;
  const awayRate = awaySummary.decided > 0 ? awaySummary.scoredFirst / awaySummary.decided : 0.5;

  return {
    lambdaHome: home,
    lambdaAway: away,
    outcome: outcomeFrom(matrix),
    firstGoal: firstGoalFrom(home, away, {
      homeFirstRate: homeRate,
      awayFirstRate: awayRate,
      decided,
      slope: intensitySlope(built.halfTime.share),
    }),
    scorelines: likeliestScorelines(matrix),
    markets: goalMarkets(matrix),
    homeRating: sideRating(sides.home),
    awayRating: sideRating(sides.away),
    homeForm: {
      // The overall strip is the last five outright; the venue strip is the
      // five that actually bear on this fixture.
      overall: homeSummary,
      venue: summariseForm(fixture.home, "home"),
    },
    awayForm: {
      overall: awaySummary,
      venue: summariseForm(fixture.away, "away"),
    },
    h2h: summariseH2H(fixture.h2h ?? [], fixture.home.team.id),
    confidence,
    board: built,
  };
}

export const impliedOdds = (probability: number) =>
  probability > 0 ? 1 / probability : Infinity;

// The side the model leans to, and by how much over the next best.
export function lean(outcome: Outcome) {
  const ranked = [
    { pick: "home" as const, p: outcome.home },
    { pick: "draw" as const, p: outcome.draw },
    { pick: "away" as const, p: outcome.away },
  ].sort((a, b) => b.p - a.p);

  return { pick: ranked[0].pick, probability: ranked[0].p, margin: ranked[0].p - ranked[1].p };
}
