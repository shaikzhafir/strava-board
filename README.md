# Strava Activity Board — Cloudflare Workers

A deployable-template for a personal Strava dashboard. One-time login claims the instance; the board (recent activities, summary stats, map previews, pace/distance charts) is publicly visible. A scheduled Worker syncs from the Strava API every 30 minutes so page loads never hit Strava directly.

- **Runtime:** Cloudflare Workers (with Assets + KV + Cron Triggers)
- **Frontend:** React + Vite, bundled via `@cloudflare/vite-plugin`
- **Storage:** Cloudflare KV (OAuth tokens + cached Strava data + app config)
- **Setup:** zero deploy-time secrets — credentials are configured after deploy through an in-app wizard.

## Deploy to Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shaikzhafir/strava-board)

Clicking the button will:

1. Fork this repo into your GitHub account.
2. Connect the fork to your Cloudflare account.
3. Auto-provision the KV namespace declared in `wrangler.jsonc` (binding: `STRAVA_KV`).
4. Install the cron trigger (`*/30 * * * *`).
5. Build (`npm run build`) and deploy the Worker.

You will **not** be asked for any secrets or API keys during this flow.

### Setup (one-time, takes ~60 seconds)

Once the first deploy finishes, open your Worker URL (e.g. `https://strava-board.your-subdomain.workers.dev`). You'll land on a short gated flow:

1. **Claim the instance.** Before anything else you're asked to register an admin account — your **GitHub username** plus a password of your choice. This closes the "someone else hits the URL before you do" window, so complete it immediately after your deploy finishes. The password is hashed with PBKDF2-SHA256 (210k iterations) before being saved to KV; it's never stored in plaintext.
2. Shows you the exact **Authorization Callback Domain** to paste into Strava (with a one-click copy button).
3. Links you to <https://www.strava.com/settings/api> to create your Strava app.
4. Collects your Strava **Client ID** + **Client Secret** and stores them in this Worker's KV namespace.
5. Once saved, shows **Connect with Strava**. The first athlete to log in becomes the owner of this instance; a different Strava account attempting to log in afterwards is rejected with 403.

That's it — the board is populated immediately via an initial sync, and the cron trigger keeps it fresh. Once an athlete has claimed the instance the board is publicly viewable and the admin login is no longer required to read it.

> Want to rotate your Strava secret later? Re-open the setup wizard as the owner (Strava session) or as the admin (username + password) and re-enter the new value. Anonymous writes are always refused.

> Forgot your admin password? Delete the `config:admin` key from the Worker's KV namespace and the home page will drop you back into the first-run register form: `wrangler kv key delete --binding=STRAVA_KV "config:admin"`.

---

## Deploy manually (CLI)

Prefer the CLI? It's also zero-prompt — you don't need a Strava app before deploying.

### 1. Clone & install

```sh
git clone <this-repo> strava-board && cd strava-board
npm install
```

### 2. Create a KV namespace and wire it up

```sh
npx wrangler kv namespace create STRAVA_KV
```

Copy the `id` from the output into `wrangler.jsonc` (replacing `"<your-kv-namespace-id>"`).

### 3. Deploy

```sh
npm run deploy
```

### 4. Visit your Worker URL and complete the setup wizard

The wizard handles everything else (Strava app creation instructions, callback domain, saving the credentials, and claiming the instance via OAuth login).

## Local development

```sh
npm run dev
```

Open the dev server URL and walk through the same setup wizard. For the Strava OAuth redirect to work locally, add your dev origin's hostname (typically `localhost`) as a second **Authorization Callback Domain** on your Strava app page. Strava supports multiple callback domains per app, so you can use the same app for local dev and production.

### Optional: skip the wizard in local dev

If you'd rather not run through the wizard on every `npm run dev`, create a gitignored `.dev.vars` at the repo root with:

```sh
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
# SESSION_SECRET is auto-generated on first request; you can override it here too.
```

These env vars are read only as a **fallback** when KV config is absent, so they never interfere with production KV-stored credentials.

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

The suite covers session signing/verification, polyline decoding, format helpers, KV helpers, the sync pipeline (with mocked Strava), OAuth callback (owner claim, rejection, token rotation), the setup wizard API (validation + claim gating), and the HTTP router.

## Architecture

```
                       ┌── Scheduled (cron) ──► Strava ──► KV (cached board data)
Cloudflare Worker ─────┤
                       ├── /auth/* ──► Strava OAuth ──► KV (tokens, owner)
                       │
                       ├── /api/setup ──► KV (app config: strava creds)
                       │
Browser ───────────────┴── /api/* ──► KV (reads cache only — never Strava)
                       │
                       └── /* ──► Static assets (React SPA + setup wizard)
```

Strava is only called from the OAuth callback and the cron handler. Browser page loads read entirely from KV.

### Where is everything stored?

All state lives in a single KV namespace (`STRAVA_KV`):

| Key | Purpose |
| --- | --- |
| `config:strava_app` | Strava Client ID + Client Secret (set by the wizard) |
| `config:admin` | Admin account record: GitHub username + PBKDF2-hashed password (set on first access) |
| `config:session_secret` | Auto-generated HMAC key for session cookies |
| `owner:athlete_id` | The single claimed athlete ID |
| `tokens:<id>` | OAuth access + refresh tokens |
| `cache:athlete` / `cache:activities` / `cache:stats` | Board data |
| `cache:lastSyncedAt` | Timestamp of the most recent successful sync |
| `lock:sync` | 60-second lock preventing concurrent syncs |

### Resetting an instance

Want to hand an instance off to a different Strava account or start over? From the CLI:

```sh
npx wrangler kv key delete --binding=STRAVA_KV "owner:athlete_id"
# Optionally also clear the app config, admin account, and tokens:
npx wrangler kv key delete --binding=STRAVA_KV "config:strava_app"
npx wrangler kv key delete --binding=STRAVA_KV "config:admin"
```

The next visit to the Worker URL will drop you back into the setup wizard.

## Troubleshooting

### "Deploy to Cloudflare" button can't see my forked repo (or deploys fail with a Git access error)

If the Cloudflare deploy flow forks the repo but then can't read it — or the repo list in the Cloudflare dashboard doesn't show your fork at all — the **Cloudflare Workers and Pages** GitHub App probably doesn't have access to that repository. This was the symptom I hit on the first attempt.

Fix: reinstall / re-authorize the GitHub App following Cloudflare's guide — [Reinstall the Cloudflare GitHub app](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#reinstall-the-cloudflare-github-app). TL;DR:

1. Go to <https://github.com/settings/installations> (or your org's equivalent).
2. Find **Cloudflare Workers and Pages** → **Configure**.
3. Either grant access to **All repositories**, or under **Only select repositories** add your `strava-board` fork.
4. If still broken, **Uninstall** and re-install via the Cloudflare dashboard (*Workers & Pages → Create → Connect to Git → + Add account*).

Retry the deploy afterwards and it should pick up the repo.

## Out of scope (for now)

Multi-user support, per-activity detail views (segments, splits, streams), Strava webhooks, dark mode.
