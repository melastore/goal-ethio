import assert from "node:assert/strict";
import test from "node:test";

import {
  baselineFor,
  firstGoalFrom,
  goalMarkets,
  lean,
  outcomeFrom,
  poisson,
  scoreMatrix,
  strengthAt,
  summariseForm,
  type Baseline,
} from "@/lib/model";
import type { Fixture, PastMatch, TeamForm, Venue } from "@/lib/types";

const BASELINE: Baseline = { homeGoals: 1.5, awayGoals: 1.2, sample: 100 };

let nextFixtureId = 1;

// Everything is dated on NOW so time decay leaves the weights at 1 and the
// arithmetic under test is the shrinkage, not the decay.
const NOW = "2026-08-29T12:00:00Z";

const match = (
  venue: Venue,
  goalsFor: number,
  goalsAgainst: number,
  firstGoal: PastMatch["firstGoal"] = null,
  firstGoalMinute: number | null = null,
  kickoff = NOW
): PastMatch => ({
  fixtureId: nextFixtureId++,
  kickoff,
  venue,
  opponent: "Someone",
  goalsFor,
  goalsAgainst,
  halfFor: null,
  halfAgainst: null,
  firstGoal,
  firstGoalMinute,
});

const form = (matches: PastMatch[]): TeamForm => ({
  team: { id: 1, name: "Team", short: "TEA", logo: "" },
  matches,
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

test("a thin sample is pulled back toward the league", () => {
  // One 5-0 at home is not a 5-goal team.
  const strength = strengthAt(form([match("home", 5, 0)]), "home", BASELINE, NOW);
  assert.ok(strength.attack > 1);
  assert.ok(strength.attack < 2);
});

test("a full venue sample moves further than a thin one", () => {
  const one = strengthAt(form([match("home", 3, 0)]), "home", BASELINE, NOW);
  const four = strengthAt(
    form([
      match("home", 3, 0),
      match("home", 3, 0),
      match("home", 3, 0),
      match("home", 3, 0),
    ]),
    "home",
    BASELINE,
    NOW
  );
  assert.ok(four.attack > one.attack);
});

test("no matches at a venue reads as exactly average", () => {
  const strength = strengthAt(form([match("away", 4, 0)]), "home", BASELINE, NOW);
  assert.equal(strength.matches, 0);
  assert.ok(Math.abs(strength.attack - 1) < 1e-9);
  assert.ok(Math.abs(strength.defence - 1) < 1e-9);
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

test("baseline falls back until there is enough of a sample", () => {
  const fixture: Fixture = {
    id: 1,
    leagueId: 39,
    round: "Round 1",
    kickoff: NOW,
    status: "scheduled",
    home: form([match("home", 2, 1)]),
    away: form([match("away", 0, 0)]),
    result: null,
  };

  const baseline = baselineFor([fixture], 39);
  assert.equal(baseline.sample, 0);
  assert.equal(baseline.homeGoals, 1.5);
});

test("both teams to score is never above the chance of a goal", () => {
  const markets = goalMarkets(scoreMatrix(1.6, 1.3));
  assert.ok(markets.btts > 0 && markets.btts < 1);
  assert.ok(markets.overTwoFive > 0 && markets.overTwoFive < 1);
});

test("a stale match counts for less than a fresh one", () => {
  const fresh = strengthAt(form([match("home", 4, 0)]), "home", BASELINE, NOW);
  // Four months back is roughly two half-lives.
  const stale = strengthAt(
    form([match("home", 4, 0, null, null, "2026-04-29T12:00:00Z")]),
    "home",
    BASELINE,
    NOW
  );

  assert.ok(stale.attack < fresh.attack);
  assert.ok(stale.effective < 0.3);
  assert.equal(fresh.effective, 1);
});

test("weighting never revives a match into the future", () => {
  const ahead = strengthAt(
    form([match("home", 2, 0, null, null, "2027-01-01T12:00:00Z")]),
    "home",
    BASELINE,
    NOW
  );
  assert.equal(ahead.effective, 1);
});

test("lean names the top outcome and its margin", () => {
  const picked = lean({ home: 0.52, draw: 0.26, away: 0.22 });
  assert.equal(picked.pick, "home");
  assert.ok(Math.abs(picked.margin - 0.26) < 1e-9);
});
