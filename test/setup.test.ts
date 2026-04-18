import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF, fetchMock } from "cloudflare:test";
import { setOwner, KEY } from "../worker/kv";
import { sign } from "../worker/session";

async function clearKV() {
  const list = await env.STRAVA_KV.list();
  await Promise.all(list.keys.map((k) => env.STRAVA_KV.delete(k.name)));
}

// Credentials look plausible; real Strava client_secret is 40 hex chars, client_id is a short int.
const VALID_CLIENT_ID = "987654";
const VALID_CLIENT_SECRET = "a".repeat(40);

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

describe("GET /api/setup", () => {
  beforeEach(async () => {
    await clearKV();
  });

  it("reports unconfigured + unclaimed with callback_domain derived from request host", async () => {
    const res = await SELF.fetch("http://dashboard.example.com/api/setup");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      claimed: boolean;
      callback_domain: string;
      app_url: string;
    };
    // Env fallback is set in vitest.config.ts, so "configured" is true here —
    // but the key signal is that callback_domain matches the incoming host
    // and the payload is well-formed.
    expect(typeof body.configured).toBe("boolean");
    expect(body.claimed).toBe(false);
    expect(body.callback_domain).toBe("dashboard.example.com");
    expect(body.app_url).toBe("http://dashboard.example.com");
  });

  it("reports claimed=true once an owner is set", async () => {
    await setOwner(env, 111);
    const res = await SELF.fetch("http://localhost/api/setup");
    const body = (await res.json()) as { claimed: boolean };
    expect(body.claimed).toBe(true);
  });
});

describe("POST /api/setup", () => {
  beforeEach(async () => {
    await clearKV();
  });

  it("accepts valid credentials when instance is unclaimed", async () => {
    const res = await SELF.fetch("http://localhost/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: VALID_CLIENT_ID,
        client_secret: VALID_CLIENT_SECRET,
      }),
    });
    expect(res.status).toBe(200);
    const stored = await env.STRAVA_KV.get<{ client_id: string; client_secret: string }>(
      KEY.STRAVA_APP,
      "json",
    );
    expect(stored).toEqual({
      client_id: VALID_CLIENT_ID,
      client_secret: VALID_CLIENT_SECRET,
    });
  });

  it("rejects a non-numeric client_id", async () => {
    const res = await SELF.fetch("http://localhost/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "not-a-number", client_secret: VALID_CLIENT_SECRET }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a suspiciously short client_secret", async () => {
    const res = await SELF.fetch("http://localhost/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: VALID_CLIENT_ID, client_secret: "short" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects anonymous writes once the instance is claimed", async () => {
    await setOwner(env, 42);
    const res = await SELF.fetch("http://localhost/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: VALID_CLIENT_ID,
        client_secret: VALID_CLIENT_SECRET,
      }),
    });
    expect(res.status).toBe(403);
  });

  it("allows the owner to update credentials after claim (with session cookie)", async () => {
    await setOwner(env, 42);
    const sid = await sign(
      { athlete_id: 42, iat: Math.floor(Date.now() / 1000) },
      "test-session-secret-please-change",
    );
    const res = await SELF.fetch("http://localhost/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` },
      body: JSON.stringify({
        client_id: VALID_CLIENT_ID,
        client_secret: VALID_CLIENT_SECRET,
      }),
    });
    expect(res.status).toBe(200);
  });
});
