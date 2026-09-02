# GoalEthio

Weekly fixtures from Europe's top five leagues and the Champions League, shown in
Ethiopian date and time, with win and first-goal projections from an
opponent-adjusted Dixon-Coles fit. English and Amharic.

## Running it

```sh
npm install
npm run dev
```

`src/data/week.json` ships with sample data, so the site runs before a key is set up.

## Real data

Get a free token from [football-data.org](https://www.football-data.org/client/register),
then:

```sh
cp .env.example .env
# fill in FOOTBALL_DATA_TOKEN
npm run fetch:week
```

That writes `src/data/week.json`: this week's fixtures and each team's last eight
matches split home and away. A busy league week involves around ninety teams and
the free tier allows ten calls a minute, so a cold run takes about ten minutes.
Responses are cached in `.cache/`, so a re-run the same day is nearly instant.

Throttling comes back as a 400 reading "Your API token is invalid", which is not
what it sounds like. The script checks the token once at the start and treats that
message as backpressure afterwards, waiting out the minute.

The free tier carries no goal-event feed, so who scored first is read off the
half-time score: a lead at the break settles it, and so does a level break when
only one side scored all match. The rest is left unknown rather than guessed, and
the named first scorer and the goal minute are not available at all.
`scripts/fetch-week-apifootball.mjs` does carry both, and works the moment an
api-football key is on a paid tier.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages. `refresh.yml` re-pulls the
data every morning and commits it, which triggers the deploy.

It publishes to `https://melastore.github.io/goal-ethio/`. The sub-path is baked
in by `NEXT_PUBLIC_BASE_PATH`, which the workflow sets from the repo name; for a
custom domain later, drop that and add a `public/CNAME`.

Repo settings needed:

- Secret `FOOTBALL_DATA_TOKEN`
- Pages source set to GitHub Actions

## Live scores

The site is a static export, so it holds no API token, and football-data.org
sends no CORS headers, so the browser cannot call it either. `worker/` is a
Cloudflare Worker that sits between the two: the token stays a Worker secret and
one upstream call every twenty seconds is shared by every reader through the edge
cache. Deploy it, set the repo variable `LIVE_URL`, and scores land in seconds.

Without it nothing breaks. The page falls back to `feed.json`, which only changes
when the refresh workflow redeploys, so scores land in half an hour instead.

A match in play is re-projected from where it stands: the remaining scoring rate
over the minutes left, the goals already scored added back on, and a nudge for
the side that is chasing.

## The model

Dixon-Coles, fitted over every match on record at once rather than team by team.
Each past match is one equation in the scorer's attack and the conceder's
defence, and the whole set is solved together, so a goal past a mean defence
counts for more than a goal past a leaky one. Ratings from thin evidence are
pulled back toward their league.

Leagues whose teams never meet cannot be compared from results alone, so each
carries an anchor: its goal rate comes from the data, its standard from a prior
in `LEAGUE_QUALITY`. That is the one number results cannot supply.

Who scores first treats the two rates as competing processes, over an intensity
that rises through the match, because goals do.

`/results` grades every finished fixture against what the model said beforehand,
and carries Brier, log loss and a reliability table alongside the hit rate. A hit
rate says the ordering is right; those say the numbers are.

## Keeping it honest

```sh
npm run backtest
```

Fits on what was known by a date and scores what happened after it, against a
flat league average and against the same fit with the opponent adjustment turned
off.

Run it before changing a constant. It is what set `PRIOR_MATCHES`, and it is
worth knowing what it currently says: on ten matches a side the ratings barely
beat a flat league average, and at a lighter prior they lose to it. Three or four
effective matches after decay cannot separate a good team from a lucky one.

That is a data problem, not a modelling one, and `src/data/history.json` is the
fix. The fetch pulls each team's last ten and the next run used to overwrite
them; `npm run archive` keeps every match ever pulled, at no extra API call. The
file grows a few hundred rows a week and the ratings get stronger on their own as
it fills.

Projections only. No bets are taken and none are placed.

## Layout

```
scripts/fetch-week.mjs   pulls from football-data.org into src/data/week.json
scripts/archive.mjs      folds those matches into src/data/history.json
scripts/build-feed.mjs   projects it into public/feed.json for the Android app
scripts/backtest.mjs     fits on the past and scores what happened next
src/lib/ratings.ts       attack and defence, solved over every match at once
src/lib/model.ts         the projection
src/lib/markets.ts       every market the goal data supports
src/lib/edge.ts          a bookmaker's price against the model
src/lib/live-model.ts    a match re-projected from where it stands
src/lib/scoring.ts       predicted against actual
src/lib/ethiopian-date.ts  kickoff on the Ethiopian calendar and clock
worker/                  the live scores proxy
```
