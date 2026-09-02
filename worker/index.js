// Live scores, proxied.
//
// The site is a static export on Pages, so it cannot hold a token, and
// football-data.org sends no CORS headers, so a browser cannot call it either.
// This sits between: the token stays a Worker secret, the response is trimmed
// to what a scoreboard needs, and the edge cache keeps the upstream call rate
// flat no matter how many people have the page open.
//
//   cd worker
//   npx wrangler secret put FOOTBALL_DATA_TOKEN
//   npx wrangler deploy
//
// Then set NEXT_PUBLIC_LIVE_URL to the deployed URL. Without it the site falls
// back to live.json, which only moves when the refresh workflow redeploys.

// One competition at a time. The free tier answers /v4/matches with an empty
// list and a TIER_ONE permission note however the dates are set, so the
// per-competition route is the only one that carries a score.
const UPSTREAM = "https://api.football-data.org/v4/competitions";

// The codes the site covers. Anything else asked for is ignored rather than
// passed upstream.
const COMPETITIONS = new Set([
  "PL", "PD", "SA", "BL1", "FL1", "CL", "DED", "PPL", "ELC", "BSA", "EC",
]);

// The free tier allows ten calls a minute and each competition is one call, so
// the cache has to stretch as more of them are asked for. Eight a minute leaves
// room for the odd retry.
const CALLS_PER_MINUTE = 8;
const MIN_CACHE_SECONDS = 25;

const cacheSecondsFor = (count) =>
  Math.max(MIN_CACHE_SECONDS, Math.ceil((count * 60) / CALLS_PER_MINUTE));

// Sent to the browser, which polls on its own clock.
const BROWSER_CACHE_SECONDS = 10;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${BROWSER_CACHE_SECONDS}`,
      ...CORS,
      ...extra,
    },
  });

// football-data's statuses, reduced to the three the site knows.
function statusOf(status) {
  if (status === "IN_PLAY" || status === "PAUSED") return "live";
  if (status === "FINISHED" || status === "AWARDED") return "finished";
  return "scheduled";
}

// The minute is not on this tier, so it is read off the kickoff. Stoppage and a
// long break both drift it, hence the cap and the flat 45 at half time.
function minuteOf(match) {
  if (match.status === "PAUSED") return 45;
  if (match.status !== "IN_PLAY") return null;

  const started = Date.parse(match.utcDate);
  if (!Number.isFinite(started)) return null;

  const elapsed = Math.floor((Date.now() - started) / 60000);
  if (elapsed < 0) return null;
  // A 15 minute interval sits inside the elapsed clock but not the match one.
  return Math.min(90, elapsed > 60 ? elapsed - 15 : elapsed);
}

function trim(match) {
  const score = match.score ?? {};
  const full = score.fullTime ?? {};
  const half = score.halfTime ?? {};

  return {
    id: match.id,
    status: statusOf(match.status),
    minute: minuteOf(match),
    period: match.status === "PAUSED" ? "HT" : match.status === "IN_PLAY" ? "LIVE" : null,
    goalsHome: full.home ?? 0,
    goalsAway: full.away ?? 0,
    halfHome: half.home ?? null,
    halfAway: half.away ?? null,
    home: match.homeTeam?.shortName ?? match.homeTeam?.name ?? null,
    away: match.awayTeam?.shortName ?? match.awayTeam?.name ?? null,
  };
}

// Kept well past the fresh window so a throttled minute serves the last good
// answer instead of an empty scoreboard.
const STALE_SECONDS = 900;

// One competition's matches for a day, through the edge cache so every reader
// shares the same upstream call.
async function fetchCompetition(code, day, token, seconds, ctx) {
  const url = `${UPSTREAM}/${code}/matches?dateFrom=${day}&dateTo=${day}`;
  const cache = caches.default;
  const fresh = new Request(url, { method: "GET" });
  const stale = new Request(`${url}&stale=1`, { method: "GET" });

  const hit = await cache.match(fresh);
  if (hit) return { matches: (await hit.json()).matches ?? [], cached: true };

  let fetched;
  try {
    fetched = await fetch(url, { headers: { "X-Auth-Token": token } });
  } catch {
    return serveStale(cache, stale, 0);
  }

  // The free tier answers a throttle with 429, and sometimes with a 400 reading
  // "Your API token is invalid", which is not what it sounds like.
  if (!fetched.ok) return serveStale(cache, stale, fetched.status);

  const body = await fetched.text();

  const keep = (request, maxAge) => {
    const copy = new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": `public, max-age=${maxAge}`,
      },
    });
    ctx.waitUntil(cache.put(request, copy));
  };

  keep(fresh, seconds);
  keep(stale, STALE_SECONDS);

  return { matches: JSON.parse(body).matches ?? [], cached: false };
}

async function serveStale(cache, key, status) {
  const hit = await cache.match(key);
  if (!hit) return { matches: [], cached: false, error: status };
  return { matches: (await hit.json()).matches ?? [], cached: true, stale: true, error: status };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "GET only" }, 405);
    }

    const token = env.FOOTBALL_DATA_TOKEN;
    if (!token) return json({ error: "no token configured" }, 500);

    // The page says which competitions it is showing, so a quiet Tuesday costs
    // one call rather than eleven. No list means all of them.
    const asked = new URL(request.url).searchParams.get("competitions");
    const codes = (asked ? asked.split(",") : [...COMPETITIONS])
      .map((code) => code.trim().toUpperCase())
      .filter((code) => COMPETITIONS.has(code));

    if (codes.length === 0) {
      return json({ at: new Date().toISOString(), cached: false, matches: [] });
    }

    // Today, plus yesterday only in the small hours, when a late kickoff can
    // still be running past midnight UTC. Asking for both all day doubles the
    // upstream calls on a ten-a-minute allowance for nothing.
    const now = new Date();
    const days = [now.toISOString().slice(0, 10)];
    if (now.getUTCHours() < 6) {
      days.push(new Date(now.getTime() - 86400000).toISOString().slice(0, 10));
    }

    const seconds = cacheSecondsFor(codes.length * days.length);

    const results = await Promise.all(
      codes.flatMap((code) =>
        days.map((day) => fetchCompetition(code, day, token, seconds, ctx))
      )
    );

    const matches = [];
    let cached = true;
    let failed = 0;
    let stale = false;

    for (const result of results) {
      if (result.error) failed += 1;
      if (result.stale) stale = true;
      if (!result.cached) cached = false;
      for (const match of result.matches) {
        const row = trim(match);
        // Only what has actually started is a live score.
        if (row.status !== "scheduled") matches.push(row);
      }
    }

    return json({
      at: new Date().toISOString(),
      cached,
      stale,
      competitions: codes.length,
      failed,
      matches,
    });
  },
};
