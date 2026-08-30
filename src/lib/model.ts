// Dixon-Coles over the last five matches at each venue: each team carries an
// attack and a defence number per venue, measured against the competition
// average, and the two multiply into a scoring rate. Goals fall as Poisson with a correction on
// the low scores, where independence is known to be wrong.

import { board, type Board } from "@/lib/markets";
import type { Fixture, H2HMatch, TeamForm, Venue } from "@/lib/types";

// Negative firms up 0-0 and 1-1. Fitted values for top leagues sit near -0.05.
const RHO = -0.06;

// Prior weight in matches. Five a venue with decay is worth a few effective
// matches, so a rate from that lands about halfway between team and league.
const PRIOR_MATCHES = 4;

/**
 * Half-life of a result, in days.
 *
 * Dixon-Coles weights each match by how long ago it was, and it matters more
 * here than in their paper: in August the last eight reach back into the spring,
 * across a transfer window and a squad's worth of changes. Sixty days puts a
 * match from the end of last season at roughly an eighth of last weekend's.
 */
const HALF_LIFE_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// How much a match counts, seen from a given date.
export function weightOf(kickoff: string, asOf: string): number {
  const days = (new Date(asOf).getTime() - new Date(kickoff).getTime()) / MS_PER_DAY;
  if (!Number.isFinite(days) || days <= 0) return 1;
  return 0.5 ** (days / HALF_LIFE_DAYS);
}

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
  const seen = new Map<number, { home: number; away: number; weight: number }>();

  // Weighted against the newest fixture in the set, so every competition is
  // measured from the same point in its own calendar.
  const asOf = fixtures.reduce(
    (latest, fixture) => (fixture.kickoff > latest ? fixture.kickoff : latest),
    fixtures[0]?.kickoff ?? new Date().toISOString()
  );

  for (const fixture of fixtures) {
    if (fixture.leagueId !== leagueId) continue;

    for (const form of [fixture.home, fixture.away]) {
      for (const match of form.matches) {
        if (seen.has(match.fixtureId)) continue;

        const weight = weightOf(match.kickoff, asOf);
        seen.set(
          match.fixtureId,
          match.venue === "home"
            ? { home: match.goalsFor, away: match.goalsAgainst, weight }
            : { home: match.goalsAgainst, away: match.goalsFor, weight }
        );
      }
    }
  }

  const sample = seen.size;
  if (sample < MIN_BASELINE_SAMPLE) return FALLBACK;

  let home = 0;
  let away = 0;
  let total = 0;
  for (const match of seen.values()) {
    home += match.home * match.weight;
    away += match.away * match.weight;
    total += match.weight;
  }

  if (total <= 0) return FALLBACK;

  return { homeGoals: home / total, awayGoals: away / total, sample };
}

// A per-match rate pulled toward the league by how thin its evidence is.
const shrunk = (total: number, matches: number, prior: number) =>
  (total + PRIOR_MATCHES * prior) / (matches + PRIOR_MATCHES);

export type Strength = {
  attack: number;
  // 1 is average, below 1 is tighter.
  defence: number;
  matches: number;
  // Matches after time decay. Five stale ones can be worth less than two fresh.
  effective: number;
};

export function strengthAt(
  form: TeamForm,
  venue: Venue,
  baseline: Baseline,
  asOf: string
): Strength {
  const at = form.matches.filter((match) => match.venue === venue);

  // A home side scores at the home rate and concedes at the away rate. Dividing
  // by the right one is what lets the two factors multiply into a goal count.
  const scoringNorm = venue === "home" ? baseline.homeGoals : baseline.awayGoals;
  const concedingNorm = venue === "home" ? baseline.awayGoals : baseline.homeGoals;

  let scored = 0;
  let conceded = 0;
  let effective = 0;

  for (const match of at) {
    const weight = weightOf(match.kickoff, asOf);
    scored += match.goalsFor * weight;
    conceded += match.goalsAgainst * weight;
    effective += weight;
  }

  return {
    attack: shrunk(scored, effective, scoringNorm) / scoringNorm,
    defence: shrunk(conceded, effective, concedingNorm) / concedingNorm,
    matches: at.length,
    effective,
  };
}

export function expectedGoals(fixture: Fixture, baseline: Baseline) {
  const home = strengthAt(fixture.home, "home", baseline, fixture.kickoff);
  const away = strengthAt(fixture.away, "away", baseline, fixture.kickoff);

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

/** The head-to-head record, always told from the fixture's home side. */
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
  h2h: H2HSummary;
  confidence: Confidence;
  // Every other market the goal data supports.
  board: Board;
};

export function project(fixture: Fixture, baseline: Baseline): Projection {
  const { home, away, homeStrength, awayStrength } = expectedGoals(fixture, baseline);
  const matrix = scoreMatrix(home, away);

  // The thinner of the two venue samples sets the confidence, counted after
  // decay: four matches from last spring are not four matches.
  const venueMatches = Math.min(homeStrength.effective, awayStrength.effective);
  const confidence: Confidence =
    venueMatches >= 2.5 ? "solid" : venueMatches >= 1.2 ? "fair" : "thin";

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
      // The overall strip is the last five outright; the venue strip is the
      // five that actually bear on this fixture.
      overall: summariseForm(fixture.home, undefined, 5),
      venue: summariseForm(fixture.home, "home"),
    },
    awayForm: {
      overall: summariseForm(fixture.away, undefined, 5),
      venue: summariseForm(fixture.away, "away"),
    },
    h2h: summariseH2H(fixture.h2h ?? [], fixture.home.team.id),
    confidence,
    board: board(matrix, home, away, fixture.home, fixture.away),
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
