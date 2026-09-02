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
// back to feed.json, which only moves when the refresh workflow redeploys.

const UPSTREAM = "https://api.football-data.org/v4/matches";

// One upstream call per this many seconds, however many readers there are. The
// free tier is ten calls a minute and a match does not change faster than this.
const CACHE_SECONDS = 20;

// Sent to the browser, which polls on its own clock.
const BROWSER_CACHE_SECONDS = 10;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
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

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET") {
      return json({ error: "GET only" }, 405);
    }

    const token = env.FOOTBALL_DATA_TOKEN;
    if (!token) return json({ error: "no token configured" }, 500);

    // Anything in play, plus today's finished matches so a score that has just
    // gone final still lands on the page.
    const today = new Date().toISOString().slice(0, 10);
    const upstream = `${UPSTREAM}?dateFrom=${today}&dateTo=${today}`;

    // Keyed on the day rather than the request, so every reader shares one
    // cached response however they arrived.
    const key = new Request(upstream, { method: "GET" });
    const cache = caches.default;

    let response = await cache.match(key);
    let cached = true;

    if (!response) {
      cached = false;
      const fetched = await fetch(upstream, {
        headers: { "X-Auth-Token": token },
      });

      if (!fetched.ok) {
        const text = await fetched.text();
        return json(
          { error: "upstream", status: fetched.status, detail: text.slice(0, 200) },
          502
        );
      }

      response = new Response(fetched.body, fetched);
      response.headers.set("cache-control", `public, max-age=${CACHE_SECONDS}`);
      ctx.waitUntil(cache.put(key, response.clone()));
    }

    const payload = await response.json();
    const matches = Array.isArray(payload.matches) ? payload.matches : [];

    return json({
      at: new Date().toISOString(),
      cached,
      matches: matches.map(trim).filter((m) => m.status !== "scheduled"),
    });
  },
};
