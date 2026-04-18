# Strava Activity Board — Cloudflare Workers

A deployable-template for a personal Strava dashboard. One-time login claims the instance; the board (recent activities, summary stats, map previews, pace/distance charts) is publicly visible. A scheduled Worker syncs from the Strava API every 30 minutes so page loads never hit Strava directly.

- **Runtime:** Cloudflare Workers (with Assets + KV + Cron Triggers)
- **Frontend:** React + Vite, bundled via `@cloudflare/vite-plugin`
- **Storage:** Cloudflare KV (OAuth tokens + cached Strava data)

## Deploy to Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/strava-board)

> Replace `YOUR_USERNAME/strava-board` in the button URL above with your actual GitHub repo once you fork this repository.

Clicking the button will:

1. Fork this repo into your GitHub account.
2. Connect the fork to your Cloudflare account.
3. Provision the KV namespace declared in `wrangler.jsonc` (binding: `STRAVA_KV`).
4. Build (`npm run build`) and deploy the Worker.

After the initial deploy completes, you still need to do three things before the app works. See **Post-deploy setup** below.

### Post-deploy setup

1. **Create a Strava API application** at <https://www.strava.com/settings/api>. Set **Authorization Callback Domain** to the hostname of your Worker (e.g. `strava-cloudflare-workers.your-subdomain.workers.dev`, no scheme). Note down the Client ID and Client Secret.

2. **Set `APP_URL`** in `wrangler.jsonc` to your Worker's URL (no trailing slash), commit, and push — the connected Cloudflare build will redeploy automatically. Alternatively update `vars.APP_URL` via the Cloudflare dashboard under *Workers → your worker → Settings → Variables*.

3. **Set secrets** via `wrangler secret put` (or the Cloudflare dashboard):
   ```sh
   npx wrangler secret put STRAVA_CLIENT_ID
   npx wrangler secret put STRAVA_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET   # use: openssl rand -hex 32
   ```

4. **Visit your Worker URL** and click **Connect with Strava**. The first athlete to log in becomes the owner of this instance; a different Strava account attempting to log in afterwards is rejected with 403. Once claimed, the board is populated immediately via an initial sync, and the cron trigger keeps it fresh (default: every 30 minutes).

---

## Deploy manually (CLI)

Prefer the CLI? Follow these steps instead of the deploy button above.

### 1. Clone & install

```sh
git clone <this-repo> strava-board && cd strava-board
npm install
```

### 2. Create a Strava API application

Go to <https://www.strava.com/settings/api> and create a new application.

- **Authorization Callback Domain:** set to `<your-worker>.workers.dev` (or your custom domain, without scheme).
- Note the **Client ID** and **Client Secret** — you will need them below.

### 3. Install wrangler and log in to Cloudflare

```sh
npm i -g wrangler    # or use `npx wrangler` everywhere
wrangler login
```

### 4. Create a KV namespace and wire it up

```sh
npx wrangler kv namespace create STRAVA_KV
```

Copy the `id` from the output into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "STRAVA_KV", "id": "<paste-id-here>" }
]
```

### 5. Set `APP_URL`

In `wrangler.jsonc`, set `vars.APP_URL` to your Worker's public URL (no trailing slash), e.g.:

```jsonc
"vars": { "APP_URL": "https://strava-cloudflare-workers.example.workers.dev" }
```

### 6. Set secrets

```sh
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET   # use: openssl rand -hex 32
```

### 7. Deploy

```sh
npm run deploy
```

### 8. Claim the instance

Visit your Worker URL and click **Connect with Strava**. The first athlete to log in becomes the owner. A second Strava account attempting to log in is rejected with 403.

Once claimed, the board is populated immediately via an initial sync. After that, the cron trigger keeps it fresh automatically (default: every 30 minutes).

## Local development

```sh
cp .dev.vars.example .dev.vars
# fill in STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, SESSION_SECRET
# keep APP_URL=http://localhost:5173

npm run dev
```

For local OAuth to work, add `localhost` as a second callback domain in your Strava app settings.

## Tuning the sync frequency

In `wrangler.jsonc`:

```jsonc
"triggers": { "crons": ["*/30 * * * *"] }
```

Each sync uses ~3 Strava API calls. Strava's per-app quota is 2000 calls/day, so even `*/5 * * * *` (every 5 min) is comfortably within budget. More frequent = fresher data; the owner can also click **refresh** in the UI to force an immediate sync.

## Testing

```sh
npm test
```

The suite covers session signing/verification, polyline decoding, format helpers, KV helpers, the sync pipeline (with mocked Strava), OAuth callback (owner claim, rejection, token rotation), and the HTTP router.

## Architecture

```
                       ┌── Scheduled (cron) ──► Strava ──► KV (cached board data)
Cloudflare Worker ─────┤
                       ├── /auth/* ──► Strava OAuth ──► KV (tokens, owner)
                       │
Browser ───────────────┴── /api/* ──► KV (reads cache only — never Strava)
                       │
                       └── /* ──► Static assets (React SPA)
```

Strava is only called from the OAuth callback and the cron handler. Browser page loads read entirely from KV.

## Out of scope (for now)

Multi-user support, per-activity detail views (segments, splits, streams), Strava webhooks, dark mode.
