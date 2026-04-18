import type { Env, StravaAthlete, StravaActivity, StravaStats, StravaTokens } from "./types";

export const KEY = {
  OWNER: "owner:athlete_id",
  tokens: (id: number | string) => `tokens:${id}`,
  CACHE_ATHLETE: "cache:athlete",
  CACHE_ACTIVITIES: "cache:activities",
  CACHE_STATS: "cache:stats",
  LAST_SYNCED_AT: "cache:lastSyncedAt",
  LOCK_SYNC: "lock:sync",
  STRAVA_APP: "config:strava_app",
  SESSION_SECRET: "config:session_secret",
  ADMIN: "config:admin",
} as const;

export async function getOwner(env: Env): Promise<number | null> {
  const v = await env.STRAVA_KV.get(KEY.OWNER);
  return v ? Number(v) : null;
}

export async function setOwner(env: Env, id: number): Promise<void> {
  await env.STRAVA_KV.put(KEY.OWNER, String(id));
}

export async function getTokens(env: Env, id: number): Promise<StravaTokens | null> {
  return env.STRAVA_KV.get<StravaTokens>(KEY.tokens(id), "json");
}

export async function setTokens(env: Env, id: number, tokens: StravaTokens): Promise<void> {
  await env.STRAVA_KV.put(KEY.tokens(id), JSON.stringify(tokens));
}

export async function getCachedAthlete(env: Env): Promise<StravaAthlete | null> {
  return env.STRAVA_KV.get<StravaAthlete>(KEY.CACHE_ATHLETE, "json");
}

export async function getCachedActivities(env: Env): Promise<StravaActivity[] | null> {
  return env.STRAVA_KV.get<StravaActivity[]>(KEY.CACHE_ACTIVITIES, "json");
}

export async function getCachedStats(env: Env): Promise<StravaStats | null> {
  return env.STRAVA_KV.get<StravaStats>(KEY.CACHE_STATS, "json");
}

export async function getLastSyncedAt(env: Env): Promise<string | null> {
  return env.STRAVA_KV.get(KEY.LAST_SYNCED_AT);
}

export async function acquireSyncLock(env: Env): Promise<boolean> {
  const existing = await env.STRAVA_KV.get(KEY.LOCK_SYNC);
  if (existing) return false;
  await env.STRAVA_KV.put(KEY.LOCK_SYNC, "1", { expirationTtl: 60 });
  return true;
}

export async function releaseSyncLock(env: Env): Promise<void> {
  await env.STRAVA_KV.delete(KEY.LOCK_SYNC);
}
