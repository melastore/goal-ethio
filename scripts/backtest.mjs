// Fits on what was known by a date and scores what happened after it.
//
// The point is to keep the model honest. A projection that looks reasonable on
// screen can still be worse than saying "home win, 45%" to every match, and the
// only way to know is to hold matches back and score the predictions on them.
//
//   npm run backtest
//
// Log loss is the number to watch: it punishes a confident miss properly, where
// a hit rate does not. Lower is better on both it and Brier.

import { readFile } from "node:fs/promises";

import { outcomeFrom, ratesFrom, scoreMatrix } from "../src/lib/model.ts";
import { fitRatings, poolMatches, ratingOf } from "../src/lib/ratings.ts";

// Held-out share of the matches, taken as the most recent ones so the test is
// always "what happens next" rather than filling in a gap.
const TEST_SHARE = 0.25;

const week = JSON.parse(await readFile("src/data/week.json", "utf8"));

const asOf = week.fixtures.reduce(
  (newest, fixture) => (fixture.kickoff > newest ? fixture.kickoff : newest),
  week.fixtures[0].kickoff
);

const pool = poolMatches(week.fixtures, asOf).sort((a, b) =>
  a.kickoff < b.kickoff ? -1 : 1
);

const split = Math.floor(pool.length * (1 - TEST_SHARE));
const train = pool.slice(0, split);
const test = pool.slice(split);

// Weights are relative to the newest match in the file, and the training set
// stops earlier, so they are recomputed against the cutoff. Without this every
// training match looks stale and the prior swamps the fit.
const cutoff = train[train.length - 1].kickoff;
const retimed = train.map((match) => ({
  ...match,
  weight: 0.5 ** (
    (new Date(cutoff).getTime() - new Date(match.kickoff).getTime()) /
    (86_400_000 * 60)
  ),
}));

console.log(
  `${pool.length} matches: ${train.length} to fit on, ${test.length} to score, cut at ${cutoff.slice(0, 10)}`
);

function scoreWith(ratings, label) {
  let logLoss = 0;
  let brier = 0;
  let hits = 0;
  let graded = 0;
  let goalError = 0;

  for (const match of test) {
    const home = ratingOf(ratings, match.home);
    const away = ratingOf(ratings, match.away);
    // A side never seen in training has no rating to test.
    if (home.sample === 0 || away.sample === 0) continue;

    const rates = ratesFrom(ratings, home, away);
    const outcome = outcomeFrom(scoreMatrix(rates.home, rates.away));

    const actual =
      match.goalsHome > match.goalsAway
        ? "home"
        : match.goalsHome === match.goalsAway
          ? "draw"
          : "away";

    const p = Math.max(outcome[actual], 1e-4);
    logLoss += -Math.log(p);
    for (const pick of ["home", "draw", "away"]) {
      brier += (outcome[pick] - (pick === actual ? 1 : 0)) ** 2;
    }

    const called = ["home", "draw", "away"].reduce((best, pick) =>
      outcome[pick] > outcome[best] ? pick : best
    );
    if (called === actual) hits += 1;
    goalError += Math.abs(rates.home + rates.away - (match.goalsHome + match.goalsAway));
    graded += 1;
  }

  if (graded === 0) {
    console.log(`${label.padEnd(22)} nothing to score`);
    return null;
  }

  const row = {
    label,
    graded,
    logLoss: logLoss / graded,
    brier: brier / graded,
    hitRate: hits / graded,
    goalError: goalError / graded,
  };

  console.log(
    `${label.padEnd(22)} n=${String(graded).padStart(4)}  logloss ${row.logLoss.toFixed(4)}  brier ${row.brier.toFixed(4)}  called ${(row.hitRate * 100).toFixed(1)}%  goals off by ${row.goalError.toFixed(2)}`
  );
  return row;
}

console.log("");

// Every team average: the league rate and nothing else. Anything that cannot
// beat this is not worth running.
const flat = fitRatings(week.fixtures, cutoff, { pool: retimed });
for (const key of flat.attack.keys()) {
  flat.attack.set(key, 1);
  flat.defence.set(key, 1);
}
const base = scoreWith(flat, "league average only");

const raw = fitRatings(week.fixtures, cutoff, { pool: retimed, opponentAdjusted: false });
const rawRow = scoreWith(raw, "form, not adjusted");

const full = fitRatings(week.fixtures, cutoff, { pool: retimed });
const fullRow = scoreWith(full, "opponent adjusted");

if (base && fullRow) {
  const gain = ((base.logLoss - fullRow.logLoss) / base.logLoss) * 100;
  console.log(`\nagainst the flat baseline: ${gain.toFixed(1)}% of the log loss removed`);
}
if (rawRow && fullRow) {
  const gain = ((rawRow.logLoss - fullRow.logLoss) / rawRow.logLoss) * 100;
  console.log(`the opponent adjustment is worth ${gain.toFixed(1)}% of it`);
}
