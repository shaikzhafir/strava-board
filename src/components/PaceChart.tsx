import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Activity } from "../lib/api";
import { formatDate, paceMinPerKmNumeric } from "../lib/format";

export default function PaceChart({ activities }: { activities: Activity[] }) {
  const data = activities
    .filter((a) => a.sport_type === "Run" && a.average_speed > 0)
    .slice(0, 20)
    .slice()
    .reverse()
    .map((a) => ({
      date: formatDate(a.start_date_local),
      pace: Number(paceMinPerKmNumeric(a.average_speed).toFixed(2)),
    }));
  if (data.length === 0) return null;
  return (
    <div className="chart">
      <h3>Running pace — min/km</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" fontSize={11} />
          <YAxis fontSize={11} reversed domain={["dataMin - 0.3", "dataMax + 0.3"]} />
          <Tooltip />
          <Line type="monotone" dataKey="pace" stroke="#FC4C02" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
