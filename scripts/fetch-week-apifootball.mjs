// Pulls the coming week's fixtures and each team's last eight matches from
// api-football, then writes src/data/week.json for the build to bake in.
//
//   API_FOOTBALL_KEY=... node scripts/fetch-week.mjs
//
// Free tier is 100 requests a day and this run costs about sixty, so responses
// are cached under .cache/ and a re-run inside the same week is nearly free.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) {
  console.error("API_FOOTBALL_KEY is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const HOST = "https://v3.football.api-sports.io";
const CACHE = ".cache";
const OUT = "src/data/week.json";

const LEAGUES = [39, 140, 135, 78, 61, 2];
const FORM_MATCHES = 8;
// The ids endpoint takes at most twenty per call.
const ID_BATCH = 20;
// Free plan throttles per minute, so leave room between calls.
const GAP_MS = 2500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let calls = 0;

async function api(endpoint, params) {
  const url = new URL(`${HOST}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const digest = createHash("sha1").update(url.toString()).digest("hex").slice(0, 16);
  const cached = path.join(CACHE, `${digest}.json`);

  try {
    return JSON.parse(await readFile(cached, "utf8"));
  } catch {
    // Not cached yet.
  }

  if (calls > 0) await sleep(GAP_MS);
  calls += 1;

  const response = await fetch(url, { headers: { "x-apisports-key": KEY } });
  if (!response.ok) throw new Error(`${endpoint} ${response.status} ${await response.text()}`);

  const body = await response.json();
  if (body.errors && Object.keys(body.errors).length > 0) {
    throw new Error(`${endpoint}: ${JSON.stringify(body.errors)}`);
  }

  await mkdir(CACHE, { recursive: true });
  await writeFile(cached, JSON.stringify(body));
  return body;
}

// Monday to Sunday of the week the given day falls in, in Addis terms.
function weekWindow(now = new Date()) {
  const addis = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const monday = new Date(addis);
  // getUTCDay is Sunday-first; shift so Monday starts the week.
  monday.setUTCDate(addis.getUTCDate() - ((addis.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const iso = (date) => date.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(sunday) };
}

// A European season is stamped with the year it started in.
const seasonFor = (date) => (date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1);

const shortName = (name) => {
  const trimmed = name.replace(/\s+(FC|CF|AC|AS|SC|SV|BSC)$/i, "");
  return trimmed.length <= 14 ? trimmed : trimmed.slice(0, 13).trimEnd() + ".";
};

const asTeam = (team) => ({
  id: team.id,
  name: team.name,
  short: shortName(team.name),
  logo: team.logo ?? "",
});

// The opening goal of a match, from the event feed. Own goals count for the
// side they went in against, which is how the feed already reports them.
function openingGoal(events = []) {
  const goals = events
    .filter((event) => event.type === "Goal" && event.detail !== "Missed Penalty")
    .map((event) => ({
      teamId: event.team?.id,
      minute: (event.time?.elapsed ?? 0) + (event.time?.extra ?? 0),
      player: event.player?.name ?? null,
    }))
    .sort((a, b) => a.minute - b.minute);

  return goals[0] ?? null;
}

async function main() {
  const now = new Date();
  const { from, to } = weekWindow(now);
  const season = seasonFor(now);

  console.log(`week ${from} to ${to}, season ${season}`);

  // 1. This week's fixtures across the six competitions.
  const scheduled = [];
  for (const league of LEAGUES) {
    const body = await api("fixtures", { league, season, from, to, timezone: "UTC" });
    scheduled.push(...body.response);
    console.log(`league ${league}: ${body.response.length} fixtures`);
  }

  if (scheduled.length === 0) {
    console.error("No fixtures in this window. Mid-season break, or the season is wrong.");
    process.exit(1);
  }

  // 2. Last eight for every team involved.
  const teamIds = new Set();
  for (const fixture of scheduled) {
    teamIds.add(fixture.teams.home.id);
    teamIds.add(fixture.teams.away.id);
  }

  const formByTeam = new Map();
  for (const teamId of teamIds) {
    const body = await api("fixtures", { team: teamId, last: FORM_MATCHES, timezone: "UTC" });
    formByTeam.set(teamId, body.response);
  }

  // 3. Events for the past matches, and for anything already played this week,
  //    fetched in batches so one call covers twenty fixtures.
  const needEvents = new Set();
  for (const matches of formByTeam.values()) {
    for (const match of matches) needEvents.add(match.fixture.id);
  }
  for (const fixture of scheduled) {
    if (fixture.fixture.status.short === "FT") needEvents.add(fixture.fixture.id);
  }

  const eventsByFixture = new Map();
  const ids = [...needEvents];
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const batch = ids.slice(i, i + ID_BATCH);
    const body = await api("fixtures", { ids: batch.join("-"), timezone: "UTC" });
    for (const entry of body.response) {
      eventsByFixture.set(entry.fixture.id, entry.events ?? []);
    }
    console.log(`events ${i + batch.length}/${ids.length}`);
  }

  // Form for one team, told from that team's side of each match.
  const formFor = (teamId, team) => ({
    team: asTeam(team),
    matches: (formByTeam.get(teamId) ?? [])
      .filter((match) => match.fixture.status.short === "FT")
      .map((match) => {
        const atHome = match.teams.home.id === teamId;
        const opening = openingGoal(eventsByFixture.get(match.fixture.id));

        return {
          fixtureId: match.fixture.id,
          kickoff: match.fixture.date,
          venue: atHome ? "home" : "away",
          opponent: shortName(atHome ? match.teams.away.name : match.teams.home.name),
          goalsFor: (atHome ? match.goals.home : match.goals.away) ?? 0,
          goalsAgainst: (atHome ? match.goals.away : match.goals.home) ?? 0,
          firstGoal: opening ? (opening.teamId === teamId ? "for" : "against") : null,
          firstGoalMinute: opening ? opening.minute : null,
        };
      })
      .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff))
      .slice(0, FORM_MATCHES),
  });

  const fixtures = scheduled
    .map((fixture) => {
      const finished = fixture.fixture.status.short === "FT";
      const opening = finished ? openingGoal(eventsByFixture.get(fixture.fixture.id)) : null;

      return {
        id: fixture.fixture.id,
        leagueId: fixture.league.id,
        round: fixture.league.round,
        kickoff: fixture.fixture.date,
        status: finished ? "finished" : "scheduled",
        home: formFor(fixture.teams.home.id, fixture.teams.home),
        away: formFor(fixture.teams.away.id, fixture.teams.away),
        result: finished
          ? {
              goalsHome: fixture.goals.home ?? 0,
              goalsAway: fixture.goals.away ?? 0,
              firstGoal: opening
                ? opening.teamId === fixture.teams.home.id
                  ? "home"
                  : "away"
                : null,
              firstGoalMinute: opening ? opening.minute : null,
              firstScorer: opening ? opening.player : null,
            }
          : null,
      };
    })
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

  const data = {
    generatedAt: new Date().toISOString(),
    weekStart: from,
    fixtures,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);

  console.log(`wrote ${fixtures.length} fixtures to ${OUT} in ${calls} api calls`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
