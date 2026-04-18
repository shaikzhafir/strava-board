import type { Activity } from "../lib/api";
import { formatDate, metersToKm, paceMinPerKm, secondsToDuration } from "../lib/format";
import ActivityMap from "./ActivityMap";

export default function ActivityList({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <div className="muted">No activities synced yet.</div>;
  }
  return (
    <div className="activity-grid">
      {activities.map((a) => (
        <article key={a.id} className="activity-card">
          <header>
            <div className="activity-title">{a.name}</div>
            <div className="activity-meta">
              <span className="pill">{a.sport_type}</span>
              <span>{formatDate(a.start_date_local)}</span>
            </div>
          </header>
          <ActivityMap polyline={a.map.summary_polyline} />
          <dl className="activity-stats">
            <div>
              <dt>Distance</dt>
              <dd>{metersToKm(a.distance)} km</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{secondsToDuration(a.moving_time)}</dd>
            </div>
            <div>
              <dt>Pace</dt>
              <dd>{paceMinPerKm(a.average_speed)}</dd>
            </div>
            <div>
              <dt>Elev</dt>
              <dd>{Math.round(a.total_elevation_gain)} m</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
