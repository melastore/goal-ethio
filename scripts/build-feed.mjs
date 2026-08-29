// Runs the projection over week.json and writes public/feed.json, so the
// Android app renders the same numbers as the site without a second copy of
// the model. Run before `next build`.

import { mkdir, readFile, writeFile } from "node:fs/promises";

import { baselineFor, project } from "../src/lib/model.ts";
import { grade, tally } from "../src/lib/scoring.ts";

const week = JSON.parse(await readFile("src/data/week.json", "utf8"));

const baselines = new Map();
for (const fixture of week.fixtures) {
  if (!baselines.has(fixture.leagueId)) {
    baselines.set(fixture.leagueId, baselineFor(week.fixtures, fixture.leagueId));
  }
}

const entries = week.fixtures.map((fixture) => ({
  fixture,
  projection: project(fixture, baselines.get(fixture.leagueId)),
}));

const graded = entries
  .map(({ fixture, projection }) => grade(fixture, projection))
  .filter(Boolean);

// The app only needs the numbers, not the eight raw matches behind them, so the
// form arrays are dropped and the summaries the projection already holds stay.
const feed = {
  sample: week.sample === true,
  generatedAt: week.generatedAt,
  weekStart: week.weekStart,
  record: tally(graded),
  fixtures: entries.map(({ fixture, projection }) => ({
    id: fixture.id,
    leagueId: fixture.leagueId,
    round: fixture.round,
    kickoff: fixture.kickoff,
    status: fixture.status,
    home: fixture.home.team,
    away: fixture.away.team,
    result: fixture.result,
    projection,
  })),
};

// public/ holds nothing else tracked, so git does not carry the directory.
await mkdir("public", { recursive: true });
await writeFile("public/feed.json", `${JSON.stringify(feed)}\n`);
console.log(`feed: ${feed.fixtures.length} fixtures`);
