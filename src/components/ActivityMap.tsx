import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { decodePolyline } from "../lib/polyline";

export default function ActivityMap({ polyline }: { polyline: string | null }) {
  if (!polyline) return <div className="map-empty">No route</div>;
  const coords = decodePolyline(polyline);
  if (coords.length === 0) return <div className="map-empty">No route</div>;

  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const bounds: LatLngBoundsExpression = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [6, 6] }}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      doubleClickZoom={false}
      touchZoom={false}
      attributionControl={false}
      className="mini-map"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <Polyline positions={coords} pathOptions={{ color: "#FC4C02", weight: 3 }} />
    </MapContainer>
  );
}
