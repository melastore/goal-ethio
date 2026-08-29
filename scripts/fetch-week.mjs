// Pulls the coming week's fixtures and each team's recent form from
// football-data.org, then writes src/data/week.json for the build to bake in.
//
//   FOOTBALL_DATA_TOKEN=... node scripts/fetch-week.mjs
//
// Free tier covers the current season for all six competitions but carries no
// goal-event feed, so who scored first is read off the half-time score. That
// settles most matches and leaves the rest unknown rather than guessed.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!TOKEN) {
  console.error("FOOTBALL_DATA_TOKEN is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const HOST = "https://api.football-data.org/v4";
const CACHE = ".cache";
const OUT = "src/data/week.json";

// The ids the rest of the app knows these competitions by, kept stable so the
// league table and the Android app need no change if the source moves again.
const COMPETITIONS = [
  { code: "PL", id: 39 },
  { code: "PD", id: 140 },
  { code: "SA", id: 135 },
  { code: "BL1", id: 78 },
  { code: "FL1", id: 61 },
  { code: "CL", id: 2 },
];

const CODE_TO_ID = new Map(COMPETITIONS.map((c) => [c.code, c.id]));

const FORM_MATCHES = 8;
// A season is only weeks old in August, so form reaches back into the last one.
const FORM_WINDOW_DAYS = 160;
// Free tier allows ten calls a minute.
const GAP_MS = 6500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let calls = 0;

async function api(endpoint, params = {}) {
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

  const response = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });

  if (response.status === 429) {
    // The window is a minute; waiting it out beats failing the whole run.
    console.log("rate limited, waiting 60s");
    await sleep(60_000);
    return api(endpoint, params);
  }

  if (!response.ok) {
    throw new Error(`${endpoint} ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();

  await mkdir(CACHE, { recursive: true });
  await writeFile(cached, JSON.stringify(body));
  return body;
}

const iso = (date) => date.toISOString().slice(0, 10);

// Monday to Sunday of the week the given day falls in, in Addis terms.
function weekWindow(now = new Date()) {
  const addis = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const monday = new Date(addis);
  // getUTCDay is Sunday-first; shift so Monday starts the week.
  monday.setUTCDate(addis.getUTCDate() - ((addis.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return { from: iso(monday), to: iso(sunday) };
}

const shortName = (team) =>
  team.tla || team.shortName || team.name.replace(/\s+(FC|CF|AC|AS|SC|SV|BSC)$/i, "");

const asTeam = (team) => ({
  id: team.id,
  name: team.shortName || team.name,
  short: shortName(team),
  logo: team.crest ?? "",
});

/**
 * Which side opened the scoring, from the two scorelines alone.
 *
 * A lead at half time settles it outright. Level at half time still settles it
 * when only one side scored across the match. Anything else genuinely cannot be
 * known without a goal feed, and is left null rather than guessed.
 */
function openedScoring(score) {
  const ht = score.halfTime ?? {};
  const ft = score.fullTime ?? {};

  const htHome = ht.home ?? 0;
  const htAway = ht.away ?? 0;
  if (htHome > htAway) return "home";
  if (htAway > htHome) return "away";

  const ftHome = ft.home ?? 0;
  const ftAway = ft.away ?? 0;
  if (ftHome > 0 && ftAway === 0) return "home";
  if (ftAway > 0 && ftHome === 0) return "away";

  return null;
}

async function main() {
  const now = new Date();
  const { from, to } = weekWindow(now);

  const formFrom = new Date(now);
  formFrom.setUTCDate(formFrom.getUTCDate() - FORM_WINDOW_DAYS);

  console.log(`week ${from} to ${to}`);

  // 1. This week's fixtures across the six competitions.
  const scheduled = [];
  for (const competition of COMPETITIONS) {
    const body = await api(`competitions/${competition.code}/matches`, {
      dateFrom: from,
      dateTo: to,
    });

    const matches = body.matches ?? [];
    scheduled.push(...matches.map((match) => ({ ...match, leagueId: competition.id })));
    console.log(`${competition.code}: ${matches.length} fixtures`);
  }

  if (scheduled.length === 0) {
    console.error("No fixtures in this window. Mid-season break, or an international week.");
    process.exit(1);
  }

  // 2. Recent form for every team involved.
  const teams = new Map();
  for (const match of scheduled) {
    teams.set(match.homeTeam.id, match.homeTeam);
    teams.set(match.awayTeam.id, match.awayTeam);
  }

  console.log(`${teams.size} teams to fetch form for`);

  const formByTeam = new Map();
  for (const teamId of teams.keys()) {
    const body = await api(`teams/${teamId}/matches`, {
      status: "FINISHED",
      dateFrom: iso(formFrom),
      dateTo: iso(now),
    });

    const played = (body.matches ?? [])
      // Cups outside the six are a different standard of opposition, and the
      // baseline is pooled per competition, so they are left out.
      .filter((match) => CODE_TO_ID.has(match.competition?.code))
      .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
      .slice(0, FORM_MATCHES);

    formByTeam.set(teamId, played);
  }

  const formFor = (teamId) => ({
    team: asTeam(teams.get(teamId)),
    matches: (formByTeam.get(teamId) ?? []).map((match) => {
      const atHome = match.homeTeam.id === teamId;
      const opened = openedScoring(match.score);

      return {
        fixtureId: match.id,
        kickoff: match.utcDate,
        venue: atHome ? "home" : "away",
        opponent: shortName(atHome ? match.awayTeam : match.homeTeam),
        goalsFor: (atHome ? match.score.fullTime.home : match.score.fullTime.away) ?? 0,
        goalsAgainst: (atHome ? match.score.fullTime.away : match.score.fullTime.home) ?? 0,
        firstGoal: opened === null ? null : (opened === "home") === atHome ? "for" : "against",
        // No goal feed on this tier, so the minute is never known.
        firstGoalMinute: null,
      };
    }),
  });

  const fixtures = scheduled
    .map((match) => {
      const finished = match.status === "FINISHED";
      const opened = finished ? openedScoring(match.score) : null;

      return {
        id: match.id,
        leagueId: match.leagueId,
        round: match.stage === "REGULAR_SEASON" ? `Matchday ${match.matchday}` : match.stage,
        kickoff: match.utcDate,
        status: finished ? "finished" : "scheduled",
        home: formFor(match.homeTeam.id),
        away: formFor(match.awayTeam.id),
        result: finished
          ? {
              goalsHome: match.score.fullTime.home ?? 0,
              goalsAway: match.score.fullTime.away ?? 0,
              firstGoal: opened,
              firstGoalMinute: null,
              firstScorer: null,
            }
          : null,
      };
    })
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

  const data = { generatedAt: new Date().toISOString(), weekStart: from, fixtures };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);

  const decided = fixtures.flatMap((f) => [...f.home.matches, ...f.away.matches]);
  const known = decided.filter((m) => m.firstGoal !== null).length;

  console.log(
    `wrote ${fixtures.length} fixtures in ${calls} calls; ` +
      `first goal known for ${known}/${decided.length} form matches`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
