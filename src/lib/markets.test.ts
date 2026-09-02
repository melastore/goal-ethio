import assert from "node:assert/strict";
import test from "node:test";

import {
  btts,
  cleanSheets,
  doubleChance,
  drawNoBet,
  firstHalf,
  firstHalfShare,
  handicaps,
  highestScoringHalf,
  likeliestExactScores,
  oddEven,
  teamTotals,
  totals,
} from "@/lib/markets";
import { outcomeFrom, scoreMatrix } from "@/lib/model";
import type { PastMatch, TeamForm } from "@/lib/types";

const matrix = scoreMatrix(1.6, 1.15);

const past = (
  goalsFor: number,
  goalsAgainst: number,
  halfFor: number | null,
  halfAgainst: number | null
): PastMatch => ({
  fixtureId: Math.random(),
  kickoff: "2026-08-01T14:00:00Z",
  competition: "PL",
  venue: "home",
  opponent: "Someone",
  opponentName: "Someone",
  opponentLogo: "",
  goalsFor,
  goalsAgainst,
  halfFor,
  halfAgainst,
  firstGoal: null,
  firstGoalMinute: null,
});

const form = (matches: PastMatch[]): TeamForm => ({
  team: { id: 1, name: "Team", short: "TEA", logo: "" },
  matches,
});

test("every line's over and under add to one", () => {
  for (const line of totals(matrix)) {
    assert.ok(Math.abs(line.over + line.under - 1) < 1e-9);
  }
});

test("overs fall as the line rises", () => {
  const lines = totals(matrix);
  lines.slice(1).forEach((line, index) => {
    assert.ok(line.over < lines[index].over);
  });
});

test("over 0.5 is the complement of a goalless match", () => {
  const goalless = matrix[0][0];
  assert.ok(Math.abs(totals(matrix, [0.5])[0].over - (1 - goalless)) < 1e-9);
});

test("a team's own total is its Poisson marginal", () => {
  const lines = teamTotals(1.6, [0.5]);
  assert.ok(Math.abs(lines[0].under - Math.exp(-1.6)) < 1e-9);
});

test("double chance is the pair of outcomes it covers", () => {
  const outcome = outcomeFrom(matrix);
  const chance = doubleChance(matrix);
  assert.ok(Math.abs(chance.homeOrDraw - (outcome.home + outcome.draw)) < 1e-9);
  assert.ok(Math.abs(chance.drawOrAway - (outcome.draw + outcome.away)) < 1e-9);
  assert.ok(Math.abs(chance.homeOrAway - (outcome.home + outcome.away)) < 1e-9);
});

test("a handicap is harder than the plain win", () => {
  const outcome = outcomeFrom(matrix);
  const [byOne] = handicaps(matrix, [1]);
  assert.ok(byOne.homeGives < outcome.home);
});

test("winning to nil is a subset of the clean sheet", () => {
  const sheets = cleanSheets(matrix);
  assert.ok(sheets.homeWinToNil < sheets.home);
  assert.ok(sheets.awayWinToNil < sheets.away);
});

test("odd and even split the whole", () => {
  const split = oddEven(matrix);
  assert.ok(Math.abs(split.odd + split.even - 1) < 1e-9);
});

test("the first half is lower scoring than the match", () => {
  const half = firstHalf(1.6, 1.15, 0.44);
  assert.ok(half.result.draw > outcomeFrom(matrix).draw);
  assert.ok(half.totals[0].over < totals(matrix, [0.5])[0].over);
});

test("a thin half-time record stays near the league share", () => {
  const { share } = firstHalfShare(form([past(3, 0, 3, 0)]));
  assert.ok(share > 0.44 && share < 0.55);
});

test("matches with no half-time score are left out", () => {
  const { matches } = firstHalfShare(form([past(1, 0, null, null), past(2, 1, 1, 0)]));
  assert.equal(matches, 1);
});

test("both teams to score yes and no add to one", () => {
  const b = btts(matrix);
  assert.ok(Math.abs(b.yes + b.no - 1) < 1e-9);
  assert.ok(b.yes > 0 && b.no > 0);
});

test("draw no bet probabilities add to one and favor stronger side", () => {
  const dnb = drawNoBet(matrix);
  assert.ok(Math.abs(dnb.home + dnb.away - 1) < 1e-9);
  assert.ok(dnb.home > dnb.away);
});

test("likeliest exact scores are ordered by descending probability", () => {
  const scores = likeliestExactScores(matrix, 5);
  assert.equal(scores.length, 5);
  for (let i = 0; i < scores.length - 1; i += 1) {
    assert.ok(scores[i].probability >= scores[i + 1].probability);
  }
});

test("highest scoring half partitions the match goals", () => {
  const h = highestScoringHalf(1.6, 1.15, 0.44);
  assert.ok(Math.abs(h.first + h.draw + h.second - 1) < 1e-6);
  // Second half has slightly higher share of goals, so second > first
  assert.ok(h.second > h.first);
});
