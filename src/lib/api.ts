export interface Athlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  profile_medium: string;
  city: string | null;
  country: string | null;
}

export interface Activity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  map: { summary_polyline: string | null };
}

interface Totals {
  count: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
}

export interface Stats {
  recent_run_totals: Totals;
  recent_ride_totals: Totals;
  recent_swim_totals: Totals;
  ytd_run_totals: Totals;
  ytd_ride_totals: Totals;
  all_run_totals: Totals;
  all_ride_totals: Totals;
}

export interface Me {
  athlete: Athlete | null;
  lastSyncedAt: string | null;
}

export interface SetupStatus {
  configured: boolean;
  claimed: boolean;
  app_url: string;
  callback_domain: string;
  admin_registered: boolean;
  admin_authenticated: boolean;
  admin_username: string | null;
}

export interface AdminAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  username?: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function postAuth(
  path: string,
  body: Record<string, unknown>,
): Promise<AdminAuthResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    username?: string;
  };
  return {
    ok: res.ok && parsed.ok !== false,
    status: res.status,
    error: parsed.error,
    username: parsed.username,
  };
}

export const api = {
  me: () => getJson<Me>("/api/me"),
  activities: (limit?: number) =>
    getJson<Activity[]>(`/api/activities${limit ? `?limit=${limit}` : ""}`),
  stats: () => getJson<Stats | null>("/api/stats"),
  sync: async () => {
    const res = await fetch("/api/sync", { method: "POST" });
    return { ok: res.ok, status: res.status };
  },
  logout: async () => fetch("/auth/logout", { method: "POST" }),
  setupStatus: () => getJson<SetupStatus>("/api/setup"),
  adminRegister: (username: string, password: string) =>
    postAuth("/api/admin/register", { username, password }),
  adminLogin: (username: string, password: string) =>
    postAuth("/api/admin/login", { username, password }),
  adminLogout: async () => {
    await fetch("/api/admin/logout", { method: "POST" });
  },
  saveSetup: async (client_id: string, client_secret: string) => {
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id, client_secret }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && body.ok !== false, status: res.status, error: body.error };
  },
};
