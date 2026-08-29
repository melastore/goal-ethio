// Dixon-Coles over the last eight matches: each team carries an attack and a
// defence number per venue, measured against the competition average, and the
// two multiply into a scoring rate. Goals fall as Poisson with a correction on
// the low scores, where independence is known to be wrong.

import type { Fixture, TeamForm, Venue } from "@/lib/types";

// Negative firms up 0-0 and 1-1. Fitted values for top leagues sit near -0.05.
const RHO = -0.06;

// Prior weight in matches. Eight matches split by venue leaves about four a
// side, so a rate from four lands halfway between the team and the league.
const PRIOR_MATCHES = 4;

const MAX_GOALS = 10;
const MINUTES = 90;

export type Baseline = {
  homeGoals: number;
  awayGoals: number;
  sample: number;
};

// Below this the pooled average is noise, so a stock baseline stands in.
const MIN_BASELINE_SAMPLE = 20;
const FALLBACK: Baseline = { homeGoals: 1.5, awayGoals: 1.2, sample: 0 };

// What a match in this competition normally looks like, pooled from the form of
// every fixture in it. Deduplicated by id: a derby sits in both teams' form.
export function baselineFor(fixtures: Fixture[], leagueId: number): Baseline {
  const seen = new Map<number, { home: number; away: number }>();

  for (const fixture of fixtures) {
    if (fixture.leagueId !== leagueId) continue;

    for (const form of [fixture.home, fixture.away]) {
      for (const match of form.matches) {
        if (seen.has(match.fixtureId)) continue;
        seen.set(
          match.fixtureId,
          match.venue === "home"
            ? { home: match.goalsFor, away: match.goalsAgainst }
            : { home: match.goalsAgainst, away: match.goalsFor }
        );
      }
    }
  }

  const sample = seen.size;
  if (sample < MIN_BASELINE_SAMPLE) return FALLBACK;

  let home = 0;
  let away = 0;
  for (const match of seen.values()) {
    home += match.home;
    away += match.away;
  }

  return { homeGoals: home / sample, awayGoals: away / sample, sample };
}

// A per-match rate pulled toward the league by how thin its evidence is.
const shrunk = (total: number, matches: number, prior: number) =>
  (total + PRIOR_MATCHES * prior) / (matches + PRIOR_MATCHES);

export type Strength = {
  attack: number;
  // 1 is average, below 1 is tighter.
  defence: number;
  matches: number;
};

export function strengthAt(form: TeamForm, venue: Venue, baseline: Baseline): Strength {
  const at = form.matches.filter((match) => match.venue === venue);

  // A home side scores at the home rate and concedes at the away rate. Dividing
  // by the right one is what lets the two factors multiply into a goal count.
  const scoringNorm = venue === "home" ? baseline.homeGoals : baseline.awayGoals;
  const concedingNorm = venue === "home" ? baseline.awayGoals : baseline.homeGoals;

  const scored = at.reduce((sum, match) => sum + match.goalsFor, 0);
  const conceded = at.reduce((sum, match) => sum + match.goalsAgainst, 0);

  return {
    attack: shrunk(scored, at.length, scoringNorm) / scoringNorm,
    defence: shrunk(conceded, at.length, concedingNorm) / concedingNorm,
    matches: at.length,
  };
}

export function expectedGoals(fixture: Fixture, baseline: Baseline) {
  const home = strengthAt(fixture.home, "home", baseline);
  const away = strengthAt(fixture.away, "away", baseline);

  return {
    home: baseline.homeGoals * home.attack * away.defence,
    away: baseline.awayGoals * away.attack * home.defence,
    homeStrength: home,
    awayStrength: away,
  };
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

// matrix[h][a] is the probability of exactly that scoreline.
export function scoreMatrix(lambdaHome: number, lambdaAway: number): number[][] {
  const matrix: number[][] = [];
  let total = 0;

  for (let h = 0; h <= MAX_GOALS; h += 1) {
    matrix[h] = [];
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const p =
        poisson(h, lambdaHome) *
        poisson(a, lambdaAway) *
        tau(h, a, lambdaHome, lambdaAway, RHO);
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

export type FirstGoal = {
  home: number;
  away: number;
  none: number;
  // Expected minute of the opening goal, given the match has one.
  expectedMinute: number;
};

// Two steady scoring rates are two competing Poisson processes, so the first
// goal splits by share of the combined rate, scaled by the chance of any goal.
export function firstGoalFrom(lambdaHome: number, lambdaAway: number): FirstGoal {
  const combined = lambdaHome + lambdaAway;
  if (combined <= 0) return { home: 0, away: 0, none: 1, expectedMinute: 0 };

  const none = Math.exp(-combined);
  const scored = 1 - none;

  // Mean waiting time, conditioned on it landing inside the ninety.
  const perMinute = combined / MINUTES;
  const expectedMinute = 1 / perMinute - (MINUTES * none) / scored;

  return {
    home: (lambdaHome / combined) * scored,
    away: (lambdaAway / combined) * scored,
    none,
    expectedMinute,
  };
}

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

// Pass a venue to read only the home or only the away half of the eight.
export function summariseForm(form: TeamForm, venue?: Venue): FormSummary {
  const matches = venue
    ? form.matches.filter((match) => match.venue === venue)
    : form.matches;

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

export type Confidence = "thin" | "fair" | "solid";

export type Projection = {
  lambdaHome: number;
  lambdaAway: number;
  outcome: Outcome;
  firstGoal: FirstGoal;
  scorelines: Scoreline[];
  markets: { btts: number; overTwoFive: number };
  homeStrength: Strength;
  awayStrength: Strength;
  homeForm: { overall: FormSummary; venue: FormSummary };
  awayForm: { overall: FormSummary; venue: FormSummary };
  confidence: Confidence;
};

export function project(fixture: Fixture, baseline: Baseline): Projection {
  const { home, away, homeStrength, awayStrength } = expectedGoals(fixture, baseline);
  const matrix = scoreMatrix(home, away);

  // The thinner of the two venue samples sets the confidence: both sides need
  // matches on record before the home/away split says anything.
  const venueMatches = Math.min(homeStrength.matches, awayStrength.matches);
  const confidence: Confidence =
    venueMatches >= 4 ? "solid" : venueMatches >= 2 ? "fair" : "thin";

  return {
    lambdaHome: home,
    lambdaAway: away,
    outcome: outcomeFrom(matrix),
    firstGoal: firstGoalFrom(home, away),
    scorelines: likeliestScorelines(matrix),
    markets: goalMarkets(matrix),
    homeStrength,
    awayStrength,
    homeForm: {
      overall: summariseForm(fixture.home),
      venue: summariseForm(fixture.home, "home"),
    },
    awayForm: {
      overall: summariseForm(fixture.away),
      venue: summariseForm(fixture.away, "away"),
    },
    confidence,
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
