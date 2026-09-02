// Projects src/data/week.json into public/feed.json for the Android app, so the
// app and the site can never disagree about a number.
//
// The app shows more than the site does, so the feed carries more than the site
// renders: the notes, the whole market board, and the scoreline grid the phone
// draws as a heat map.
//
// It also writes public/detail/<id>.json, one small file per fixture holding the
// form rows and the head-to-head meetings. Those are far too heavy to bake into
// the page for four hundred fixtures, and nobody reads more than a few, so the
// card fetches one when its form tab is opened.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { fromArchived } from "../src/lib/history.ts";
import { quotes, standouts, typicalRates } from "../src/lib/markets.ts";
import { project, scoreMatrix } from "../src/lib/model.ts";
import { fitRatings } from "../src/lib/ratings.ts";
import { grade, tally } from "../src/lib/scoring.ts";
import { readMatch } from "../src/lib/read.ts";

// Scorelines past five are a rounding error, and the grid has to fit a phone.
const GRID = 6;

const DETAIL = "public/detail";

const r = (value) => Math.round(value * 1e4) / 1e4;

const week = JSON.parse(await readFile("src/data/week.json", "utf8"));

let history = [];
try {
  history = JSON.parse(await readFile("src/data/history.json", "utf8")).matches.map(fromArchived);
} catch {
  // The archive is written by scripts/archive.mjs; without it the fit falls
  // back to the ten matches a side that week.json carries.
}

const ratings = fitRatings(week.fixtures, undefined, { history });

const entries = week.fixtures.map((fixture) => ({
  fixture,
  projection: project(fixture, ratings),
}));

const boards = entries.map(({ projection }) => quotes(projection.board, projection.outcome));
const typical = typicalRates(boards);

const graded = entries
  .map(({ fixture, projection }) => grade(fixture, projection))
  .filter(Boolean);

const feed = {
  sample: week.sample === true,
  generatedAt: week.generatedAt,
  weekStart: week.weekStart,
  record: tally(graded),
  fixtures: entries.map(({ fixture, projection }, index) => {
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
      standouts: standouts(boards[index], typical),
      // Row is the home score, column the away score.
      grid: matrix.slice(0, GRID).map((row) => row.slice(0, GRID).map(r)),
      projection,
    };
  }),
};

await mkdir("public", { recursive: true });
await writeFile("public/feed.json", `${JSON.stringify(feed)}\n`);

// Scores only, for the page to poll when no live worker is configured. The feed
// is megabytes and a browser asking for it every half minute is not on.
const live = {
  at: week.generatedAt,
  matches: entries
    .filter(({ fixture }) => fixture.status !== "scheduled" && fixture.result)
    .map(({ fixture }) => ({
      id: fixture.id,
      status: fixture.status,
      minute: fixture.result.minute ?? null,
      period: fixture.result.period ?? null,
      goalsHome: fixture.result.goalsHome,
      goalsAway: fixture.result.goalsAway,
      halfHome: fixture.result.halfHome ?? null,
      halfAway: fixture.result.halfAway ?? null,
    })),
};

await writeFile("public/live.json", `${JSON.stringify(live)}\n`);

// Rebuilt from scratch so a fixture that has dropped out of the window does not
// leave a stale file behind in the export.
await rm(DETAIL, { recursive: true, force: true });
await mkdir(DETAIL, { recursive: true });

await Promise.all(
  week.fixtures.map((fixture) =>
    writeFile(
      `${DETAIL}/${fixture.id}.json`,
      JSON.stringify({
        id: fixture.id,
        homeId: fixture.home.team.id,
        awayId: fixture.away.team.id,
        home: fixture.home.matches,
        away: fixture.away.matches,
        h2h: fixture.h2h ?? [],
      })
    )
  )
);

console.log(
  `feed: ${feed.fixtures.length} fixtures, ${live.matches.length} in live.json, ${week.fixtures.length} detail files`
);
