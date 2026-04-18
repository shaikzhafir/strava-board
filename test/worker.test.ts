import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF, fetchMock } from "cloudflare:test";
import { setOwner, setTokens, KEY } from "../worker/kv";
import { sign } from "../worker/session";

const OWNER = 5555;

async function clearKV() {
  const list = await env.STRAVA_KV.list();
  await Promise.all(list.keys.map((k) => env.STRAVA_KV.delete(k.name)));
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

describe("worker HTTP router", () => {
  beforeEach(async () => {
    await clearKV();
  });

  it("GET /auth/strava/login 302s to strava.com with client_id+redirect", async () => {
    const res = await SELF.fetch("http://localhost/auth/strava/login", { redirect: "manual" });
    expect(res.status).toBe(302);
    const loc = res.headers.get("Location")!;
    expect(loc).toContain("https://www.strava.com/oauth/authorize");
    expect(loc).toContain("client_id=test-client-id");
    expect(loc).toContain("redirect_uri=");
    expect(loc).toContain("scope=read%2Cactivity%3Aread_all");
  });

  it("GET /api/me returns nulls before any sync", async () => {
    const res = await SELF.fetch("http://localhost/api/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { athlete: unknown; lastSyncedAt: unknown };
    expect(body.athlete).toBeNull();
    expect(body.lastSyncedAt).toBeNull();
  });

  it("GET /api/activities returns [] when no cache", async () => {
    const res = await SELF.fetch("http://localhost/api/activities");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /api/activities respects limit param", async () => {
    await env.STRAVA_KV.put(
      KEY.CACHE_ACTIVITIES,
      JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]),
    );
    const res = await SELF.fetch("http://localhost/api/activities?limit=2");
    expect(await res.json()).toHaveLength(2);
  });

  it("GET /api/stats returns null when no cache", async () => {
    const res = await SELF.fetch("http://localhost/api/stats");
    expect(await res.json()).toBeNull();
  });

  it("POST /api/sync without cookie returns 401", async () => {
    const res = await SELF.fetch("http://localhost/api/sync", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("POST /api/sync with a valid owner cookie returns 202", async () => {
    await setOwner(env, OWNER);
    await setTokens(env, OWNER, {
      access_token: "a",
      refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    // Stub outbound Strava calls from the fire-and-forget sync.
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: (p) => p.startsWith("/api/v3/"), method: "GET" })
      .reply(200, "{}")
      .persist();
    const sid = await sign(
      { athlete_id: OWNER, iat: Math.floor(Date.now() / 1000) },
      "test-session-secret-please-change",
    );
    const res = await SELF.fetch("http://localhost/api/sync", {
      method: "POST",
      headers: { Cookie: `sid=${sid}` },
    });
    expect(res.status).toBe(202);
  });

  it("POST /api/sync rejects a valid cookie for a non-owner athlete", async () => {
    await setOwner(env, OWNER);
    const sid = await sign(
      { athlete_id: 9999, iat: Math.floor(Date.now() / 1000) },
      "test-session-secret-please-change",
    );
    const res = await SELF.fetch("http://localhost/api/sync", {
      method: "POST",
      headers: { Cookie: `sid=${sid}` },
    });
    expect(res.status).toBe(401);
  });

  it("POST /auth/logout clears sid cookie", async () => {
    const res = await SELF.fetch("http://localhost/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/sid=;.*Max-Age=0/);
  });
});

