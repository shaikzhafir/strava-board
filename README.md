# Strava Activity Board — Cloudflare Workers

A deployable-template for a personal Strava dashboard. One-time login claims the instance; the board (recent activities, summary stats, map previews, pace/distance charts) is publicly visible. A scheduled Worker syncs from the Strava API every 30 minutes so page loads never hit Strava directly.

- **Runtime:** Cloudflare Workers (with Assets + KV + Cron Triggers)
- **Frontend:** React + Vite, bundled via `@cloudflare/vite-plugin`
- **Storage:** Cloudflare KV (OAuth tokens + cached Strava data + app config)
- **Setup:** zero deploy-time secrets — credentials are configured after deploy through an in-app wizard.

## Prerequisites

To use the **Deploy to Cloudflare** flow (or to fork and deploy manually), you only need:

- A **[GitHub](https://github.com/signup)** account — the button forks this repo into your account so you own the copy.
- A **[Cloudflare](https://dash.cloudflare.com/sign-up)** account — Workers, KV, and cron run there.

You do **not** need a Strava app or API keys before deploy; the Worker starts empty and the in-app wizard walks you through Strava after the first deploy.

## Deploy to Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shaikzhafir/strava-board)

Clicking the button will:

1. Fork this repo into your GitHub account.
2. Connect the fork to your Cloudflare account.
3. Auto-provision the KV namespace declared in `wrangler.jsonc` (binding: `STRAVA_KV`).
4. Install the cron trigger (`*/30 * * * *`).
5. Build and deploy the Worker (`npm run deploy` runs `npm run build` then `wrangler deploy` using `wrangler.jsonc`).

You will **not** be asked for any secrets or API keys during this flow.

### Setup (one-time, takes ~60 seconds)

Once the first deploy finishes, open your Worker URL (for example `https://your-worker-name.<subdomain>.workers.dev` — it matches the `name` field in `wrangler.jsonc`). You'll land on a short gated flow:

1. **Claim the instance.** Before anything else you're asked to register an admin account — your **GitHub username** plus a password of your choice. This closes the "someone else hits the URL before you do" window, so complete it immediately after your deploy finishes. The password is salted and PBKDF2-hashed before being saved to KV (lightweight settings: not a high-assurance vault); it's never stored in plaintext. Minimum length is 8 characters.
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

Copy the `id` from the output into `wrangler.jsonc` (replacing `"<your-kv-namespace-id>"`). Edit the top-level `"name"` in `wrangler.jsonc` to the Worker name you want (for example your GitHub username plus `-board`); that value controls the default `*.workers.dev` hostname.

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

### Manual sync (development only)

The **production** build does **not** show an in-app **refresh** link next to “Last synced …”. In production, data updates come from the **cron** schedule (plus the automatic sync after OAuth). That avoids casual repeated manual syncs, which would spend Strava API quota and Worker invocations faster than necessary.

When you run **`npm run dev`**, the board header includes **refresh** so you can queue `POST /api/sync` without waiting for cron. The Worker still exposes that route for owners; you can also trigger it with a valid owner session cookie (for example with `curl`) if you need to test a deployed worker without the UI control.

### Optional: skip the wizard in local dev

If you'd rather not run through the wizard on every `npm run dev`, create a gitignored `.dev.vars` at the repo root. You can start from `local-dev.env.example` (`cp local-dev.env.example .dev.vars` and fill in values). We intentionally do **not** ship `.dev.vars.example`: Cloudflare’s “Deploy to Workers” flow prompts for every key listed in that filename, which would incorrectly ask for Strava credentials during deploy instead of in the post-deploy wizard.

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

Each sync uses on the order of a few Strava API calls (see `worker/sync.ts`). Strava's per-app quota is 2000 calls/day, so even `*/5 * * * *` (every 5 min) is comfortably within budget. More frequent cron = fresher data. Manual sync from the UI is available only in **local dev** (`npm run dev`); production relies on cron so the board does not encourage extra syncs that burn quota.

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

Strava is called from the OAuth callback, the cron handler, and owner `POST /api/sync` (the production SPA does not offer a button for that—see [Manual sync (development only)](#manual-sync-development-only)). Normal browser **GET** requests for the board read KV only.

For a **full end-to-end walkthrough** (deploy → admin gate → wizard → OAuth → sync → public board), where each secret lives, and why you never paste refresh or bearer tokens in the UI, see [docs/e2e-flow-and-security.md](docs/e2e-flow-and-security.md).

## Extending the board (Strava API and visualizations)

### Human-readable guide

[docs/strava-skills.md](docs/strava-skills.md) documents OAuth scopes, rate limits, which endpoints the app uses today, ideas for new charts (streams, segments, routes, and more), and how to wire data either into the **scheduled sync** (KV-backed, cheap at read time) or **on demand** (owner-gated, good for heavy payloads like activity streams).

### Agent skill (Strava API)

The repo ships a **Cursor-compatible skill** under **`skills/strava-api/`** (versioned like any other source) so collaborators and AI assistants can extend the app without breaking the “public `/api/*` reads KV only” rule:

| Location | Purpose |
| --- | --- |
| [skills/strava-api/SKILL.md](skills/strava-api/SKILL.md) | Concise rules and the two extension paths (sync vs on-demand); points at `docs/strava-skills.md` for the full endpoint catalog |

**How to use it**

1. **Any editor / assistant:** Open or `@`-reference [`skills/strava-api/SKILL.md`](skills/strava-api/SKILL.md) when working on Strava-backed Worker or UI changes.
2. **Cursor auto-discovery:** Cursor loads project skills from **`.cursor/skills/`**, which is often gitignored for personal tooling. To use this repo’s skill as a Cursor **project skill**, copy or symlink it, for example: `skills/strava-api` → `.cursor/skills/strava-api` (same `SKILL.md` layout). Alternatively, keep using the file under `skills/` only—it stays in git for everyone.
3. **Global Cursor skills:** Copy `skills/strava-api` to `~/.cursor/skills/strava-api` on your machine if you want the same instructions in other workspaces.
4. **Forks and PRs:** Update `skills/strava-api/SKILL.md` when you introduce new conventions (e.g. a new KV key pattern) so contributors stay aligned.

Strava HTTP API reference: [developers.strava.com/docs/reference](https://developers.strava.com/docs/reference/).

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
