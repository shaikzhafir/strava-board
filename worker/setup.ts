import type { Env } from "./types";
import { getOwner } from "./kv";
import {
  getAppUrl,
  getCallbackDomain,
  getStravaAppConfig,
  setStravaAppConfig,
} from "./config";
import { requireOwner } from "./auth";

export interface SetupStatus {
  configured: boolean;
  claimed: boolean;
  app_url: string;
  callback_domain: string;
}

export async function getSetupStatus(req: Request, env: Env): Promise<SetupStatus> {
  const [cfg, owner] = await Promise.all([getStravaAppConfig(env), getOwner(env)]);
  return {
    configured: !!cfg,
    claimed: !!owner,
    app_url: getAppUrl(env, req),
    callback_domain: getCallbackDomain(env, req),
  };
}

function isPlausibleClientId(v: unknown): v is string {
  // Strava client IDs are short integers (5-7 digits today); accept any
  // 1-20 digit string to stay future-proof.
  return typeof v === "string" && /^\d{1,20}$/.test(v.trim());
}

function isPlausibleClientSecret(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= 20 && v.trim().length <= 200;
}

/**
 * Save Strava app credentials.
 *
 * Access control:
 *   - While the instance is un-claimed (no Strava owner has logged in yet),
 *     any visitor can POST. This is the "claim race" window — the legitimate
 *     operator should complete setup immediately after deploy.
 *   - Once an owner has claimed the instance, only the owner (valid session
 *     cookie) can update credentials (e.g. to rotate a rolled secret).
 */
export async function handleSetupSave(req: Request, env: Env): Promise<Response> {
  const owner = await getOwner(env);
  if (owner) {
    const authed = await requireOwner(req, env);
    if (!authed) {
      return jsonError("This instance is already claimed; sign in as the owner to update credentials.", 403);
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const b = body as { client_id?: unknown; client_secret?: unknown };
  const client_id = typeof b.client_id === "string" ? b.client_id.trim() : "";
  const client_secret = typeof b.client_secret === "string" ? b.client_secret.trim() : "";

  if (!isPlausibleClientId(client_id)) {
    return jsonError("client_id looks wrong — it should be the numeric Client ID shown on your Strava app page.", 400);
  }
  if (!isPlausibleClientSecret(client_secret)) {
    return jsonError("client_secret looks wrong — copy the full secret string from Strava (40 hex characters).", 400);
  }

  await setStravaAppConfig(env, { client_id, client_secret });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
