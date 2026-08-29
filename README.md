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

Get a free key from [api-football](https://www.api-football.com/), then:

```sh
cp .env.example .env
# fill in API_FOOTBALL_KEY
npm run fetch:week
```

That writes `src/data/week.json`: this week's fixtures, each team's last eight
matches split home and away, and the opening goal of every one of them. Free tier
is 100 calls a day and a run costs about sixty, with responses cached in `.cache/`.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages. `refresh.yml` re-pulls the
data every morning and commits it, which triggers the deploy.

Repo settings needed:

- Secret `API_FOOTBALL_KEY`
- Variable `SITE_URL`, the site's own origin
- Pages source set to GitHub Actions
- `public/CNAME` holding the custom domain

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
scripts/fetch-week.mjs   pulls from api-football into src/data/week.json
scripts/build-feed.mjs   projects it into public/feed.json for the Android app
src/lib/model.ts         the projection
src/lib/scoring.ts       predicted against actual
src/lib/ethiopian-date.ts  kickoff on the Ethiopian calendar and clock
```
