// Pulls the coming week's fixtures and each team's recent form from
// football-data.org, then writes src/data/week.json for the build to bake in.
//
//   FOOTBALL_DATA_TOKEN=... node scripts/fetch-week.mjs
//
// Free tier covers the current season for all six competitions but carries no
// goal-event feed, so who scored first is read off the half-time score. That
// settles most matches and leaves the rest unknown rather than guessed.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
  { code: "DED", id: 88 },
  { code: "PPL", id: 94 },
  { code: "ELC", id: 40 },
  { code: "BSA", id: 71 },
  // Only has fixtures in a tournament summer; costs one call to ask.
  { code: "EC", id: 4 },
];

const CODE_TO_ID = new Map(COMPETITIONS.map((c) => [c.code, c.id]));

const FORM_MATCHES = 8;
// How far ahead to list. A month is as far as most of these competitions have
// confirmed kickoff times for.
const AHEAD_DAYS = 30;
// A season is only weeks old in August, so form reaches back into the last one.
const FORM_WINDOW_DAYS = 160;
// Free tier allows ten calls a minute. Ten seconds sits clear of the edge, and
// the whole run is two calls per competition, so the slack costs little.
const GAP_MS = 10_000;
// Throttling is reported as a 400 "token is invalid", so the token is checked
// once up front and that message is treated as backpressure afterwards.
const THROTTLE_MESSAGE = "Your API token is invalid.";
// A cached response goes stale the moment a match finishes, so it is only
// reused inside this window. CACHE_TTL_MINUTES=0 always refetches.
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MINUTES ?? 60) * 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let calls = 0;
// Set once the first call proves the token works, so a later rejection can be
// read as throttling rather than a bad credential.
let tokenChecked = false;

async function api(endpoint, params = {}, attempt = 0) {
  const url = new URL(`${HOST}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const digest = createHash("sha1").update(url.toString()).digest("hex").slice(0, 16);
  const cached = path.join(CACHE, `${digest}.json`);

  try {
    const { mtimeMs } = await stat(cached);
    if (Date.now() - mtimeMs < CACHE_TTL_MS) return JSON.parse(await readFile(cached, "utf8"));
  } catch {
    // Not cached yet.
  }

  if (calls > 0) await sleep(GAP_MS);
  calls += 1;

  const response = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });

  if (!response.ok) {
    const text = await response.text();
    const throttled =
      response.status === 429 ||
      (response.status === 400 && text.includes(THROTTLE_MESSAGE) && tokenChecked);

    if (throttled && attempt < 3) {
      // The window is a minute; waiting it out beats failing the whole run.
      console.log(`throttled on ${endpoint}, waiting 60s`);
      await sleep(60_000);
      return api(endpoint, params, attempt + 1);
    }

    throw new Error(`${endpoint} ${response.status}: ${text}`);
  }

  const body = await response.json();

  tokenChecked = true;

  await mkdir(CACHE, { recursive: true });
  await writeFile(cached, JSON.stringify(body));
  return body;
}

const iso = (date) => date.toISOString().slice(0, 10);

/**
 * From the Monday of the current week out to a month ahead, in Addis terms.
 *
 * It starts on Monday rather than today so results from earlier in the week are
 * still carried, which is what the results page grades against.
 */
function listingWindow(now = new Date()) {
  const addis = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const monday = new Date(addis);
  // getUTCDay is Sunday-first; shift so Monday starts the week.
  monday.setUTCDate(addis.getUTCDate() - ((addis.getUTCDay() + 6) % 7));

  const end = new Date(addis);
  end.setUTCDate(addis.getUTCDate() + AHEAD_DAYS);

  return { from: iso(monday), to: iso(end) };
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
  const { from, to } = listingWindow(now);

  const formFrom = new Date(now);
  formFrom.setUTCDate(formFrom.getUTCDate() - FORM_WINDOW_DAYS);

  console.log(`listing ${from} to ${to}`);

  const scheduled = [];
  // Every finished match across the tracked competitions, which is what form is
  // built from. Pulling it per competition rather than per team turns two
  // hundred calls into two.
  const history = [];

  for (const competition of COMPETITIONS) {
    const listing = await api(`competitions/${competition.code}/matches`, {
      dateFrom: from,
      dateTo: to,
    });

    const matches = (listing.matches ?? []).map((match) => ({
      ...match,
      leagueId: competition.id,
    }));
    scheduled.push(...matches);

    const past = await api(`competitions/${competition.code}/matches`, {
      dateFrom: iso(formFrom),
      dateTo: iso(now),
      status: "FINISHED",
    });

    history.push(...(past.matches ?? []));

    console.log(
      `${competition.code}: ${matches.length} listed, ${(past.matches ?? []).length} played`
    );
  }

  if (scheduled.length === 0) {
    console.error("No fixtures in this window. Every competition is between seasons.");
    process.exit(1);
  }

  const teams = new Map();
  for (const match of scheduled) {
    teams.set(match.homeTeam.id, match.homeTeam);
    teams.set(match.awayTeam.id, match.awayTeam);
  }

  // Each finished match lands in both teams' form, told from their own side.
  const formByTeam = new Map();
  const seen = new Set();

  for (const match of history) {
    if (seen.has(match.id)) continue;
    // Anything outside the tracked competitions is a different standard of
    // opposition, and the baselines are pooled per competition.
    if (!CODE_TO_ID.has(match.competition?.code)) continue;
    seen.add(match.id);

    for (const teamId of [match.homeTeam.id, match.awayTeam.id]) {
      if (!teams.has(teamId)) continue;
      if (!formByTeam.has(teamId)) formByTeam.set(teamId, []);
      formByTeam.get(teamId).push(match);
    }
  }

  for (const matches of formByTeam.values()) {
    matches.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
  }

  const formFor = (teamId) => ({
    team: asTeam(teams.get(teamId)),
    matches: (formByTeam.get(teamId) ?? []).slice(0, FORM_MATCHES).map((match) => {
      const atHome = match.homeTeam.id === teamId;
      const opened = openedScoring(match.score);

      return {
        fixtureId: match.id,
        kickoff: match.utcDate,
        venue: atHome ? "home" : "away",
        opponent: shortName(atHome ? match.awayTeam : match.homeTeam),
        goalsFor: (atHome ? match.score.fullTime.home : match.score.fullTime.away) ?? 0,
        goalsAgainst: (atHome ? match.score.fullTime.away : match.score.fullTime.home) ?? 0,
        // The half-time score is the only split of the match this tier gives, and
        // it is what the first-half markets are fitted on.
        halfFor: atHome ? (match.score.halfTime?.home ?? null) : (match.score.halfTime?.away ?? null),
        halfAgainst: atHome ? (match.score.halfTime?.away ?? null) : (match.score.halfTime?.home ?? null),
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
              halfHome: match.score.halfTime?.home ?? null,
              halfAway: match.score.halfTime?.away ?? null,
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

  const form = fixtures.flatMap((f) => [...f.home.matches, ...f.away.matches]);
  const known = form.filter((m) => m.firstGoal !== null).length;
  const upcoming = fixtures.filter((f) => f.status === "scheduled").length;

  console.log(
    `wrote ${fixtures.length} fixtures (${upcoming} upcoming) for ${teams.size} teams ` +
      `in ${calls} calls; first goal known for ${known}/${form.length} form matches`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
