import assert from "node:assert/strict";
import test from "node:test";

import {
  elapsedShare,
  firstGoalFrom,
  goalMarkets,
  intensitySlope,
  lean,
  outcomeFrom,
  poisson,
  project,
  scoreMatrix,
  summariseForm,
  summariseH2H,
} from "@/lib/model";
import { fitRatings } from "@/lib/ratings";
import type { Fixture, H2HMatch, PastMatch, Team, TeamForm, Venue } from "@/lib/types";

let nextFixtureId = 1;

// Everything is dated on NOW so time decay leaves the weights at 1 and the
// arithmetic under test is the model, not the decay.
const NOW = "2026-08-29T12:00:00Z";

const team = (id: number, short: string): Team => ({
  id,
  name: short,
  short,
  logo: `https://crests.football-data.org/${id}.png`,
});

const match = (
  venue: Venue,
  goalsFor: number,
  goalsAgainst: number,
  firstGoal: PastMatch["firstGoal"] = null,
  firstGoalMinute: number | null = null,
  kickoff = NOW,
  opponent = team(9000 + nextFixtureId, "OPP")
): PastMatch => ({
  fixtureId: nextFixtureId++,
  kickoff,
  competition: "PL",
  venue,
  opponent: opponent.short,
  opponentName: opponent.name,
  opponentLogo: opponent.logo,
  goalsFor,
  goalsAgainst,
  halfFor: null,
  halfAgainst: null,
  firstGoal,
  firstGoalMinute,
});

const form = (matches: PastMatch[], id = 1, short = "TEA"): TeamForm => ({
  team: team(id, short),
  matches,
});

const fixture = (home: TeamForm, away: TeamForm, h2h: H2HMatch[] = []): Fixture => ({
  id: nextFixtureId++,
  leagueId: 39,
  round: "Matchday 1",
  kickoff: NOW,
  status: "scheduled",
  home,
  away,
  h2h,
  result: null,
});

test("poisson sums to one over enough goals", () => {
  let total = 0;
  for (let k = 0; k <= 20; k += 1) total += poisson(k, 1.6);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("the score matrix is a distribution", () => {
  const total = scoreMatrix(1.7, 1.1)
    .flat()
    .reduce((sum, p) => sum + p, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("outcome probabilities add up and favour the stronger rate", () => {
  const outcome = outcomeFrom(scoreMatrix(2.1, 0.8));
  assert.ok(Math.abs(outcome.home + outcome.draw + outcome.away - 1) < 1e-9);
  assert.ok(outcome.home > outcome.away);
});

test("equal rates give a symmetric match", () => {
  const outcome = outcomeFrom(scoreMatrix(1.4, 1.4));
  assert.ok(Math.abs(outcome.home - outcome.away) < 1e-9);
});

test("the low score correction can be turned off for a half", () => {
  const corrected = scoreMatrix(0.7, 0.6);
  const plain = scoreMatrix(0.7, 0.6, false);
  // The correction is what firms up the goalless scoreline.
  assert.ok(corrected[0][0] > plain[0][0]);
});

test("first goal splits by share of the combined rate", () => {
  const first = firstGoalFrom(1.5, 0.5);
  const scored = 1 - first.none;
  assert.ok(Math.abs(first.home / scored - 0.75) < 1e-9);
  assert.ok(Math.abs(first.home + first.away + first.none - 1) < 1e-9);
});

test("a goalless-looking match pushes the opening goal later", () => {
  const busy = firstGoalFrom(2.2, 1.8);
  const quiet = firstGoalFrom(0.8, 0.6);
  assert.ok(quiet.expectedMinute > busy.expectedMinute);
});

test("the observed first-goal record moves the split, but not far", () => {
  const flat = firstGoalFrom(1.4, 1.4);
  const nudged = firstGoalFrom(1.4, 1.4, {
    homeFirstRate: 1,
    awayFirstRate: 0,
    decided: 10,
  });
  assert.ok(nudged.home > flat.home);
  assert.ok(nudged.home - flat.home < 0.1);
});

test("a rising rate keeps the early windows quieter than a flat one", () => {
  const slope = intensitySlope(0.45);
  assert.ok(slope > 0);
  // Half the clock has gone by 45, but less than half the scoring.
  assert.ok(elapsedShare(45, slope) < 0.5);
  assert.ok(Math.abs(elapsedShare(90, slope) - 1) < 1e-9);

  const rising = firstGoalFrom(1.5, 1.2, { slope });
  const flat = firstGoalFrom(1.5, 1.2, { slope: 0 });
  assert.ok(rising.expectedMinute > flat.expectedMinute);
  assert.ok(rising.byMinute[0].scored < flat.byMinute[0].scored);
});

test("the windows are a rising curve toward the full chance of a goal", () => {
  const first = firstGoalFrom(1.5, 1.2, { slope: intensitySlope(0.45) });
  for (let i = 1; i < first.byMinute.length; i += 1) {
    assert.ok(first.byMinute[i].scored > first.byMinute[i - 1].scored);
  }
  assert.ok(first.byMinute[first.byMinute.length - 1].scored < 1 - first.none);
});

test("form reads the venue half on its own", () => {
  const eight = form([
    match("home", 2, 0, "for", 12),
    match("away", 0, 1, "against", 30),
    match("home", 1, 1, "against", 55),
    match("away", 3, 2, "for", 5),
  ]);

  const overall = summariseForm(eight);
  assert.equal(overall.played, 4);
  assert.equal(overall.won, 2);
  assert.equal(overall.scoredFirst, 2);
  assert.equal(overall.averageFirstGoalMinute, (12 + 30 + 55 + 5) / 4);

  const home = summariseForm(eight, "home");
  assert.equal(home.played, 2);
  assert.deepEqual(home.sequence, ["W", "D"]);
  assert.equal(home.scoredFirst, 1);
});

test("a goalless match is left out of the scored-first denominator", () => {
  const summary = summariseForm(form([match("home", 0, 0), match("home", 1, 0, "for", 20)]));
  assert.equal(summary.decided, 1);
  assert.equal(summary.scoredFirst, 1);
});

test("both teams to score is never above the chance of a goal", () => {
  const markets = goalMarkets(scoreMatrix(1.6, 1.3));
  assert.ok(markets.btts > 0 && markets.btts < 1);
  assert.ok(markets.overTwoFive > 0 && markets.overTwoFive < 1);
});

test("lean names the top outcome and its margin", () => {
  const picked = lean({ home: 0.52, draw: 0.26, away: 0.22 });
  assert.equal(picked.pick, "home");
  assert.ok(Math.abs(picked.margin - 0.26) < 1e-9);
});

const meeting = (
  homeId: number,
  goalsHome: number,
  goalsAway: number,
  kickoff = NOW
): H2HMatch => ({
  fixtureId: nextFixtureId++,
  kickoff,
  competition: "PL",
  homeId,
  home: "HOM",
  away: "AWY",
  goalsHome,
  goalsAway,
  halfHome: null,
  halfAway: null,
});

const HOME_TEAM = 10;
const AWAY_TEAM = 20;

test("head-to-head is told from the coming fixture's home side, whichever way round the meeting was", () => {
  const summary = summariseH2H(
    [
      // The home side won this one at home.
      meeting(HOME_TEAM, 2, 0),
      // And this one away from home, so the scoreline reads the other way.
      meeting(AWAY_TEAM, 1, 3),
      meeting(AWAY_TEAM, 2, 2),
      meeting(AWAY_TEAM, 4, 0),
    ],
    HOME_TEAM
  );

  assert.equal(summary.played, 4);
  assert.equal(summary.homeWins, 2);
  assert.equal(summary.draws, 1);
  assert.equal(summary.awayWins, 1);
  assert.equal(summary.goalsHome, 2 + 3 + 2 + 0);
  assert.equal(summary.goalsAway, 0 + 1 + 2 + 4);
});

test("only meetings at the coming fixture's ground count toward the venue record", () => {
  const summary = summariseH2H(
    [meeting(HOME_TEAM, 2, 0), meeting(HOME_TEAM, 0, 1), meeting(AWAY_TEAM, 0, 3)],
    HOME_TEAM
  );

  assert.equal(summary.atThisVenue, 2);
  assert.equal(summary.homeWinsAtThisVenue, 1);
});

test("no meetings is an empty record rather than a missing one", () => {
  const summary = summariseH2H([], HOME_TEAM);
  assert.equal(summary.played, 0);
  assert.equal(summary.homeWins, 0);
  assert.equal(summary.goalsHome, 0);
});

test("a limit cuts the form read back to the most recent matches", () => {
  const older = "2026-06-01T12:00:00Z";
  const summary = summariseForm(
    form([
      match("home", 3, 0, null, null, NOW),
      match("away", 2, 0, null, null, NOW),
      // Beyond the limit, so neither the sequence nor the goals count them.
      match("home", 0, 5, null, null, older),
      match("away", 0, 4, null, null, older),
    ]),
    undefined,
    2
  );

  assert.equal(summary.played, 2);
  assert.deepEqual(summary.sequence, ["W", "W"]);
  assert.equal(summary.goalsAgainst, 0);
});

test("a venue filter and a limit compose", () => {
  const summary = summariseForm(
    form([
      match("home", 1, 0),
      match("away", 9, 9),
      match("home", 2, 0),
      match("home", 3, 0),
    ]),
    "home",
    2
  );

  assert.equal(summary.played, 2);
  assert.equal(summary.goalsFor, 3);
});

/* -------------------------------------------------------------------------- */
/* The projection end to end                                                   */
/* -------------------------------------------------------------------------- */

// A league of ordinary sides, so a team under test has something to be rated
// against. Every side plays every other once each way.
function league(strengths: Record<string, number>, competition = "PL"): Fixture[] {
  const names = Object.keys(strengths);
  const teams = new Map(names.map((name, index) => [name, team(100 + index, name)]));
  const rows = new Map<string, PastMatch[]>(names.map((name) => [name, []]));

  for (const home of names) {
    for (const away of names) {
      if (home === away) continue;
      const id = nextFixtureId++;
      // Goals scale with the difference in strength, with a home bonus on top
      // so the league has an advantage in it for the fit to find.
      const goalsHome = Math.max(0, Math.round(1.6 + (strengths[home] - strengths[away])));
      const goalsAway = Math.max(0, Math.round(1.0 + (strengths[away] - strengths[home])));

      rows.get(home)!.push({
        fixtureId: id,
        kickoff: NOW,
        competition,
        venue: "home",
        opponent: away,
        opponentName: away,
        opponentLogo: teams.get(away)!.logo,
        goalsFor: goalsHome,
        goalsAgainst: goalsAway,
        halfFor: null,
        halfAgainst: null,
        firstGoal: null,
        firstGoalMinute: null,
      });

      rows.get(away)!.push({
        fixtureId: id,
        kickoff: NOW,
        competition,
        venue: "away",
        opponent: home,
        opponentName: home,
        opponentLogo: teams.get(home)!.logo,
        goalsFor: goalsAway,
        goalsAgainst: goalsHome,
        halfFor: null,
        halfAgainst: null,
        firstGoal: null,
        firstGoalMinute: null,
      });
    }
  }

  const forms = new Map(
    names.map((name) => [name, { team: teams.get(name)!, matches: rows.get(name)! }])
  );

  const out: Fixture[] = [];
  for (const home of names) {
    for (const away of names) {
      if (home === away) continue;
      out.push({
        id: nextFixtureId++,
        leagueId: 39,
        round: "Next",
        kickoff: NOW,
        status: "scheduled",
        home: forms.get(home)!,
        away: forms.get(away)!,
        h2h: [],
        result: null,
      });
    }
  }

  return out;
}

const find = (fixtures: Fixture[], home: string, away: string) =>
  fixtures.find((f) => f.home.team.short === home && f.away.team.short === away)!;

test("the better side is favoured, and more so at home", () => {
  const fixtures = league({ STRONG: 0.7, MID: 0, WEAK: -0.7 });
  const ratings = fitRatings(fixtures, NOW);

  const atHome = project(find(fixtures, "STRONG", "WEAK"), ratings);
  const away = project(find(fixtures, "WEAK", "STRONG"), ratings);

  assert.ok(atHome.outcome.home > 0.6);
  assert.ok(away.outcome.away > away.outcome.home);
  assert.ok(atHome.outcome.home > away.outcome.away);
});

test("a goal against a mean defence counts for more than one against a leaky one", () => {
  // Two sides with the same goals scored, one of them all against the weakest.
  const fixtures = league({ A: 0.5, B: 0.5, C: 0, D: -0.6 });
  const ratings = fitRatings(fixtures, NOW);

  const a = ratings.attack.get("t100")!;
  const d = ratings.attack.get("t103")!;
  assert.ok(a > d, "the stronger side rates higher on attack");
  assert.ok(ratings.defence.get("t100")! < ratings.defence.get("t103")!);
});

test("a lopsided head-to-head moves the match, but only a little", () => {
  const fixtures = league({ ONE: 0, TWO: 0 });
  const ratings = fitRatings(fixtures, NOW);
  const level = find(fixtures, "ONE", "TWO");

  const plain = project(level, ratings);
  const withRecord = project(
    { ...level, h2h: [meeting(100, 4, 0), meeting(100, 3, 0), meeting(100, 3, 1)] },
    ratings
  );

  assert.ok(withRecord.outcome.home > plain.outcome.home);
  assert.ok(withRecord.outcome.home - plain.outcome.home < 0.08);
});

test("the projection is a whole distribution", () => {
  const fixtures = league({ STRONG: 0.6, MID: 0, WEAK: -0.6 });
  const ratings = fitRatings(fixtures, NOW);
  const p = project(find(fixtures, "STRONG", "MID"), ratings);

  const { home, draw, away } = p.outcome;
  assert.ok(Math.abs(home + draw + away - 1) < 1e-9);
  assert.ok(Math.abs(p.board.btts.yes + p.board.btts.no - 1) < 1e-9);
  assert.ok(p.lambdaHome > p.lambdaAway);
  assert.ok(p.firstGoal.home > p.firstGoal.away);
});

test("a side with no form at all reads as average rather than as a forecast", () => {
  const fixtures = league({ MID: 0, OTHER: 0 });
  const ratings = fitRatings(fixtures, NOW);
  const blank = form([], 500, "BLANK");
  const p = project(fixture(blank, fixtures[0].away), ratings);

  assert.equal(p.confidence, "thin");
  assert.ok(p.outcome.home > 0.2 && p.outcome.home < 0.7);
});
