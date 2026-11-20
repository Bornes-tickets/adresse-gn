"use client";

import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { divIcon, type LatLngBoundsExpression } from "leaflet";

export type ViagoPoint = { lat: number; lng: number };

type Props = {
  start: ViagoPoint | null;
  end: ViagoPoint | null;
  route: ViagoPoint[] | null;
  onSelect: (point: ViagoPoint) => void;
  userPosition?: ViagoPoint | null;
  vehicleHeading?: number | null;
  followUser?: boolean;
  gpsFixValid?: boolean;
  navigationActive?: boolean;
  sheetOpen: boolean;
  fitRequest: number;
  viewMode: "overview" | "detail";
  detailRequest: number;
};

function ClickLocation({ onSelect, navigationActive, followUser }: Pick<Props, "onSelect" | "navigationActive" | "followUser">) {
  useMapEvents({ click: (event) => {
    if (navigationActive) return;
    onSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
  } });
  return null;
}

function CameraController({
  route, start, end, sheetOpen, fitRequest, viewMode, detailRequest,
  userPosition, vehicleHeading, followUser, gpsFixValid, navigationActive,
}: Pick<Props, "route" | "start" | "end" | "sheetOpen" | "fitRequest" | "viewMode" | "detailRequest" | "userPosition" | "vehicleHeading" | "followUser" | "gpsFixValid" | "navigationActive">) {
  const map = useMap();
  const latest = useRef({ route, start, end, sheetOpen, viewMode, userPosition, followUser, gpsFixValid, navigationActive });
  latest.current = { route, start, end, sheetOpen, viewMode, userPosition, followUser, gpsFixValid, navigationActive };
  const previousFit = useRef(fitRequest);
  const previousDetail = useRef(detailRequest);
  const hasFollowed = useRef(false);
  const previousFollowTarget = useRef<{ lat: number; lng: number } | null>(null);

  // A single camera owner. GPS degradation freezes the last camera, rather
  // than zooming back out to the entire itinerary.
  // Rotated follow mode uses HUD buttons for map exploration; Leaflet's
  // pointer mapping does not account for a CSS rotation of its container.
  useEffect(() => {
    const rotatedFollow = Boolean(navigationActive && followUser);
    if (rotatedFollow) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
    }
    return () => {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
    };
  }, [map, navigationActive, followUser]);

  useEffect(() => {
    if (!navigationActive || !followUser) {
      hasFollowed.current = false;
      previousFollowTarget.current = null;
      map.stop();
    }
  }, [map, navigationActive, followUser]);

  useEffect(() => {
    if (!navigationActive || !followUser || !gpsFixValid || !userPosition) return;
    if (!Number.isFinite(userPosition.lat) || !Number.isFinite(userPosition.lng)) return;

    // The visual map shell rotates -bearing. Shift the map center ahead
    // of the vehicle in world coordinates so the vehicle appears below
    // center after rotation, leaving more screen space in front.
    // No synthetic bearing, location or route progress.
    const zoom = hasFollowed.current ? Math.max(16, map.getZoom()) : 17;
    const size = map.getSize();
    const bearingValid = typeof vehicleHeading === "number" &&
      Number.isFinite(vehicleHeading) && vehicleHeading >= 0 && vehicleHeading < 360;
    const aheadPx = bearingValid && size.y > 320 ? Math.min(95, size.y * 0.13) : 0;
    const radians = bearingValid ? vehicleHeading * Math.PI / 180 : 0;
    const projected = map.project([userPosition.lat, userPosition.lng], zoom);
    // Screen x: east is positive; screen y: south is positive.
    const target = map.unproject([
      projected.x + Math.sin(radians) * aheadPx / 1.45,
      projected.y - Math.cos(radians) * aheadPx / 1.45,
    ], zoom);
    const destination = { lat: target.lat, lng: target.lng };
    const previous = previousFollowTarget.current;
    const movedM = previous ? map.distance(previous, destination) : Infinity;

    if (!hasFollowed.current || map.getZoom() < 16) {
      map.stop();
      map.setView([destination.lat, destination.lng], zoom, { animate: false });
    } else if (movedM >= 9) {
      // One bounded animated movement per meaningful change, not per render.
      map.stop();
      map.panTo([destination.lat, destination.lng], {
        animate: true, duration: 0.55, easeLinearity: 0.4,
      });
    } else {
      return;
    }
    previousFollowTarget.current = destination;
    hasFollowed.current = true;
  }, [map, navigationActive, followUser, gpsFixValid, userPosition, vehicleHeading]);

  // Manual overview button remains available in navigation mode.
  // Resize is never allowed to alter driving zoom.
  useEffect(() => {
    const requested = fitRequest !== previousFit.current;
    previousFit.current = fitRequest;
    if (navigationActive && (!requested || followUser)) return;
    if (viewMode !== "overview") return;
    const points = route?.length ? route : [start, end].filter((p): p is ViagoPoint => Boolean(p));
    if (!points.length) return;
    const apply = () => {
      map.invalidateSize({ pan: false });
      const { navigationActive: active, followUser: following, sheetOpen: open } = latest.current;
      if (active && following) return;
      if (!active && open && map.getSize().x < 768) return;
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 16, { animate: false });
      } else {
        const bounds: LatLngBoundsExpression = points.map(p => [p.lat, p.lng]);
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 17, animate: false });
      }
    };
    const frame = window.requestAnimationFrame(apply);
    return () => window.cancelAnimationFrame(frame);
  }, [map, route, start, end, sheetOpen, fitRequest, viewMode, followUser, navigationActive]);

  useEffect(() => {
    const requested = detailRequest !== previousDetail.current;
    previousDetail.current = detailRequest;
    if (!requested || navigationActive || viewMode !== "detail") return;
    const point = userPosition ?? start;
    if (point) map.setView([point.lat, point.lng], 16, { animate: false });
  }, [map, detailRequest, navigationActive, viewMode, userPosition, start]);
  return null;
}

/** Heading is displayed only when GPS movement supplied a reliable direction. */
function VehicleMarker({ position, heading }: { position: ViagoPoint; heading?: number | null }) {
  const icon = useMemo(() => {
    const valid = typeof heading === "number" && Number.isFinite(heading) && heading >= 0 && heading < 360;
    const html = valid
      ? `<div style="width:38px;height:38px;display:grid;place-items:center;filter:drop-shadow(0 2px 4px #10283f66)"><div style="transform:rotate(${heading!.toFixed(1)}deg);background:#fff;border:2px solid #1972e8;border-radius:50%;width:35px;height:35px;display:grid;place-items:center"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 21 12 17 3 21Z" fill="#1677f2" stroke="#fff" stroke-width="1"/></svg></div></div>`
      : `<div style="width:24px;height:24px;border:3px solid white;background:#1972e8;border-radius:50%;box-shadow:0 1px 6px #132b4a88"></div>`;
    return divIcon({ className: "viago-vehicle-indicator", html, iconSize: valid ? [38, 38] : [24, 24], iconAnchor: valid ? [19, 19] : [12, 12] });
  }, [heading]);
  return <Marker position={[position.lat, position.lng]} icon={icon} interactive={false} zIndexOffset={1000} />;
}

export default function ViagoMap({ start, end, route, onSelect, userPosition, vehicleHeading, followUser, gpsFixValid, navigationActive, sheetOpen, fitRequest, viewMode, detailRequest }: Props) {
  const rotationEnabled = Boolean(navigationActive && followUser &&
    typeof vehicleHeading === "number" && Number.isFinite(vehicleHeading) &&
    vehicleHeading >= 0 && vehicleHeading < 360);
  // Keep a fixed overscan ratio: a rotated square must cover its viewport
  // even at 45 degrees. This is a visual shell, not a modified GPS fix.
  const rotationDegrees = rotationEnabled ? -vehicleHeading! : 0;
  return (
    <div className="absolute inset-0 overflow-hidden" data-viago-camera={rotationEnabled ? "heading-up" : "north-up"}>
    <div style={{ position: "absolute", inset: 0,
      transform: rotationEnabled ? `scale(1.45) rotate(${rotationDegrees}deg)` : "none",
      transformOrigin: "center center", transition: "transform 380ms linear",
      willChange: rotationEnabled ? "transform" : "auto",
    }}>
    <MapContainer center={[9.6412, -13.5784]} zoom={12} className="h-full w-full" scrollWheelZoom zoomControl={false}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors" maxZoom={19} />
      <ClickLocation onSelect={onSelect} navigationActive={navigationActive} followUser={followUser} />
      {start && <CircleMarker center={[start.lat, start.lng]} radius={9}
        pathOptions={{ color: "#047857", fillColor: "#10b981", fillOpacity: 1 }} />}
      {end && <CircleMarker center={[end.lat, end.lng]} radius={9}
        pathOptions={{ color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1 }} />}
      {route && route.length >= 2 &&
        <>
          <Polyline positions={route.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#ffffff", weight: 13, opacity: 0.98, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={route.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#087cf4", weight: 8, opacity: 1, lineCap: "round", lineJoin: "round" }} />
        </>}
      {userPosition && <VehicleMarker position={userPosition} heading={vehicleHeading} />}
      <CameraController route={route} start={start} end={end} sheetOpen={sheetOpen}
        fitRequest={fitRequest} viewMode={viewMode} detailRequest={detailRequest}
        userPosition={userPosition} vehicleHeading={vehicleHeading} followUser={followUser}
        gpsFixValid={gpsFixValid} navigationActive={navigationActive} />
    </MapContainer>
    </div>
    </div>
  );
}
