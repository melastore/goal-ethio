// Projects src/data/week.json into public/feed.json for the Android app, so the
// app and the site can never disagree about a number.
//
// The app shows more than the site does, so the feed carries more than the site
// renders: the notes, the whole market board, and the scoreline grid the phone
// draws as a heat map.

import { mkdir, readFile, writeFile } from "node:fs/promises";

import { baselineFor, project, scoreMatrix } from "../src/lib/model.ts";
import { grade, tally } from "../src/lib/scoring.ts";
import { readMatch } from "../src/lib/read.ts";

// Scorelines past five are a rounding error, and the grid has to fit a phone.
const GRID = 6;

const r = (value) => Math.round(value * 1e4) / 1e4;

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

const feed = {
  sample: week.sample === true,
  generatedAt: week.generatedAt,
  weekStart: week.weekStart,
  record: tally(graded),
  fixtures: entries.map(({ fixture, projection }) => {
    const matrix = scoreMatrix(projection.lambdaHome, projection.lambdaAway);

    return {
      id: fixture.id,
      leagueId: fixture.leagueId,
      round: fixture.round,
      kickoff: fixture.kickoff,
      status: fixture.status,
      home: fixture.home.team,
      away: fixture.away.team,
      result: fixture.result,
      notes: readMatch({
        projection,
        homeName: fixture.home.team.short,
        awayName: fixture.away.team.short,
      }),
      // Row is the home score, column the away score.
      grid: matrix.slice(0, GRID).map((row) => row.slice(0, GRID).map(r)),
      projection,
    };
  }),
};

await mkdir("public", { recursive: true });
await writeFile("public/feed.json", `${JSON.stringify(feed)}\n`);

console.log(`feed: ${feed.fixtures.length} fixtures`);
