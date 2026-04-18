export interface Env {
  STRAVA_KV: KVNamespace;
  ASSETS: Fetcher;
  APP_URL: string;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface StravaAthlete {
  id: number;
  username: string | null;
  firstname: string;
  lastname: string;
  profile: string;
  profile_medium: string;
  city: string | null;
  country: string | null;
  sex: string | null;
}

export interface StravaActivity {
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

export interface StravaStats {
  recent_run_totals: Totals;
  recent_ride_totals: Totals;
  recent_swim_totals: Totals;
  ytd_run_totals: Totals;
  ytd_ride_totals: Totals;
  all_run_totals: Totals;
  all_ride_totals: Totals;
}

interface Totals {
  count: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
}
