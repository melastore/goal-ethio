# Live scores worker

The site is a static export, so it cannot hold an API token, and
football-data.org sends no CORS headers, so the browser cannot call it directly.
This Worker sits between the two.

```sh
cd worker
npx wrangler secret put FOOTBALL_DATA_TOKEN
npx wrangler deploy
```

Then put the deployed URL in the repo as a variable named `LIVE_URL`
(Settings > Secrets and variables > Actions > Variables). The deploy workflow
passes it through as `NEXT_PUBLIC_LIVE_URL`.

Without it the site still works: it falls back to `feed.json`, which only moves
when the refresh workflow redeploys, so scores land in half an hour rather than
half a minute.

One upstream call every 20 seconds is shared by every reader through the edge
cache, so the free tier's ten calls a minute is never close.
