// Folds this refresh's matches into src/data/history.json.
//
// The fetch pulls each team's last ten and the next refresh overwrites them, so
// without this the model never sees more than ten matches a side. That is below
// what it takes to beat a flat league average: run `npm run backtest` to watch
// it happen. This keeps every match the fetch has ever pulled, at no extra call.
//
// Run after fetch:week, before the build.

import { readFile, writeFile } from "node:fs/promises";

import { merge, toArchived, MAX_AGE_DAYS } from "../src/lib/history.ts";
import { poolMatches } from "../src/lib/ratings.ts";

const HISTORY = "src/data/history.json";

const week = JSON.parse(await readFile("src/data/week.json", "utf8"));

const asOf = week.fixtures.reduce(
  (newest, fixture) => (fixture.kickoff > newest ? fixture.kickoff : newest),
  week.generatedAt ?? new Date().toISOString()
);

let existing = [];
try {
  const file = JSON.parse(await readFile(HISTORY, "utf8"));
  if (Array.isArray(file.matches)) existing = file.matches;
} catch {
  // First run writes the file.
}

const incoming = poolMatches(week.fixtures, asOf).map(toArchived);
const matches = merge(existing, incoming, asOf);

await writeFile(
  HISTORY,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), matches })}\n`
);

const added = matches.length - existing.length;
const teams = new Set(matches.flatMap((row) => [row.h, row.a]));

console.log(
  `history: ${matches.length} matches (${added >= 0 ? "+" : ""}${added}), ${teams.size} teams, ` +
    `${((matches.length * 2) / Math.max(teams.size, 1)).toFixed(1)} per team, dropping past ${MAX_AGE_DAYS} days`
);
