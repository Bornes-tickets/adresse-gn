"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ViagoPoint } from "./viago-map";
import { ALERT_ORDER, renderAlertIcon } from "./viago-alerts";
import { renderEndPin, renderMarkerIcon, renderRouteChevron, type ViagoMarkerKind } from "./viago-vehicle-icons";

type Props = {
  start: ViagoPoint | null;
  end: ViagoPoint | null;
  route: ViagoPoint[] | null;
  surfaceLines?: GeoJSON.FeatureCollection;
  altLines?: GeoJSON.FeatureCollection;
  stopPoints?: ViagoPoint[];
  alertFeatures?: GeoJSON.FeatureCollection;
  onSelectAlert?: (id: string) => void;
  onSelectAlt?: (index: number) => void;
  onSelect: (point: ViagoPoint) => void;
  userPosition?: ViagoPoint | null;
  pedestrianMode?: boolean;
  profile?: "car" | "motorcycle" | "foot";
  pedestrianPosition?: ViagoPoint | null;
  pedestrianAccuracyM?: number | null;
  vehicleHeading?: number | null;
  followUser?: boolean;
  recenterRequest?: number;
  onUserPan?: () => void;
  gpsFixValid?: boolean;
  visualGpsUsable?: boolean;
  navigationActive?: boolean;
  motionPhase?: "uncertain" | "stationary" | "moving";
  sheetOpen: boolean;
  fitRequest: number;
  viewMode: "overview" | "detail";
  detailRequest: number;
};

// Fond de carte : tuiles Guinée hébergées par Viago (PMTiles) quand
// NEXT_PUBLIC_VIAGO_BASEMAP=local, sinon style public OpenFreeMap (repli).
// Le style local est servi par /viago-map/style et lit /viago-tiles/guinea.
const LOCAL_BASEMAP = process.env.NEXT_PUBLIC_VIAGO_BASEMAP === "local";
const BASE_STYLE = LOCAL_BASEMAP ? "/viago-map/style" : "https://tiles.openfreemap.org/styles/liberty";
let pmtilesRegistered = false;
function registerPmtilesProtocol(): void {
  if (!LOCAL_BASEMAP || pmtilesRegistered) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  pmtilesRegistered = true;
}

function pointFeature(point: ViagoPoint | null, name: string): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: point ? [{
    type: "Feature", properties: { name },
    geometry: { type: "Point", coordinates: [point.lng, point.lat] },
  }] : [] };
}
// VISUAL-ONLY location uncertainty: this does not change the validated route.
function pedestrianAccuracyPolygon(point: ViagoPoint | null, meters: number | null | undefined): GeoJSON.FeatureCollection {
  if (!point || typeof meters !== "number" || !Number.isFinite(meters) || meters < 0 || meters > 100) {
    return { type: "FeatureCollection", features: [] };
  }
  const vertices: number[][] = [];
  const lonFactor = Math.max(0.01, Math.cos(point.lat * Math.PI / 180));
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    vertices.push([point.lng + meters * Math.cos(angle) / (111195 * lonFactor),
      point.lat + meters * Math.sin(angle) / 111195]);
  }
  return { type: "FeatureCollection", features: [{
    type: "Feature", properties: { estimated: true },
    geometry: { type: "Polygon", coordinates: [vertices] },
  }] };
}
function visualDistanceM(a: ViagoPoint, b: ViagoPoint): number {
  const dx = (b.lng-a.lng) * 111195 * Math.cos((a.lat+b.lat) * Math.PI/360);
  const dy = (b.lat-a.lat) * 111195;
  return Math.hypot(dx, dy);
}

function lineFeature(points: ViagoPoint[] | null): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: points && points.length >= 2 ? [{
    type: "Feature", properties: {}, geometry: {
      type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]),
    },
  }] : [] };
}
const SNAP_DISPLAY_M = 25;   // affichage seulement : colle le marqueur a la route s'il en est proche
const CONNECTOR_MIN_M = 8;   // au-dela, un pointille relie le marqueur a la route

function nearestPointOnRoute(route: ViagoPoint[], p: ViagoPoint): { point: ViagoPoint; distanceM: number } | null {
  if (route.length < 2) return null;
  const mx = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const my = 110574;
  let best: { point: ViagoPoint; distanceM: number } | null = null;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const ax = (a.lng - p.lng) * mx, ay = (a.lat - p.lat) * my;
    const bx = (b.lng - p.lng) * mx, by = (b.lat - p.lat) * my;
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / len2)) : 0;
    const cx = ax + t * vx, cy = ay + t * vy;
    const d = Math.hypot(cx, cy);
    if (!best || d < best.distanceM) best = { point: { lat: p.lat + cy / my, lng: p.lng + cx / mx }, distanceM: d };
  }
  return best;
}

function bearingValid(degrees: number | null | undefined): degrees is number {
  return typeof degrees === "number" && Number.isFinite(degrees) && degrees >= 0 && degrees < 360;
}
// Route direction is a VISUAL fallback only when GPS heading is unavailable.
// It must never change GPS speed, movement state, or turn progression.
function routeVisualBearing(route: ViagoPoint[] | null, at: ViagoPoint | null): number | null {
  if (!route || route.length < 2 || !at) return null;
  const rad = Math.PI / 180;
  const xscale = Math.cos(at.lat * rad);
  let best = Number.POSITIVE_INFINITY;
  let bearing: number | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const dx = (b.lng - a.lng) * xscale;
    const dy = b.lat - a.lat;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-15) continue;
    const px = (at.lng - a.lng) * xscale;
    const py = at.lat - a.lat;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
    const dist2 = (px - t * dx) ** 2 + (py - t * dy) ** 2;
    if (dist2 < best) {
      best = dist2;
      bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    }
  }
  return bearing;
}

// Cap "vers l'avant" : direction de la route sur ~50 m devant la position (vue GPS : la route monte vers le haut).
// Purement visuel : ne change ni la vitesse, ni la progression, ni les annonces.
function routeLookAheadBearing(route: ViagoPoint[] | null, at: ViagoPoint | null, aheadM = 50): number | null {
  if (!route || route.length < 2 || !at) return null;
  const mx = 111320 * Math.cos((at.lat * Math.PI) / 180);
  const my = 110574;
  let bi = -1, bt = 0, bd = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const ax = (a.lng - at.lng) * mx, ay = (a.lat - at.lat) * my;
    const vx = (b.lng - a.lng) * mx, vy = (b.lat - a.lat) * my;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-6) continue;
    const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / len2));
    const d = Math.hypot(ax + t * vx, ay + t * vy);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  if (bi < 0) return null;
  const a = route[bi], b = route[bi + 1];
  const sx = a.lng + (b.lng - a.lng) * bt, sy = a.lat + (b.lat - a.lat) * bt;
  let cx = sx, cy = sy, remaining = aheadM;
  for (let j = bi + 1; j < route.length && remaining > 0; j++) {
    const nx = route[j].lng, ny = route[j].lat;
    const seg = Math.hypot((nx - cx) * mx, (ny - cy) * my);
    if (seg >= remaining && seg > 0) {
      const f = remaining / seg;
      cx += (nx - cx) * f; cy += (ny - cy) * f; remaining = 0;
      break;
    }
    remaining -= seg; cx = nx; cy = ny;
  }
  const dx = (cx - sx) * mx, dy = (cy - sy) * my;
  if (Math.hypot(dx, dy) < 3) return routeVisualBearing(route, at);
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}

/**
 * VIAGO P4-P3-P1: visual styling only.
 * Applied to the existing vector layers before VIAGO route overlays.
 * Never modifies route geometry, GPS readings, guidance or movement.
 */
function applyViagoNavigationPalette(map: MapLibreMap): void {
  const layers = map.getStyle().layers ?? [];

  for (const layer of layers) {
    const id = layer.id.toLowerCase();

    // Keep the map flat: no extruded building geometry.
    if (layer.type === "fill-extrusion") {
      map.setLayoutProperty(layer.id, "visibility", "none");
      continue;
    }

    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", "#f7f8fa");
      continue;
    }

    // VIAGO P7-P3: keep vector road outlines, labels and lane hierarchy.
    // This changes only paint on known road line layers, never route geometry.
    if (layer.type === "line" &&
        /road|highway|transportation|motorway|trunk|primary|secondary|tertiary|residential|street/.test(id) &&
        !/bridge_casing|tunnel_casing|outline|border|dash|rail|path|track|ferry/.test(id)) {
      const majorRoad = /motorway|trunk|primary/.test(id);
      const collectorRoad = /secondary|tertiary/.test(id);
      map.setPaintProperty(layer.id, "line-color", majorRoad ? "#f6c77d" : collectorRoad ? "#ffedbd" : "#ffffff");
      continue;
    }

    if (layer.type !== "fill") continue;

    if (/water|ocean|sea/.test(id)) {
      map.setPaintProperty(layer.id, "fill-color", "#bddfeb");
    } else if (/building/.test(id)) {
      map.setPaintProperty(layer.id, "fill-color", "#dbe1e7");
      map.setPaintProperty(layer.id, "fill-opacity", 0.58);
    } else if (/park|grass|forest|wood|vegetation|garden|recreation|nature|green/.test(id)) {
      map.setPaintProperty(layer.id, "fill-color", "#b9dfa9");
    }
  }

  // Preserve Liberty's existing road hierarchy and labels.
  // This function never changes route geometry or GPS data.
}
export default function ViagoMapLibre(props: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const lastFitRef = useRef(props.fitRequest);
  const lastDetailRef = useRef(props.detailRequest);
  const followedRef = useRef(false);
  const lastRecenterRef = useRef(props.recenterRequest ?? 0);
  const lastReliableBearingRef = useRef<number | null>(null);
  const everConfirmedRef = useRef(false);
  const heldVehicleRef = useRef<ViagoPoint | null>(null);
  const lastFootCamera = useRef<{ point: ViagoPoint; at: number } | null>(null);
  const lastApproxCamera = useRef<{ point: ViagoPoint; at: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    // MapLibre v6 ESM worker; serve worker + shared module from the same origin.
    maplibregl.setWorkerUrl("/viago-maplibre-worker/maplibre-gl-worker.mjs");
    registerPmtilesProtocol();
    const map = new maplibregl.Map({
      container: divRef.current, style: BASE_STYLE,
      center: [-13.5784, 9.6412], zoom: 12,
      bearing: 0, pitch: 0, maxPitch: 65, attributionControl: {},
    });
    mapRef.current = map;
    let initialStyleRendered = false;
    const onLoad = () => {
      // Le fond local embarque deja le theme navigation (apply_nav_theme.py) : on ne le repeint pas.
      if (!LOCAL_BASEMAP) applyViagoNavigationPalette(map);
      // Ciel / horizon pour la vue conduite inclinee (facultatif selon la version).
      try {
        (map as unknown as { setSky?: (sky: Record<string, unknown>) => void }).setSky?.({
          "sky-color": "#bcdcf7", "horizon-color": "#eaf3fb", "fog-color": "#eeebe3",
          "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.4,
        });
      } catch { /* ciel non supporte : sans effet sur la navigation */ }
      // Alternatives (gris, sous le trajet choisi) + bulles de duree.
      map.addSource("viago-alt", { type: "geojson", data: lineFeature(null) });
      const altWidth = (extra: number): maplibregl.ExpressionSpecification => ["interpolate", ["linear"], ["zoom"],
        11, 2 + extra, 14, 5 + extra, 16, 10 + extra, 18, 20 + extra, 20, 40 + extra];
      map.addLayer({ id: "viago-alt-casing", type: "line", source: "viago-alt", filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": altWidth(4) } }, map.getStyle().layers?.find((l) => l.type === "symbol")?.id);
      map.addLayer({ id: "viago-alt-line", type: "line", source: "viago-alt", filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#8e9aa8", "line-width": altWidth(0) } }, map.getStyle().layers?.find((l) => l.type === "symbol")?.id);
      map.addLayer({ id: "viago-alt-label", type: "symbol", source: "viago-alt", filter: ["==", ["geometry-type"], "Point"],
        layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true, "text-padding": 6 },
        paint: { "text-color": "#33404d", "text-halo-color": "#ffffff", "text-halo-width": 3 } });
      // Signalements communautaires (au-dessus du trace, sous les etiquettes de rues).
      for (const type of ALERT_ORDER) {
        const icon = renderAlertIcon(type);
        if (icon) map.addImage(`viago-alert-${type}`, icon, { pixelRatio: 2 });
      }
      map.addSource("viago-alerts", { type: "geojson", data: lineFeature(null) });
      map.addLayer({ id: "viago-alerts-icons", type: "symbol", source: "viago-alerts", minzoom: 11,
        layout: {
          "icon-image": ["concat", "viago-alert-", ["get", "type"]],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.45, 15, 0.7, 18, 0.95],
          "icon-allow-overlap": true, "icon-ignore-placement": true,
        } });
      // Etapes intermediaires numerotees.
      map.addSource("viago-stops", { type: "geojson", data: lineFeature(null) });
      map.addLayer({ id: "viago-stops-circle", type: "circle", source: "viago-stops",
        paint: { "circle-radius": 11, "circle-color": "#475569", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
      map.addLayer({ id: "viago-stops-label", type: "symbol", source: "viago-stops",
        layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true },
        paint: { "text-color": "#ffffff" } });
      map.addSource("viago-route", { type: "geojson", data: lineFeature(null) });
      // Route "vraie rue" : la largeur suit celle des rues a chaque zoom, contour fonce, chevrons de sens.
      // Inseree sous les etiquettes pour que les noms de rues restent lisibles.
      const firstSymbolId = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
      const routeWidth = (extra: number): maplibregl.ExpressionSpecification => ["interpolate", ["linear"], ["zoom"],
        11, 2 + extra, 14, 6 + extra, 16, 12 + extra, 17, 18 + extra, 18, 26 + extra, 19, 38 + extra, 20, 52 + extra];
      const routeLayout = { "line-cap": "round", "line-join": "round" } as const;
      // Style Waze : bleu vif, contour blanc, halo lumineux qui detache la route des rues.
      map.addLayer({ id: "viago-route-glow", type: "line", source: "viago-route", layout: routeLayout,
        paint: { "line-color": "#1e88ff", "line-width": routeWidth(16), "line-opacity": 0.30, "line-blur": 6 } }, firstSymbolId);
      map.addLayer({ id: "viago-route-halo", type: "line", source: "viago-route", layout: routeLayout,
        paint: { "line-color": "#ffffff", "line-width": routeWidth(6), "line-opacity": 1 } }, firstSymbolId);
      map.addLayer({ id: "viago-route-blue", type: "line", source: "viago-route", layout: routeLayout,
        paint: { "line-color": "#1d8cff", "line-width": routeWidth(0), "line-opacity": 1 } }, firstSymbolId);
      // Tronçons non revetus / pistes : tireté brun clair par-dessus le bleu.
      map.addSource("viago-route-surface", { type: "geojson", data: lineFeature(null) });
      map.addLayer({ id: "viago-route-surface-dash", type: "line", source: "viago-route-surface",
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": "#ffcf8a", "line-width": routeWidth(-2), "line-dasharray": [1.4, 1.2], "line-opacity": 0.95 } }, firstSymbolId);
      const chevron = renderRouteChevron();
      if (chevron) {
        map.addImage("viago-route-chevron", chevron, { pixelRatio: 2 });
        map.addLayer({ id: "viago-route-arrows", type: "symbol", source: "viago-route", minzoom: 14.5,
          layout: {
            "symbol-placement": "line", "symbol-spacing": 70, "icon-image": "viago-route-chevron",
            "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.38, 18, 0.62, 20, 0.9],
            "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-rotation-alignment": "map", "icon-keep-upright": false,
          } }, firstSymbolId);
      }
      for (const [key, color] of [["start", "#10b981"], ["end", "#ef4444"]] as const) {
        map.addSource(`viago-${key}`, { type: "geojson", data: pointFeature(null, key) });
        map.addLayer({ id: `viago-${key}-dot`, type: "circle", source: `viago-${key}`, paint: {
          "circle-radius": 9, "circle-color": color,
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 3,
        } });
      }
      // Destination : epingle rouge (pointe sur le lieu) a la place du simple rond.
      const endPin = renderEndPin();
      if (endPin) {
        map.addImage("viago-marker-end", endPin, { pixelRatio: 2 });
        map.setPaintProperty("viago-end-dot", "circle-radius", 0);
        map.setPaintProperty("viago-end-dot", "circle-stroke-width", 0);
        map.addLayer({ id: "viago-end-pin", type: "symbol", source: "viago-end",
          layout: { "icon-image": "viago-marker-end", "icon-size": 0.6, "icon-anchor": "bottom",
            "icon-allow-overlap": true, "icon-ignore-placement": true } });
      }
      // C13-P2-A-R1: Always draw a vehicle arrow, not a GPS circle. The arrow
      // is a display symbol; it NEVER constitutes evidence of movement or GPS
      // accuracy, and does not change route progress or reported speed.
      const markerKinds: ViagoMarkerKind[] = ["car", "motorcycle", "foot"];
      for (const kind of markerKinds) {
        const image = renderMarkerIcon(kind);
        if (!image) throw new Error("VIAGO_VEHICLE_ICON_CANVAS_UNAVAILABLE");
        map.addImage(`viago-marker-${kind}`, image, { pixelRatio: 2 });
      }
      // Estimated walking position remains separate from road-confirmed vehicle lock.
      map.addSource("viago-pedestrian-accuracy", { type: "geojson", data: pedestrianAccuracyPolygon(null, null) });
      map.addLayer({ id: "viago-pedestrian-accuracy-fill", type: "fill", source: "viago-pedestrian-accuracy",
        paint: { "fill-color": "#079ba3", "fill-opacity": 0.14 } });
      map.addSource("viago-pedestrian", { type: "geojson", data: pointFeature(null, "pedestrian") });
      map.addLayer({ id: "viago-pedestrian-dot", type: "circle", source: "viago-pedestrian",
        paint: { "circle-radius": 0, "circle-opacity": 0, "circle-stroke-width": 0 } });
      map.addLayer({ id: "viago-pedestrian-icon", type: "symbol", source: "viago-pedestrian",
        layout: { "icon-image": "viago-marker-foot", "icon-size": 0.5, "icon-allow-overlap": true, "icon-ignore-placement": true } });
      map.addSource("viago-connector", { type: "geojson", data: lineFeature(null) });
      map.addLayer({ id: "viago-connector-line", type: "line", source: "viago-connector",
        layout: { "line-cap": "round" },
        paint: { "line-color": "#1676ed", "line-width": 3, "line-dasharray": [1.2, 1.8], "line-opacity": 0.9 } });
      map.addSource("viago-vehicle", { type: "geojson", data: pointFeature(null, "vehicle") });
      map.addLayer({
        id: "viago-vehicle-arrow", type: "symbol", source: "viago-vehicle",
        layout: {
          "icon-image": "viago-marker-car", "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.6, 18, 0.98, 20, 1.25],
          "icon-allow-overlap": true, "icon-ignore-placement": true,
          "icon-rotation-alignment": "map", "icon-pitch-alignment": "viewport",
        },
      });
      initialStyleRendered = true;
      setMapError(null);
      setLoaded(true);
    };
    const onClick = (event: maplibregl.MapMouseEvent) => {
      const p = propsRef.current;
      // Toucher un signalement : ouvre la carte « toujours la ? ».
      if (p.onSelectAlert) {
        const m0 = event.target as maplibregl.Map;
        const box0: [maplibregl.PointLike, maplibregl.PointLike] = [[event.point.x - 18, event.point.y - 18], [event.point.x + 18, event.point.y + 18]];
        const alertHit = m0.getLayer("viago-alerts-icons") ? m0.queryRenderedFeatures(box0, { layers: ["viago-alerts-icons"] })[0] : undefined;
        const alertId = alertHit?.properties?.id;
        if (typeof alertId === "string") { p.onSelectAlert(alertId); return; }
      }
      // Pendant le guidage, un toucher sur la carte ne doit jamais changer le trajet.
      if (p.navigationActive) return;
      // Toucher une alternative grise (zone elargie) la choisit au lieu de deplacer le point.
      if (p.onSelectAlt) {
        const m = event.target as maplibregl.Map;
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [[event.point.x - 14, event.point.y - 14], [event.point.x + 14, event.point.y + 14]];
        const hit = m.queryRenderedFeatures(box, { layers: ["viago-alt-line", "viago-alt-label"] })[0];
        const idx = hit?.properties?.idx;
        if (typeof idx === "number") { p.onSelectAlt(idx); return; }
      }
      p.onSelect({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    };
    const onDragStart = () => {
      const p = propsRef.current;
      if (p.navigationActive && p.followUser) p.onUserPan?.();
    };
    map.on("load", onLoad);
    map.on("click", onClick);
    map.on("dragstart", onDragStart);
    map.on("error", (e) => {
      // Keep diagnostics local; do not expose tokens or provider URLs.
      // Tile reload errors after the first render do not mean the whole map is unavailable.
      if (!initialStyleRendered && !map.isStyleLoaded()) setMapError("Fond cartographique indisponible");
      console.warn("VIAGO_MAPLIBRE_ERROR", e.error?.message ?? "unknown");
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("viago-alerts") as GeoJSONSource | undefined)?.setData(props.alertFeatures ?? lineFeature(null));
  }, [loaded, props.alertFeatures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const pts = props.stopPoints ?? [];
    (map.getSource("viago-stops") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: pts.map((p, i) => ({ type: "Feature", properties: { n: String(i + 1) }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
    });
  }, [loaded, props.stopPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("viago-alt") as GeoJSONSource | undefined)?.setData(props.altLines ?? lineFeature(null));
  }, [loaded, props.altLines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("viago-route-surface") as GeoJSONSource | undefined)?.setData(props.surfaceLines ?? lineFeature(null));
  }, [loaded, props.surfaceLines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const update = (key: string, data: GeoJSON.FeatureCollection) =>
      (map.getSource(key) as GeoJSONSource | undefined)?.setData(data);
    update("viago-route", lineFeature(props.route));
    // Walking follow mode shows the estimated GPS point, not a competing green start dot.
    update("viago-start", pointFeature(props.navigationActive ? null : props.start, "start"));
    update("viago-end", pointFeature(props.end, "end"));
    update("viago-pedestrian", pointFeature(props.pedestrianMode ? props.pedestrianPosition ?? null : null, "estimated GPS"));
    update("viago-pedestrian-accuracy", pedestrianAccuracyPolygon(
      props.pedestrianMode ? props.pedestrianPosition ?? null : null,
      props.pedestrianAccuracyM,
    ));
    if (map.getLayer("viago-vehicle-arrow")) {
      map.setLayoutProperty("viago-vehicle-arrow", "visibility", props.pedestrianMode ? "none" : "visible");
    }
    // C13-P2-A-R3: only confirmed movement may advance the displayed vehicle.
    // A stopped or uncertain GPS fix cannot move/erase the last known arrow.
    if (!props.navigationActive) {
      heldVehicleRef.current = props.userPosition ?? null;
      lastReliableBearingRef.current = null;
    } else if (heldVehicleRef.current === null && props.userPosition) {
      heldVehicleRef.current = props.userPosition;
    } else if (props.motionPhase === "moving" && props.visualGpsUsable && props.userPosition) {
      heldVehicleRef.current = props.userPosition;
    }
    const held = heldVehicleRef.current;
    // Affichage : marqueur colle a la route s'il en est proche, sinon pointille vers la route.
    // N'influence ni la progression, ni la vitesse, ni les annonces.
    let shown = held;
    let connector: ViagoPoint[] | null = null;
    if (!props.navigationActive) everConfirmedRef.current = false;
    else if (props.gpsFixValid) everConfirmedRef.current = true;
    if (props.navigationActive && !props.pedestrianMode && props.route && held) {
      const near = nearestPointOnRoute(props.route, held);
      if (!everConfirmedRef.current) {
        // Pas encore de verrouillage route : le vehicule est au depart du trajet (GPS trop imprecis pour mieux).
        shown = props.route[0];
      } else if (near && near.distanceM <= SNAP_DISPLAY_M) shown = near.point;
      else if (near && near.distanceM >= CONNECTOR_MIN_M) connector = [held, near.point];
    } else if (props.navigationActive && !props.pedestrianMode && props.route && !everConfirmedRef.current) {
      shown = props.route[0];
    }
    update("viago-vehicle", pointFeature(shown, "vehicle"));
    update("viago-connector", lineFeature(connector));
    if (map.getLayer("viago-vehicle-arrow")) {
      map.setLayoutProperty("viago-vehicle-arrow", "icon-image", props.profile === "motorcycle" ? "viago-marker-motorcycle" : "viago-marker-car");
    }
    // Preserve heading at a stop. The route heading is a visual hint only.
    if (props.motionPhase === "moving" && bearingValid(props.vehicleHeading)) {
      lastReliableBearingRef.current = props.vehicleHeading;
    }
    const displayBearing = lastReliableBearingRef.current ?? routeLookAheadBearing(props.route, shown ?? held) ?? routeVisualBearing(props.route, shown ?? held);
    if (map.getLayer("viago-vehicle-arrow")) {
      map.setLayoutProperty("viago-vehicle-arrow", "icon-rotate", displayBearing ?? 0);
    }
  }, [loaded, props.route, props.start, props.end, props.userPosition,
    props.pedestrianMode, props.pedestrianPosition, props.pedestrianAccuracyM, props.profile,
    props.vehicleHeading, props.navigationActive, props.followUser, props.motionPhase, props.gpsFixValid, props.visualGpsUsable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    map.resize();
    const following = Boolean(props.navigationActive && props.followUser);
    const recenterRequested = (props.recenterRequest ?? 0) !== lastRecenterRef.current;
    lastRecenterRef.current = props.recenterRequest ?? 0;
    const walking = Boolean(props.pedestrianMode && props.pedestrianPosition);
    const cameraPoint = walking ? props.pedestrianPosition! : (props.visualGpsUsable ? (props.userPosition ?? heldVehicleRef.current) : (heldVehicleRef.current ?? props.userPosition));
    // Walking camera follows the *estimated* GPS dot with an accuracy-aware
    // displacement threshold. This never confirms route progress/turns/speed.
    const footDistance = walking && lastFootCamera.current && cameraPoint
      ? visualDistanceM(lastFootCamera.current.point, cameraPoint) : 0;
    const footCameraReady = walking && cameraPoint && (
      !lastFootCamera.current ||
      (Date.now() - lastFootCamera.current.at >= 3000 &&
       footDistance >= Math.max(15, (props.pedestrianAccuracyM ?? 0)))
    );
    // Approximate GPS may follow visually after sustained displacement.
    // Never use this gate for confirmed turns, speed or route progress.
    const approxFollowing = Boolean(
      following && !walking && props.visualGpsUsable &&
      props.motionPhase !== "moving" && cameraPoint
    );
    if (!approxFollowing) {
      lastApproxCamera.current = null;
    } else if (!lastApproxCamera.current && cameraPoint) {
      lastApproxCamera.current = { point: cameraPoint, at: Date.now() };
    }
    const approximateFollowReady = Boolean(
      approxFollowing && cameraPoint && lastApproxCamera.current &&
      Date.now() - lastApproxCamera.current.at >= 5000 &&
      visualDistanceM(lastApproxCamera.current.point, cameraPoint) >= 120
    );
    // Heading-up is enabled only for a usable GPS fix and real heading.
    if (following && cameraPoint && (recenterRequested || !followedRef.current ||
        (walking ? footCameraReady : ((props.motionPhase === "moving" && props.visualGpsUsable) || approximateFollowReady)))) {
      if (walking) lastFootCamera.current = { point: cameraPoint, at: Date.now() };
      if (approxFollowing) lastApproxCamera.current = { point: cameraPoint, at: Date.now() };
      else lastFootCamera.current = null;
      const headingReady = !walking && props.gpsFixValid && props.motionPhase === "moving" && bearingValid(props.vehicleHeading);
      const routeAhead = routeLookAheadBearing(props.route, cameraPoint);
      map.easeTo({ center: [cameraPoint.lng, cameraPoint.lat],
        offset: [0, walking ? 0 : Math.round(map.getContainer().clientHeight * 0.22)],
        zoom: walking ? 17.2 : (props.visualGpsUsable ? (props.gpsFixValid ? 18.5 : 18.0) : 17.2),
        bearing: headingReady ? (props.vehicleHeading ?? 0) : (routeAhead ?? 0),
        pitch: walking ? 0 : 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: recenterRequested ? 450 : (followedRef.current ? 500 : 0), essential: true,
      });
      followedRef.current = true;
      return;
    }
    // Weak GPS must never force a fitBounds or reset the driving camera.
    if (following) return;
    followedRef.current = false;
    lastFootCamera.current = null;
    const fitRequested = props.fitRequest !== lastFitRef.current;
    lastFitRef.current = props.fitRequest;
    const detailRequested = props.detailRequest !== lastDetailRef.current;
    lastDetailRef.current = props.detailRequest;
    if (props.viewMode === "overview" && (fitRequested || !props.navigationActive)) {
      const positions = props.route?.length ? props.route : [props.start, props.end].filter((p): p is ViagoPoint => p !== null);
      if (positions.length > 1 && !(props.sheetOpen && !props.navigationActive && map.getContainer().clientWidth < 768)) {
        const bounds = new maplibregl.LngLatBounds();
        for (const p of positions) bounds.extend([p.lng, p.lat]);
        map.fitBounds(bounds, { padding: 45, maxZoom: 17, duration: 350, bearing: 0, pitch: 0 });
      } else if (positions.length === 1) {
        map.jumpTo({ center: [positions[0].lng, positions[0].lat], zoom: 16, bearing: 0, pitch: 0 });
      }
    } else if (detailRequested && props.viewMode === "detail") {
      const p = props.userPosition ?? props.start;
      if (p) map.easeTo({ center: [p.lng, p.lat], zoom: 16, bearing: 0, pitch: 0, duration: 250 });
    }
  }, [loaded, props.route, props.start, props.end, props.userPosition, props.vehicleHeading,
    props.pedestrianMode, props.pedestrianPosition, props.pedestrianAccuracyM,
    props.followUser, props.navigationActive, props.motionPhase, props.gpsFixValid, props.visualGpsUsable, props.sheetOpen,
    props.fitRequest, props.detailRequest, props.viewMode, props.recenterRequest]);

  return <div className="absolute inset-0" data-viago-engine="maplibre">
    <div ref={divRef} className="h-full w-full" />
    {mapError && <div role="status" className="pointer-events-none absolute bottom-5 left-4 rounded-lg bg-white/95 p-2 text-xs text-slate-800">{mapError}</div>}
  </div>;
}
