import type { Env, StravaAppConfig } from "./types";

const KEY_STRAVA_APP = "config:strava_app";
const KEY_SESSION_SECRET = "config:session_secret";

/**
 * Resolve the effective Strava app credentials.
 *
 * Order of precedence:
 *   1. KV (set via the in-app setup wizard)
 *   2. Environment variables (wrangler secrets / `.dev.vars`)
 *   3. null — caller must prompt the operator to configure.
 */
export async function getStravaAppConfig(env: Env): Promise<StravaAppConfig | null> {
  const stored = await env.STRAVA_KV.get<StravaAppConfig>(KEY_STRAVA_APP, "json");
  if (stored && stored.client_id && stored.client_secret) return stored;

  if (env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET) {
    return { client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET };
  }
  return null;
}

export async function setStravaAppConfig(env: Env, config: StravaAppConfig): Promise<void> {
  await env.STRAVA_KV.put(KEY_STRAVA_APP, JSON.stringify(config));
}

/**
 * Resolve (or lazily provision) the HMAC secret used to sign session cookies.
 *
 * If an operator set `SESSION_SECRET` via wrangler secrets, use that. Otherwise
 * generate a cryptographically random value on first access and persist it to
 * KV so subsequent requests can verify existing sessions.
 */
export async function getSessionSecret(env: Env): Promise<string> {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;

  const existing = await env.STRAVA_KV.get(KEY_SESSION_SECRET);
  if (existing) return existing;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await env.STRAVA_KV.put(KEY_SESSION_SECRET, secret);
  return secret;
}

/**
 * Derive the app's public origin. Prefers an explicit `APP_URL` when set,
 * otherwise falls back to the origin of the incoming request so the redirect
 * URI passed to Strava always matches wherever the Worker is actually
 * reachable (workers.dev subdomain, custom domain, or localhost).
 */
export function getAppUrl(env: Env, req: Request): string {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

/** Extract the hostname portion of the app URL — this is what Strava calls the
 *  "Authorization Callback Domain" and is all we instruct the user to set. */
export function getCallbackDomain(env: Env, req: Request): string {
  return new URL(getAppUrl(env, req)).host;
}
