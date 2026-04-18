import { useCallback, useEffect, useState } from "react";
import { api, type Activity, type Me, type SetupStatus, type Stats } from "./lib/api";
import { timeAgo } from "./lib/format";
import ActivityList from "./components/ActivityList";
import SummaryStats from "./components/SummaryStats";
import DistanceChart from "./components/DistanceChart";
import PaceChart from "./components/PaceChart";
import SetupWizard from "./components/SetupWizard";

interface State {
  setup: SetupStatus | null;
  me: Me | null;
  activities: Activity[];
  stats: Stats | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: State = {
  setup: null,
  me: null,
  activities: [],
  stats: null,
  loading: true,
  error: null,
};

export default function App() {
  const [state, setState] = useState<State>(INITIAL);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const setup = await api.setupStatus();
      // If Strava creds aren't configured yet, skip the data fetch — the board
      // is always empty in that state and the wizard takes over the UI.
      if (!setup.configured) {
        setState({
          setup,
          me: null,
          activities: [],
          stats: null,
          loading: false,
          error: null,
        });
        return;
      }
      const [me, activities, stats] = await Promise.all([
        api.me(),
        api.activities(),
        api.stats(),
      ]);
      setState({ setup, me, activities, stats, loading: false, error: null });
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

  if (state.setup && !state.setup.configured) {
    return (
      <div className="page">
        <SetupWizard status={state.setup} onConfigured={load} />
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
              <button className="linklike" onClick={onSync} disabled={syncing}>
                {syncing ? "syncing…" : "refresh"}
              </button>
            </p>
          </div>
        </div>
      </header>

      {state.error && <div className="error">{state.error}</div>}

      <section>
        <h2>Summary</h2>
        <SummaryStats stats={state.stats} />
      </section>

      {state.activities.length > 0 && (
        <section className="charts">
          <DistanceChart activities={state.activities} />
          <PaceChart activities={state.activities} />
        </section>
      )}

      <section>
        <h2>Recent activities</h2>
        <ActivityList activities={state.activities} />
      </section>
    </div>
  );
}
