# GoalEthio

Weekly fixtures from Europe's top five leagues and the Champions League, shown in
Ethiopian date and time, with win and first-goal projections from each team's last
eight matches. English and Amharic.

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

## The model

Dixon-Coles. Each team's last eight are split by venue and turned into an attack
and a defence number against the competition average; the two multiply into a
goals-per-match rate per side, and the scoreline distribution follows. Rates from
thin samples are pulled back toward the average, so two home matches read as close
to average rather than as a forecast.

Who scores first treats the two rates as competing Poisson processes: the share of
the combined rate, after taking out the chance of a goalless match.

`/results` grades every finished fixture against what the model said beforehand.

Projections only. No bets are taken and none are placed. A model on eight matches
is roughly as accurate as the market, not better.

## Layout

```
scripts/fetch-week.mjs   pulls from football-data.org into src/data/week.json
scripts/build-feed.mjs   projects it into public/feed.json for the Android app
src/lib/model.ts         the projection
src/lib/scoring.ts       predicted against actual
src/lib/ethiopian-date.ts  kickoff on the Ethiopian calendar and clock
```
