import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Activity } from "../lib/api";
import { formatDate } from "../lib/format";

export default function DistanceChart({ activities }: { activities: Activity[] }) {
  const data = activities
    .slice(0, 20)
    .slice()
    .reverse()
    .map((a) => ({
      date: formatDate(a.start_date_local),
      km: Number((a.distance / 1000).toFixed(2)),
      name: a.name,
    }));
  if (data.length === 0) return null;
  return (
    <div className="chart">
      <h3>Distance — last {data.length} activities</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" fontSize={11} />
          <YAxis unit=" km" fontSize={11} />
          <Tooltip />
          <Bar dataKey="km" fill="#FC4C02" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
