import { useCallback, useEffect, useState } from "react";
import {
  api,
  type DailyActivityMap,
  type Me,
  type SetupStatus,
  type Stats,
} from "./lib/api";

function emptyDailyMap(syncedAt: string | null): DailyActivityMap {
  return { byDate: {}, years: [], syncedAt: syncedAt ?? new Date().toISOString() };
}
import { timeAgo } from "./lib/format";
import ActivityHeatmap from "./components/ActivityHeatmap";
import SummaryStats from "./components/SummaryStats";
import SetupWizard from "./components/SetupWizard";
import AdminAuth from "./components/AdminAuth";

interface State {
  setup: SetupStatus | null;
  me: Me | null;
  stats: Stats | null;
  daily: DailyActivityMap | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: State = {
  setup: null,
  me: null,
  stats: null,
  daily: null,
  loading: true,
  error: null,
};

export default function App() {
  const [state, setState] = useState<State>(INITIAL);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const setup = await api.setupStatus();
      if (!setup.configured || !setup.claimed) {
        setState({
          setup,
          me: null,
          stats: null,
          daily: null,
          loading: false,
          error: null,
        });
        return;
      }
      const [me, stats, daily] = await Promise.all([api.me(), api.stats(), api.dailyActivity()]);
      setState({ setup, me, stats, daily, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load",
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSync = async () => {
    setSyncing(true);
    const r = await api.sync();
    if (r.ok) {
      setTimeout(async () => {
        await load();
        setSyncing(false);
      }, 1500);
    } else {
      setSyncing(false);
    }
  };

  if (state.loading) return <div className="page"><p>Loading…</p></div>;

  if (state.setup && (!state.setup.configured || !state.setup.claimed)) {
    if (!state.setup.admin_authenticated) {
      return (
        <div className="page">
          <AdminAuth status={state.setup} onAuthenticated={load} />
        </div>
      );
    }
    if (!state.setup.configured) {
      return (
        <div className="page">
          <SetupWizard status={state.setup} onConfigured={load} />
        </div>
      );
    }
    return (
      <div className="page center">
        <h1>Strava Activity Board</h1>
        <p className="muted">
          Signed in as <strong>{state.setup.admin_username}</strong>. Authorize
          Strava to finish claiming this instance.
        </p>
        <a className="btn primary" href="/auth/strava/login">
          Connect with Strava
        </a>
      </div>
    );
  }

  const connected = !!state.me?.athlete;

  if (!connected) {
    return (
      <div className="page center">
        <h1>Strava Activity Board</h1>
        <p className="muted">
          Strava credentials are configured. Click below to authorize and claim this instance.
        </p>
        <a className="btn primary" href="/auth/strava/login">
          Connect with Strava
        </a>
      </div>
    );
  }

  const athlete = state.me!.athlete!;
  return (
    <div className="page">
      <header className="top">
        <div className="athlete">
          {athlete.profile_medium && (
            <img src={athlete.profile_medium} alt="" className="avatar" />
          )}
          <div>
            <h1>
              {athlete.firstname} {athlete.lastname}
            </h1>
            <p className="muted">
              Last synced {timeAgo(state.me!.lastSyncedAt)}
              {import.meta.env.DEV && (
                <button className="linklike" onClick={onSync} disabled={syncing}>
                  {syncing ? "syncing…" : "refresh"}
                </button>
              )}
            </p>
          </div>
        </div>
      </header>

      {state.error && <div className="error">{state.error}</div>}

      <section>
        <h2>Summary</h2>
        <SummaryStats stats={state.stats} />
      </section>

      <section>
        <ActivityHeatmap
          map={state.daily ?? emptyDailyMap(state.me?.lastSyncedAt ?? null)}
        />
      </section>
    </div>
  );
}
