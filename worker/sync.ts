import type { Env, StravaAthlete, StravaActivity, StravaStats } from "./types";
import { stravaFetch } from "./strava";
import {
  KEY,
  acquireSyncLock,
  releaseSyncLock,
  getOwner,
  getTokens,
} from "./kv";

const ACTIVITY_LIMIT = 50;

function trimActivity(a: StravaActivity): StravaActivity {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    sport_type: a.sport_type,
    start_date: a.start_date,
    start_date_local: a.start_date_local,
    distance: a.distance,
    moving_time: a.moving_time,
    elapsed_time: a.elapsed_time,
    total_elevation_gain: a.total_elevation_gain,
    average_speed: a.average_speed,
    max_speed: a.max_speed,
    average_heartrate: a.average_heartrate,
    max_heartrate: a.max_heartrate,
    map: { summary_polyline: a.map?.summary_polyline ?? null },
  };
}

export type SyncResult =
  | { ok: true; activities: number; syncedAt: string }
  | { ok: false; reason: "no_owner" | "no_tokens" | "locked" | "error"; message?: string };

export async function runSync(env: Env): Promise<SyncResult> {
  const owner = await getOwner(env);
  if (!owner) return { ok: false, reason: "no_owner" };
  const tokens = await getTokens(env, owner);
  if (!tokens) return { ok: false, reason: "no_tokens" };

  const gotLock = await acquireSyncLock(env);
  if (!gotLock) return { ok: false, reason: "locked" };

  try {
    const athlete = await stravaFetch<StravaAthlete>(env, owner, "/athlete");
    const activitiesRaw = await stravaFetch<StravaActivity[]>(
      env,
      owner,
      `/athlete/activities?per_page=${ACTIVITY_LIMIT}&page=1`,
    );
    const stats = await stravaFetch<StravaStats>(env, owner, `/athletes/${owner}/stats`);
    const activities = activitiesRaw.map(trimActivity);

    await Promise.all([
      env.STRAVA_KV.put(KEY.CACHE_ATHLETE, JSON.stringify(athlete)),
      env.STRAVA_KV.put(KEY.CACHE_ACTIVITIES, JSON.stringify(activities)),
      env.STRAVA_KV.put(KEY.CACHE_STATS, JSON.stringify(stats)),
    ]);
    const syncedAt = new Date().toISOString();
    await env.STRAVA_KV.put(KEY.LAST_SYNCED_AT, syncedAt);
    return { ok: true, activities: activities.length, syncedAt };
  } catch (err) {
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : String(err) };
  } finally {
    await releaseSyncLock(env);
  }
}
