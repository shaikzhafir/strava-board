import type { Env } from "./types";
import { exchangeCode } from "./strava";
import { getOwner, setOwner, setTokens } from "./kv";
import { sign, sessionCookie, clearSessionCookie, parseCookie, verify } from "./session";
import { runSync } from "./sync";
import { getAppUrl, getSessionSecret, getStravaAppConfig } from "./config";

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const SCOPES = "read,activity:read_all";

export async function loginRedirect(req: Request, env: Env): Promise<Response> {
  const cfg = await getStravaAppConfig(env);
  if (!cfg) {
    return new Response(
      "Strava app is not configured yet. Open the home page and complete the setup wizard first.",
      { status: 409 },
    );
  }
  const appUrl = getAppUrl(env, req);
  const params = new URLSearchParams({
    client_id: cfg.client_id,
    redirect_uri: `${appUrl}/auth/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPES,
  });
  return Response.redirect(`${AUTHORIZE_URL}?${params.toString()}`, 302);
}

export async function handleCallback(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return new Response(`Strava auth error: ${error}`, { status: 400 });
  if (!code) return new Response("Missing code", { status: 400 });

  const tokenResp = await exchangeCode(env, code);
  const athleteId = tokenResp.athlete?.id;
  if (!athleteId) return new Response("Strava response missing athlete id", { status: 500 });

  const currentOwner = await getOwner(env);
  if (currentOwner && currentOwner !== athleteId) {
    return new Response(
      "This instance already belongs to another athlete. Only the owner can log in.",
      { status: 403 },
    );
  }
  if (!currentOwner) await setOwner(env, athleteId);

  await setTokens(env, athleteId, {
    access_token: tokenResp.access_token,
    refresh_token: tokenResp.refresh_token,
    expires_at: tokenResp.expires_at,
  });

  const secret = await getSessionSecret(env);
  const sid = await sign(
    { athlete_id: athleteId, iat: Math.floor(Date.now() / 1000) },
    secret,
  );

  // Fire-and-forget initial sync so the board is populated immediately.
  ctx.waitUntil(runSync(env).catch(() => {}));

  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", sessionCookie(sid));
  return new Response(null, { status: 302, headers });
}

export function handleLogout(): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", clearSessionCookie());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function requireOwner(req: Request, env: Env): Promise<number | null> {
  const sid = parseCookie(req.headers.get("Cookie"), "sid");
  if (!sid) return null;
  const secret = await getSessionSecret(env);
  const payload = await verify(sid, secret);
  if (!payload) return null;
  const owner = await getOwner(env);
  if (!owner || owner !== payload.athlete_id) return null;
  return owner;
}
