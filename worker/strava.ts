import type { Env, StravaAppConfig, StravaTokens } from "./types";
import { getTokens, setTokens } from "./kv";
import { getStravaAppConfig } from "./config";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

export interface OAuthTokenResponse extends StravaTokens {
  athlete?: { id: number };
}

async function requireAppConfig(env: Env): Promise<StravaAppConfig> {
  const cfg = await getStravaAppConfig(env);
  if (!cfg) throw new Error("Strava app is not configured — run setup first.");
  return cfg;
}

export async function exchangeCode(env: Env, code: string): Promise<OAuthTokenResponse> {
  const { client_id, client_secret } = await requireAppConfig(env);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id,
      client_secret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refreshTokens(env: Env, refreshToken: string): Promise<StravaTokens> {
  const { client_id, client_secret } = await requireAppConfig(env);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id,
      client_secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as StravaTokens;
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at };
}

export async function getAccessToken(env: Env, athleteId: number): Promise<string> {
  const tokens = await getTokens(env, athleteId);
  if (!tokens) throw new Error("No tokens stored for athlete");
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at - now > 60) return tokens.access_token;
  const fresh = await refreshTokens(env, tokens.refresh_token);
  await setTokens(env, athleteId, fresh);
  return fresh.access_token;
}

export async function stravaFetch<T = unknown>(
  env: Env,
  athleteId: number,
  path: string,
): Promise<T> {
  const access = await getAccessToken(env, athleteId);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) throw new Error(`Strava API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}
