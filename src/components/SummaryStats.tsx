import type { Stats } from "../lib/api";
import { metersToKm, secondsToDuration } from "../lib/format";

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function SummaryStats({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="muted">No stats yet.</div>;

  return (
    <div className="stat-grid">
      <Card
        label="Last 4 weeks · Runs"
        value={`${metersToKm(stats.recent_run_totals.distance)} km`}
        sub={`${stats.recent_run_totals.count} activities · ${secondsToDuration(stats.recent_run_totals.moving_time)}`}
      />
      <Card
        label="Last 4 weeks · Rides"
        value={`${metersToKm(stats.recent_ride_totals.distance)} km`}
        sub={`${stats.recent_ride_totals.count} activities · ${secondsToDuration(stats.recent_ride_totals.moving_time)}`}
      />
      <Card
        label="YTD · Runs"
        value={`${metersToKm(stats.ytd_run_totals.distance)} km`}
        sub={`${stats.ytd_run_totals.count} activities · ${secondsToDuration(stats.ytd_run_totals.moving_time)}`}
      />
      <Card
        label="YTD · Rides"
        value={`${metersToKm(stats.ytd_ride_totals.distance)} km`}
        sub={`${stats.ytd_ride_totals.count} activities · ${secondsToDuration(stats.ytd_ride_totals.moving_time)}`}
      />
    </div>
  );
}
