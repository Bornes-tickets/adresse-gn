import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

export interface AdminPointsMapViewProps {
  points: { lat: number; lng: number; visibility: string; number: string | null }[];
  center?: [number, number];
  zoom?: number;
}

const CONAKRY: [number, number] = [9.535, -13.6773];

export default function AdminPointsMapView({
  points,
  center = CONAKRY,
  zoom = 12,
}: AdminPointsMapViewProps) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
        maxZoom={19}
      />
      {points.map((p, i) => (
        <CircleMarker
          key={`${p.lat}-${p.lng}-${i}`}
          center={[p.lat, p.lng]}
          radius={5}
          pathOptions={{
            color: "#ffffff",
            weight: 1,
            fillOpacity: 0.9,
            fillColor: p.visibility === "public" ? "#2E4A7B" : "#94A3B8",
          }}
        >
          <Tooltip>{p.number ?? "Adresse"}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
