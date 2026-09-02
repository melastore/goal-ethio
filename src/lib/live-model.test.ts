import assert from "node:assert/strict";
import test from "node:test";

import { projectLive, remainingRates } from "@/lib/live-model";

const level = { minute: 0, goalsHome: 0, goalsAway: 0 };

test("before kickoff the live read matches the pre-match one", () => {
  const rates = remainingRates(1.6, 1.2, level);
  assert.ok(Math.abs(rates.home - 1.6) < 1e-9);
  assert.ok(Math.abs(rates.away - 1.2) < 1e-9);
  assert.equal(rates.minutesLeft, 90);
});

test("what is left falls as the clock runs", () => {
  const early = remainingRates(1.6, 1.2, { ...level, minute: 20 });
  const late = remainingRates(1.6, 1.2, { ...level, minute: 75 });

  assert.ok(late.home < early.home);
  assert.ok(late.minutesLeft < early.minutesLeft);
  assert.ok(late.home > 0);
});

test("half time stops the clock at forty five", () => {
  const paused = remainingRates(1.6, 1.2, { ...level, minute: 61, period: "HT" });
  const running = remainingRates(1.6, 1.2, { ...level, minute: 45 });
  assert.ok(Math.abs(paused.home - running.home) < 1e-9);
});

test("the side that is behind is expected to push", () => {
  const chasing = remainingRates(1.5, 1.5, { minute: 60, goalsHome: 2, goalsAway: 0 });
  const levelAt60 = remainingRates(1.5, 1.5, { minute: 60, goalsHome: 0, goalsAway: 0 });

  assert.ok(chasing.away > levelAt60.away, "two down, the away side attacks more");
  assert.ok(chasing.home < levelAt60.home, "two up, the home side sits");
});

test("a goal ahead late is close to won", () => {
  const p = projectLive(1.5, 1.2, { minute: 85, goalsHome: 1, goalsAway: 0 });
  assert.ok(p.outcome.home > 0.85);
  assert.ok(Math.abs(p.outcome.home + p.outcome.draw + p.outcome.away - 1) < 1e-6);
});

test("a goal ahead at kickoff is worth far less than a goal ahead at the end", () => {
  const early = projectLive(1.5, 1.2, { minute: 5, goalsHome: 1, goalsAway: 0 });
  const late = projectLive(1.5, 1.2, { minute: 85, goalsHome: 1, goalsAway: 0 });
  assert.ok(late.outcome.home > early.outcome.home);
});

test("both teams to score is settled once both have", () => {
  const p = projectLive(1.5, 1.2, { minute: 30, goalsHome: 1, goalsAway: 1 });
  assert.ok(Math.abs(p.btts - 1) < 1e-6);
});

test("both teams to score is impossible for a side already shut out at the whistle", () => {
  const p = projectLive(1.5, 1.2, { minute: 90, goalsHome: 2, goalsAway: 0 });
  assert.ok(p.btts < 0.02);
});

test("totals count the goals already scored", () => {
  const p = projectLive(1.4, 1.1, { minute: 80, goalsHome: 2, goalsAway: 1 });
  // Three are in, so over 2.5 has already landed.
  assert.ok(p.totals[2].over > 0.99);
  assert.ok(p.totals[4].over < 0.5);
  p.totals.forEach((line) => assert.ok(Math.abs(line.over + line.under - 1) < 1e-6));
});

test("the likeliest final score starts from the current one", () => {
  const p = projectLive(1.4, 1.1, { minute: 88, goalsHome: 2, goalsAway: 1 });
  assert.equal(p.scorelines[0].home, 2);
  assert.equal(p.scorelines[0].away, 1);
});

test("at the whistle nothing more is expected", () => {
  const p = projectLive(1.5, 1.2, { minute: 90, goalsHome: 1, goalsAway: 1 });
  assert.ok(p.remainingHome < 0.05);
  assert.ok(p.nextGoal.none > 0.9);
  assert.equal(p.minutesLeft, 0);
});
