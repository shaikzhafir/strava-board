import type { Env } from "./types";
import { loginRedirect, handleCallback, handleLogout, requireOwner } from "./auth";
import {
  getCachedAthlete,
  getCachedActivities,
  getCachedStats,
  getLastSyncedAt,
} from "./kv";
import { runSync } from "./sync";
import { getSetupStatus, handleSetupSave } from "./setup";

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // --- Setup (first-run onboarding) ---
    if (pathname === "/api/setup" && method === "GET") {
      return json(await getSetupStatus(req, env));
    }
    if (pathname === "/api/setup" && method === "POST") {
      return handleSetupSave(req, env);
    }

    // --- Auth routes ---
    if (pathname === "/auth/strava/login" && method === "GET") {
      return loginRedirect(req, env);
    }
    if (pathname === "/auth/strava/callback" && method === "GET") {
      return handleCallback(req, env, ctx);
    }
    if (pathname === "/auth/logout" && method === "POST") {
      return handleLogout();
    }

    // --- API routes (publicly readable, single-user model) ---
    if (pathname === "/api/me" && method === "GET") {
      const [athlete, lastSyncedAt] = await Promise.all([
        getCachedAthlete(env),
        getLastSyncedAt(env),
      ]);
      return json({ athlete, lastSyncedAt });
    }

    if (pathname === "/api/activities" && method === "GET") {
      const activities = (await getCachedActivities(env)) ?? [];
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam) || 0)) : undefined;
      return json(limit ? activities.slice(0, limit) : activities);
    }

    if (pathname === "/api/stats" && method === "GET") {
      return json((await getCachedStats(env)) ?? null);
    }

    if (pathname === "/api/sync" && method === "POST") {
      const owner = await requireOwner(req, env);
      if (!owner) return json({ error: "unauthorized" }, { status: 401 });
      ctx.waitUntil(runSync(env).catch(() => {}));
      return json({ ok: true, queued: true }, { status: 202 });
    }

    // --- Static assets (SPA) ---
    return env.ASSETS.fetch(req);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runSync(env).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
