"use client";
import { Capacitor, registerPlugin } from "@capacitor/core";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CarFront, ChevronUp, Crosshair,
  Footprints, MapPin, Navigation2, RotateCcw, Search, Settings2,
  X, Bike, LocateFixed, LoaderCircle,
} from "lucide-react";
import type { ViagoPoint } from "@/features/viago/viago-map";
import "./viago-v3.css";
import { updateNativeMotionGate } from "./viago-native-motion";
import { newGpsTelemetry, recordGpsSample, summarizeGpsTelemetry, type GpsTelemetry } from "./viago-gps-telemetry";
import { initialRoadLock, updateRoadLock, type RoadLockState } from "./viago-road-lock";
import { getViagoCurrentPosition, watchViagoPosition, viagoGpsSource, type ViagoGpsWatch } from "./viago-native-location";

import ViagoDrivingHud from "./viago-driving-hud";
import ViagoRoutePreview from "./viago-route-preview";
import ViagoReportSheet from "./viago-report-sheet";
import { ALERT_META, alertFeatures, alertsAhead, deviceId, timeAgo, type AlertType, type ViagoAlert } from "@/features/viago/viago-alerts";
import ViagoDirectionsCard, { type DirectionsRole, type Suggestion } from "./viago-directions-card";
import { alternativeFeatures, durationDelta, formatMinutes, type RouteCandidate } from "@/features/viago/viago-alternatives";
import { surfaceSectionLines, surfaceSummaryLabel, upcomingSurfaceNotice, verifiedSurface, type SurfaceInfo } from "@/features/viago/viago-surface";
import { matchRouteProgress, type RouteProgress } from "./viago-progress";
import { confirmedRouteSpeedKmh, deriveViagoGuidance, type ConfirmedGuidanceProgress } from "./viago-guidance";
import { deriveViagoTripEstimate } from "./viago-trip-estimate";
import { describeViagoVoice, planViagoVoice, selectViagoVoiceReplay } from "./viago-voice-plan";
import { speakViagoFrench, stopViagoSpeech } from "./viago-voice-engine";
import { nextOffRouteGate, freshOffRouteGate } from "./viago-reroute";
import { freshPedestrianGate, nextPedestrianGate } from "./viago-pedestrian-gate";
import { appendRouteObservation, corroboratedRoutePosition,
  movementBearing, pointDistanceM, smoothBearing, fuseVisualGpsFix, updateMotionGate,
  type MotionGateState,
  type VisualGpsFix, type RouteObservation } from "./viago-navigation-position";

const ViagoLeafletMap = dynamic(() => import("@/features/viago/viago-map"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">Chargement de la carte…</div>,
});

const ViagoMapLibre = dynamic(() => import("@/features/viago/viago-maplibre"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">Chargement MapLibre…</div>,
});

type Profile = "car" | "motorcycle" | "foot";
type GpsSignal = "idle" | "waiting" | "valid" | "imprecise" | "stale" | "invalid";

// Strict matching threshold remains 50 m; camera uses up to 100 m only.
const MAX_GPS_ACCURACY_M = 50;
const MAX_GPS_VISUAL_ACCURACY_M = 100;
const MAX_GPS_SAMPLE_AGE_MS = 15000;
const GPS_STALE_AFTER_MS = 20000;
type PointRole = "start" | "end";
type RouteResult = {
  status: string;
  profile: Profile;
  geometry: { type: "LineString"; coordinates: number[][] } | null;
  distance_m: number | null;
  duration_s?: number | null;
  duration_source?: string | null;
  total_cost: number | null;
  message?: string;
  maneuvers?: unknown;
  surface?: unknown;
};

// P6-C6: certified, explicit backend instructions only. Never derive turns from polyline curvature.
type ViagoManeuverKind = "turn" | "continue" | "depart" | "arrive" | "roundabout";
type ViagoManeuverModifier = "left" | "right" | "straight" | "slight_left" | "slight_right" | "sharp_left" | "sharp_right" | "uturn";
type ViagoManeuver = {
  kind: ViagoManeuverKind;
  modifier: ViagoManeuverModifier | null;
  distanceFromStartM: number;
  streetName: string | null;
};
function verifiedManeuvers(payload: unknown): ViagoManeuver[] {
  if (!Array.isArray(payload) || payload.length > 500) return [];
  const kinds: readonly string[] = ["turn", "continue", "depart", "arrive", "roundabout"];
  const modifiers: readonly string[] = ["left", "right", "straight", "slight_left", "slight_right", "sharp_left", "sharp_right", "uturn"];
  const result: ViagoManeuver[] = [];
  let previous = -1;
  for (const item of payload) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return [];
    const m = item as Record<string, unknown>;
    // Contract: exact along-route metre offset, verified road maneuver kind and optional name.
    if (typeof m.kind !== "string" || !kinds.includes(m.kind) ||
        typeof m.distance_from_start_m !== "number" ||
        !Number.isFinite(m.distance_from_start_m) || m.distance_from_start_m < previous ||
        m.distance_from_start_m < 0) return [];
    if (m.modifier !== null && m.modifier !== undefined &&
        (typeof m.modifier !== "string" || !modifiers.includes(m.modifier))) return [];
    if (m.kind === "turn" && (typeof m.modifier !== "string" || !modifiers.includes(m.modifier))) return [];
    if (m.street_name !== null && m.street_name !== undefined && typeof m.street_name !== "string") return [];
    previous = m.distance_from_start_m;
    result.push({
      kind: m.kind as ViagoManeuverKind,
      modifier: (m.modifier ?? null) as ViagoManeuverModifier | null,
      distanceFromStartM: previous,
      streetName: typeof m.street_name === "string" ? m.street_name.slice(0, 90) : null,
    });
  }
  return result;
}
function maneuverTitle(m: ViagoManeuver): string {
  if (m.kind === "arrive") return "Vous arrivez à destination";
  if (m.kind === "roundabout") return "Abordez le rond-point";
  if (m.kind === "depart") return "Démarrez votre trajet";
  if (m.modifier === "uturn") return "Faites demi-tour";
  if (m.modifier === "left" || m.modifier === "slight_left" || m.modifier === "sharp_left") return "Tournez à gauche";
  if (m.modifier === "right" || m.modifier === "slight_right" || m.modifier === "sharp_right") return "Tournez à droite";
  return "Continuez tout droit";
}
function maneuverArrow(m: ViagoManeuver): string {
  if (m.kind === "roundabout") return "↻";
  if (m.kind === "arrive") return "⌖";
  if (m.modifier === "uturn") return "↶";
  if (m.modifier === "left" || m.modifier === "slight_left" || m.modifier === "sharp_left") return "↰";
  if (m.modifier === "right" || m.modifier === "slight_right" || m.modifier === "sharp_right") return "↱";
  return "↑";
}

type Place = { place_id: number; display_name: string; lat: string; lon: string; label?: string; sub?: string; agn?: string };
const AGN_CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurant", hotel: "Hôtel", bar: "Bar", commerce: "Commerce", entreprise: "Entreprise",
  administration: "Administration", ecole: "École", sante: "Santé", pharmacie: "Pharmacie", banque: "Banque",
  tourisme: "Tourisme", other: "Lieu",
};
type AgnPlaceHit = { public_number: string; name: string; category: string; commune: string | null; lat: number; lng: number; distance_m: number | null };
function formatPlaceDistance(m: number): string { return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",")} km`; }
// Le service Adresse GN reste séparé du laboratoire de routage Viago.
// Viago uses dedicated same-origin Next.js server routes.
// Backend loopback addresses never reach the mobile browser.

type AddressGNResponse = {
  status: "found" | "invalid" | "not_found" | "error" | "rate_limited";
  result: {
    public_number: string;
    name: string | null;
    business_name: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  message?: string;
};

// Reconnaît les numéros publics comprenant un préfixe territorial et des chiffres,
// sans envoyer les noms de lieux au service de recherche par numéro.
function looksLikeAddressGN(value: string): boolean {
  return /^(?:GN[- ])?[A-Z]{2,5}\d{0,3}[- ][A-Z0-9-]*\d[A-Z0-9-]*$/i.test(value.trim());
}
const SAMPLE_START: ViagoPoint = { lat: 9.511778066434486, lng: -13.705658620832184 };
const SAMPLE_END: ViagoPoint = { lat: 9.512771610241872, lng: -13.70403572560273 };
const PROFILE_OPTIONS = [
  { value: "car", label: "Voiture", Icon: CarFront },
  { value: "motorcycle", label: "Moto", Icon: Bike },
  { value: "foot", label: "Piéton", Icon: Footprints },
] as const;

function validLine(data: RouteResult, expected: Profile): ViagoPoint[] | null {
  if (data.status !== "ok" || data.profile !== expected ||
      data.geometry?.type !== "LineString" || !Array.isArray(data.geometry.coordinates) ||
      data.geometry.coordinates.length < 2) return null;
  const points = data.geometry.coordinates;
  if (!points.every((p) => Array.isArray(p) && p.length >= 2 &&
      Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
      Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) return null;
  return points.map(([lng, lat]) => ({ lat, lng }));
}
function parseCoordinates(text: string): ViagoPoint | null {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
function prettyDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

function spokenDistance(m: number): string {
  if (m < 40) return "Dans quelques mètres";
  if (m < 1000) return `Dans ${Math.round(m / 10) * 10} mètres`;
  const km = Math.round(m / 100) / 10;
  return `Dans ${String(km).replace(".", ",")} ${km >= 2 ? "kilomètres" : "kilomètre"}`;
}

function prettyDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

export default function ViagoPage() {
  const [profile, setProfile] = useState<Profile>("motorcycle");
    // MapLibre (vectoriel, rotation, inclinaison) est le moteur par défaut.
  // Leaflet reste disponible avec ?engine=leaflet, et sert de repli sans WebGL.
  const [mapLibreEnabled, setMapLibreEnabled] = useState(true);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    let webgl = false;
    try {
      const canvas = document.createElement("canvas");
      webgl = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      webgl = false;
    }
    setMapLibreEnabled(query.get("engine") !== "leaflet" && webgl);
  }, []);
  const [start, setStart] = useState<ViagoPoint | null>(null);
  const [end, setEnd] = useState<ViagoPoint | null>(null);
  const [startName, setStartName] = useState("Ma position");
  const [endName, setEndName] = useState("Destination sur la carte");
  const [route, setRoute] = useState<ViagoPoint[] | null>(null);
  // The native GPS watcher must always match the CURRENT route after a reroute.
  const routeForGps = useRef<ViagoPoint[] | null>(null);
  useEffect(() => { routeForGps.current = route; }, [route]);
  const [maneuvers, setManeuvers] = useState<ViagoManeuver[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [surface, setSurface] = useState<SurfaceInfo | null>(null);
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [chosenRoute, setChosenRoute] = useState(0);
  const [altBusy, setAltBusy] = useState(false);
  const altGeneration = useRef(0);
  const chosenRouteRef = useRef(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [arrivalAt, setArrivalAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startQuery, setStartQuery] = useState("");
  const [endQuery, setEndQuery] = useState("");
  const [searchRole, setSearchRole] = useState<PointRole>("end");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  // Etapes intermediaires (max 3) : les points ne changent qu'a la selection, le texte est a part.
  const [stops, setStops] = useState<{ point: ViagoPoint | null; name: string }[]>([]);
  const [stopQueries, setStopQueries] = useState<string[]>([]);
  const [stopPlaces, setStopPlaces] = useState<Place[]>([]);
  const [dirFocus, setDirFocus] = useState<DirectionsRole | null>(null);
  // Signalements communautaires.
  const [alerts, setAlerts] = useState<ViagoAlert[]>([]);
  const [reporting, setReporting] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const spokenAlerts = useRef<Set<string>>(new Set());
  const [advanced, setAdvanced] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [fitRequest, setFitRequest] = useState(0);
  const [detailRequest, setDetailRequest] = useState(0);
  const [mapView, setMapView] = useState<"overview" | "detail">("overview");
  const [selection, setSelection] = useState<PointRole>("end");
  const [latitude, setLatitude] = useState("9.511778066434486");
  const [longitude, setLongitude] = useState("-13.705658620832184");
  const [tracking, setTracking] = useState(false);
  // G1-P5-P1: explicit audio opt-in; no synthetic speech until the user taps the speaker.
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Visible proof of a voice command accepted by Android, not proof of hearing.
  const [lastAutomaticVoice, setLastAutomaticVoice] = useState<{ text: string; at: number; epoch: number; nextIndex: number } | null>(null);
  const [voiceReplayBusy, setVoiceReplayBusy] = useState(false);
  const [lastReplayVoiceAt, setLastReplayVoiceAt] = useState<number | null>(null);
  const voiceReplayToken = useRef(0);
  const spokenVoiceKeys = useRef<Set<string>>(new Set());
  const voiceRouteEpoch = useRef(0);
  useEffect(() => {
    voiceRouteEpoch.current += 1;
    voiceReplayToken.current += 1;
    setVoiceReplayBusy(false);
    setLastReplayVoiceAt(null);
    spokenVoiceKeys.current.clear();
    setLastAutomaticVoice(null);
    void stopViagoSpeech().catch(() => undefined);
  }, [route]);
  useEffect(() => () => { void stopViagoSpeech().catch(() => undefined); }, []);
  async function toggleVoice() {
    if (voiceEnabled) {
      voiceReplayToken.current += 1;
      setVoiceReplayBusy(false);
      setLastReplayVoiceAt(null);
      setVoiceEnabled(false);
      spokenVoiceKeys.current.clear();
      setLastAutomaticVoice(null);
      setVoiceError(null);
      await stopViagoSpeech().catch(() => undefined);
      return;
    }
    setVoiceError(null);
    try {
      // Must originate in a user gesture for browser speech permission.
      await speakViagoFrench("Guidage vocal activé.");
      setVoiceEnabled(true);
    } catch (error) {
      setVoiceEnabled(false);
      setVoiceError(error instanceof Error ? error.message : "Voix française indisponible.");
    }
  }

  // VIAGO C14-P5-P3: native screen control follows GPS navigation.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.getPlatform() !== "android") return;

    const screen = registerPlugin<{
      setNavigationActive(
        options: { active: boolean }
      ): Promise<void>;
    }>("ViagoScreen");

    void screen.setNavigationActive({ active: tracking })
      .catch((error: unknown) => {
        console.warn("VIAGO_SCREEN_CONTROL", error);
      });
  }, [tracking]);

  // Release native screen control when leaving the Viago page.
  useEffect(() => {
    return () => {
      if (!Capacitor.isNativePlatform()) return;
      if (Capacitor.getPlatform() !== "android") return;

      const screen = registerPlugin<{
        setNavigationActive(
          options: { active: boolean }
        ): Promise<void>;
      }>("ViagoScreen");

      void screen.setNavigationActive({ active: false })
        .catch((error: unknown) => {
          console.warn("VIAGO_SCREEN_RELEASE", error);
        });
    };
  }, []);
  const [livePosition, setLivePosition] = useState<ViagoPoint | null>(null);
  // Visual GPS estimate for walking, distinct from route-confirmed progress.
  const [pedestrianGpsPosition, setPedestrianGpsPosition] = useState<ViagoPoint | null>(null);
  const [gpsSignal, setGpsSignal] = useState<GpsSignal>("idle");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsSpeedKmh, setGpsSpeedKmh] = useState<number | null>(null);
  const [vehicleHeading, setVehicleHeading] = useState<number | null>(null);
  const lastHeadingObservation = useRef<{ point: ViagoPoint; at: number } | null>(null);
  const lastHeading = useRef<number | null>(null);
  const [routeProgress, setRouteProgress] = useState<RouteProgress | null>(null);
  // A stationary GPS fix cannot advance the route. Retain the last verified
  // position only for a clearly labelled, frozen guidance reference.
  const [lastConfirmedGuidance, setLastConfirmedGuidance] = useState<ConfirmedGuidanceProgress | null>(null);
  const [guidanceClock, setGuidanceClock] = useState(0);
  useEffect(() => {
    if (!tracking) return;
    setGuidanceClock(Date.now());
    const interval = window.setInterval(() => setGuidanceClock(Date.now()), 10000);
    return () => window.clearInterval(interval);
  }, [tracking]);
  const previousRouteMatch = useRef<{ meters: number; at: number } | null>(null);
  const recentRouteObservations = useRef<RouteObservation[]>([]);
  const roadLock = useRef<RoadLockState>(initialRoadLock());
  const pedestrianGate = useRef(freshPedestrianGate());
  const visualGpsFix = useRef<VisualGpsFix | null>(null);
  const motionGate = useRef<MotionGateState | null>(null);
  const [motionPhase, setMotionPhase] = useState<MotionGateState["phase"]>("uncertain");
  const lastGpsSampleAt = useRef<number>(0);
  const [follow, setFollow] = useState(true);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const watchId = useRef<ViagoGpsWatch | null>(null);
  const watchGeneration = useRef(0);
  const watchStarting = useRef(false);
  // C14-P4-C: one active watcher; restart only after sustained silence.
  const restartGpsWatch = useRef<(() => void) | null>(null);
  const lastWatchRestartAt = useRef(0);
  const locationDenied = useRef(false);
  const retryGpsPermission = useRef<(() => void) | null>(null);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  const [gpsSource, setGpsSource] = useState<"android-native" | "browser">("browser");
  const routeRequest = useRef<AbortController | null>(null);
  const rerouteRequest = useRef<AbortController | null>(null);
  const rerouteGate = useRef(freshOffRouteGate());
  // C14-P5-P2-C: telemetry is strictly opt-in and RAM-only; no location coordinates.
  const gpsTelemetry = useRef<GpsTelemetry | null>(null);
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [telemetryReport, setTelemetryReport] = useState<ReturnType<typeof summarizeGpsTelemetry> | null>(null);
  const [telemetryCopyStatus, setTelemetryCopyStatus] = useState("");
  // Diagnostic du pipeline de suivi (aucune coordonnée) : où le suivi se bloque-t-il ?
  const newGpsDbg = () => ({
    phase: "-", spd: null as number | null, acc: null as number | null,
    route: "-", cont: true, lock: "-", confirmed: 0, contFail: 0,
    routes: {} as Record<string, number>, locks: {} as Record<string, number>,
  });
  const gpsDbg = useRef(newGpsDbg());
  const [dbgSnap, setDbgSnap] = useState(() => newGpsDbg());
  const [telemetryCompact, setTelemetryCompact] = useState(false);
  useEffect(() => {
    if (!telemetryEnabled) return;
    const id = window.setInterval(() => {
      if (gpsTelemetry.current) setTelemetryReport(summarizeGpsTelemetry(gpsTelemetry.current));
      setDbgSnap({ ...gpsDbg.current, routes: { ...gpsDbg.current.routes }, locks: { ...gpsDbg.current.locks } });
    }, 1000);
    return () => window.clearInterval(id);
  }, [telemetryEnabled]);
  // Comme Waze : si la carte a été déplacée à la main, elle revient seule sur le véhicule après 8 s.
  const autoFollowMs = useRef(8000);
  useEffect(() => {
    if (!tracking || follow) return;
    const id = window.setTimeout(() => {
      setMapView("detail");
      setFollow(true);
      setRecenterRequest((value) => value + 1);
    }, autoFollowMs.current);
    return () => window.clearTimeout(id);
  }, [tracking, follow]);
  function toggleGpsDiagnostic() {
    if (telemetryEnabled) {
      gpsTelemetry.current = null;
      setTelemetryReport(null);
      setTelemetryCopyStatus("");
      setTelemetryCompact(false);
      setTelemetryEnabled(false);
    } else {
      gpsTelemetry.current = newGpsTelemetry();
      gpsDbg.current = newGpsDbg();
      setTelemetryReport(summarizeGpsTelemetry(gpsTelemetry.current));
      setTelemetryCopyStatus("");
      setTelemetryEnabled(true);
    }
  }
  async function copyGpsDiagnostic() {
    if (!gpsTelemetry.current) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ ...summarizeGpsTelemetry(gpsTelemetry.current), pipeline: gpsDbg.current }, null, 2));
      setTelemetryCopyStatus("Statistiques copiées (sans coordonnées).");
    } catch {
      setTelemetryCopyStatus("Copie bloquée : autorisez le presse-papiers.");
    }
  }

  // Le routage reste la responsabilité du backend Viago : aucune URL Google/Waze.
  async function resolveAddressGN(number: string, role: PointRole): Promise<void> {
    const response = await fetch(
       `/viago-mobile/api/address/${encodeURIComponent(number)}`.trim(),
      { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.headers.get("content-type")?.includes("json")) {
      throw new Error(`Recherche Adresse GN : le serveur a renvoyé une page au lieu d’une réponse (HTTP ${response.status}). Vérifiez que l’application web tourne et rechargez.`);
    }
    const data = await response.json() as AddressGNResponse;
    if (response.status >= 500) {
      throw new Error(`Service Adresse GN : erreur interne (HTTP ${response.status}). La recherche ne peut pas aboutir tant que l’API ne répond pas.`);
    }
    if (data.status !== "found" || !data.result) {
      throw new Error(data.message || "Cette Adresse GN est introuvable ou n'est pas publique.");
    }
    const { lat, lng, public_number, name, business_name } = data.result;
    if (typeof lat !== "number" || typeof lng !== "number" ||
        !Number.isFinite(lat) || !Number.isFinite(lng) ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error("Cette Adresse GN n'a pas de position GPS publique exploitable.");
    }
    applyPoint({ lat, lng }, role, name || business_name || `Adresse GN ${public_number}`);
    if (role === "start") setStartQuery(public_number);
    else setEndQuery(public_number);
    setPlaces([]);
    setMessage(`Adresse GN ${public_number} reconnue comme ${role === "start" ? "départ" : "destination"}.`);
  }

  const stopTracking = useCallback(() => {
    voiceReplayToken.current += 1;
    setVoiceReplayBusy(false);
    setLastReplayVoiceAt(null);
    // Preserve the user's voice preference across trips.
    setVoiceError(null);
    spokenVoiceKeys.current.clear();
    setLastAutomaticVoice(null);
    void stopViagoSpeech().catch(() => undefined);
    watchGeneration.current += 1;
    rerouteRequest.current?.abort();
    rerouteRequest.current = null;
    rerouteGate.current = freshOffRouteGate();
    watchStarting.current = false;
    gpsTelemetry.current = null;
    setTelemetryEnabled(false);
    setTelemetryReport(null);
    setTelemetryCopyStatus("");
    restartGpsWatch.current = null;
    locationDenied.current = false;
    retryGpsPermission.current = null;
    setGpsPermissionDenied(false);
    watchId.current?.stop();
    watchId.current = null;
    lastGpsSampleAt.current = 0;
    previousRouteMatch.current = null;
    recentRouteObservations.current = [];
    roadLock.current = initialRoadLock();
    pedestrianGate.current = freshPedestrianGate();
    setPedestrianGpsPosition(null);
    visualGpsFix.current = null;
    motionGate.current = null;
    setMotionPhase("uncertain");
    setRouteProgress(null);
    setLastConfirmedGuidance(null);
    setGpsAccuracy(null);
    setGpsSpeedKmh(null);
    setVehicleHeading(null);
    lastHeading.current = null;
    lastHeadingObservation.current = null;
    setLivePosition(null);
    setGpsSignal("idle");
    setTracking(false);
  }, []);
  useEffect(() => () => {
    rerouteRequest.current?.abort();
    rerouteRequest.current = null;
    watchGeneration.current += 1;
    watchStarting.current = false;
    restartGpsWatch.current = null;
    retryGpsPermission.current = null;
    watchId.current?.stop();
    watchId.current = null;
  }, []);

  useEffect(() => {
    if (!tracking) return;

    const interval = window.setInterval(() => {
      if (
        lastGpsSampleAt.current > 0 &&
        Date.now() - lastGpsSampleAt.current > GPS_STALE_AFTER_MS
      ) {
        setGpsSignal("stale");
        setRouteProgress(null);
        // A callback error does not guarantee the native watch ended.
        // Explicitly stop the old watch before opening a replacement.
        const now = Date.now();
        if (viagoGpsSource() === "android-native" &&
            !locationDenied.current && !watchStarting.current &&
            restartGpsWatch.current &&
            now - lastWatchRestartAt.current >= 30000 &&
            now - lastGpsSampleAt.current >= 30000) {
          lastWatchRestartAt.current = now;
          if (gpsTelemetry.current) gpsTelemetry.current.restarts++;
          restartGpsWatch.current();
        }
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [tracking]);

  const clearRoute = useCallback(() => {
    routeRequest.current?.abort();
    routeRequest.current = null;
    setBusy(false);
    setManeuvers([]);
    setRoute(null);
    setDistance(null);
    setSurface(null);
    altGeneration.current += 1;
    setCandidates([]);
    setChosenRoute(0);
    setAltBusy(false);
    setDuration(null);
    setArrivalAt(null);
    stopTracking();
  }, [stopTracking]);

  function chooseProfile(value: Profile) {
    if (profile !== value) {
      setProfile(value);
      clearRoute();
      setMessage(null);
    }
  }

  const applyPoint = useCallback((point: ViagoPoint, role: PointRole, label?: string) => {
    clearRoute();
    if (role === "start") {
      setStart(point);
      setStartName(label || "Départ choisi sur la carte");
      setSelection("end");
    } else {
      setEnd(point);
      setEndName(label || "Destination choisie sur la carte");
      setSelection("end");
    }
    if (role === "start") setStartQuery(label || "Départ choisi sur la carte");
    else setEndQuery(label || "Destination choisie sur la carte");
    setPlaces([]);
    setMessage(null);
    setSheetOpen(true);
  }, [clearRoute]);

  const choosePoint = useCallback((point: ViagoPoint) => {
    // Garde-fou : pendant le guidage, un toucher sur la carte ne change ni le depart ni l'arrivee.
    if (tracking) return;
    applyPoint(point, selection);
  }, [applyPoint, selection, tracking]);

  // Lieux publics Adresse GN recherches par nom (lecture seule, tri par pertinence puis proximite).
  async function searchNamedPlaces(q: string): Promise<Place[]> {
    const near = livePosition ?? start;
    const params = new URLSearchParams({ q });
    if (near) { params.set("lat", String(near.lat)); params.set("lng", String(near.lng)); }
    const response = await fetch(`/viago-mobile/api/places?${params.toString()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.headers.get("content-type")?.includes("json")) throw new Error("Service Adresse GN indisponible.");
    const data = await response.json() as { status: string; results?: AgnPlaceHit[] };
    if (data.status !== "ok" || !Array.isArray(data.results)) return [];
    return data.results
      .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng))
      .map((h, i): Place => {
        const name = h.name.replace(/,/g, " ").trim();
        const parts = [AGN_CATEGORY_LABELS[h.category] ?? "Lieu", h.commune, h.distance_m !== null ? formatPlaceDistance(h.distance_m) : null].filter(Boolean);
        return { place_id: -1000 - i, display_name: name, lat: String(h.lat), lon: String(h.lng), label: name, sub: `${parts.join(" · ")} · ${h.public_number}`, agn: h.public_number };
      });
  }

  // Recherche generique (etapes) : coordonnees, Adresse GN ou lieu (Nominatim, limite a la Guinee).
  async function lookupQuery(q: string): Promise<Place[]> {
    const coordinate = parseCoordinates(q);
    if (coordinate) return [{ place_id: -1, display_name: "Point GPS", lat: String(coordinate.lat), lon: String(coordinate.lng) }];
    if (looksLikeAddressGN(q)) {
      const response = await fetch(`/viago-mobile/api/address/${encodeURIComponent(q)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.headers.get("content-type")?.includes("json")) throw new Error("Service Adresse GN indisponible.");
      const data = await response.json() as AddressGNResponse;
      if (data.status !== "found" || !data.result) throw new Error(data.message || "Cette Adresse GN est introuvable ou n'est pas publique.");
      const r = data.result;
      if (typeof r.lat !== "number" || typeof r.lng !== "number") throw new Error("Cette Adresse GN n'a pas de position GPS publique exploitable.");
      return [{ place_id: -2, display_name: r.name || r.business_name || `Adresse GN ${r.public_number}`, lat: String(r.lat), lon: String(r.lng) }];
    }
    if (q.length < 2) throw new Error("Saisissez au moins deux caractères.");
    const [agn, osm] = await Promise.allSettled([
      searchNamedPlaces(q),
      q.length < 3 ? Promise.resolve([] as Place[]) : fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=gn&limit=5&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } })
        .then(async (res) => { if (!res.ok) throw new Error("osm"); return await res.json() as Place[]; }),
    ]);
    const named = agn.status === "fulfilled" ? agn.value : [];
    const other = osm.status === "fulfilled" ? osm.value.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))) : [];
    if (named.length === 0 && other.length === 0 && agn.status === "rejected" && osm.status === "rejected") throw new Error("Recherche temporairement indisponible.");
    return [...named, ...other];
  }

  async function searchStop(index: number) {
    const q = (stopQueries[index] ?? "").trim();
    if (!q) return;
    setSearching(true);
    setStopPlaces([]);
    try {
      const found = await lookupQuery(q);
      if (found.length === 1 && found[0].place_id < 0) pickStop(index, found[0]);
      else { setStopPlaces(found); if (found.length === 0) setMessage("Aucun lieu trouvé pour cette étape."); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recherche indisponible.");
    } finally {
      setSearching(false);
    }
  }

  function pickStop(index: number, place: Place) {
    const label = place.display_name.split(",").slice(0, 2).join(",");
    setStops((current) => current.map((s, i) => i === index ? { point: { lat: Number(place.lat), lng: Number(place.lon) }, name: label } : s));
    setStopQueries((current) => current.map((q, i) => i === index ? label : q));
    setStopPlaces([]);
    setDirFocus(null);
  }

  function addStop() {
    if (stops.length >= 3) { setMessage("Trois étapes au maximum."); return; }
    setStops((current) => [...current, { point: null, name: "" }]);
    setStopQueries((current) => [...current, ""]);
    setStopPlaces([]);
    setDirFocus(stops.length);
  }

  function removeStop(index: number) {
    setStops((current) => current.filter((_, i) => i !== index));
    setStopQueries((current) => current.filter((_, i) => i !== index));
    setStopPlaces([]);
    setDirFocus(null);
  }

  const refreshAlerts = useCallback(async () => {
    if (!route || route.length < 2) { setAlerts([]); return; }
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const p of route) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); }
    const pad = 0.02;
    try {
      const response = await fetch(`/viago-mobile/api/alerts?bbox=${[minLng - pad, minLat - pad, maxLng + pad, maxLat + pad].map((v) => v.toFixed(5)).join(",")}`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("json")) return;
      const data = await response.json() as { alerts?: ViagoAlert[] };
      if (Array.isArray(data.alerts)) setAlerts(data.alerts);
    } catch { /* signalements facultatifs */ }
  }, [route]);

  useEffect(() => {
    void refreshAlerts();
    if (!route) return;
    const timer = window.setInterval(() => { void refreshAlerts(); }, 45000);
    return () => window.clearInterval(timer);
  }, [route, refreshAlerts]);

  async function sendReport(type: AlertType) {
    const where = livePosition ?? start;
    if (!where) { setMessage("Position GPS indisponible : impossible de placer le signalement."); setReporting(false); return; }
    setReportBusy(true);
    try {
      const response = await fetch("/viago-mobile/api/alerts", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Viago-Device": deviceId() },
        body: JSON.stringify({ type, lat: where.lat, lng: where.lng }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string; merged?: boolean };
      if (!response.ok) throw new Error(data.message || `Signalement refusé (HTTP ${response.status}).`);
      setMessage(data.merged ? `Merci ! « ${ALERT_META[type].label} » confirmé.` : `Merci ! « ${ALERT_META[type].label} » signalé.`);
      void refreshAlerts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signalement impossible.");
    } finally {
      setReportBusy(false);
      setReporting(false);
    }
  }

  async function voteAlert(id: string, vote: "still" | "gone") {
    try {
      await fetch(`/viago-mobile/api/alerts/${encodeURIComponent(id)}/vote`, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Viago-Device": deviceId() },
        body: JSON.stringify({ vote }),
      });
      setMessage(vote === "still" ? "Merci, signalement confirmé." : "Merci, signalement mis à jour.");
      void refreshAlerts();
    } catch { /* hors ligne : on ne bloque pas la conduite */ }
    setSelectedAlertId(null);
  }

  async function shareRoute() {
    if (!end) return;
    const url = new URL("/viago", window.location.origin);
    url.searchParams.set("dlat", end.lat.toFixed(6));
    url.searchParams.set("dlng", end.lng.toFixed(6));
    url.searchParams.set("dname", endName);
    url.searchParams.set("mode", profile);
    const text = `Itinéraire Viago vers ${endName}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Viago", text, url: url.toString() });
        return;
      }
      await navigator.clipboard.writeText(url.toString());
      setMessage("Lien de l’itinéraire copié.");
    } catch {
      /* partage annule par l'utilisateur : rien a signaler */
    }
  }

  function resetAll() {
    clearRoute();
    setStart(null);
    setEnd(null);
    setStops([]);
    setStopQueries([]);
    setStopPlaces([]);
    setStartQuery("");
    setEndQuery("");
    setPlaces([]);
    setDirFocus(null);
    setMessage(null);
  }

  function swapPoints() {
    clearRoute();
    const prevStart = start;
    const prevStartName = startName;
    setStart(end);
    setStartName(endName);
    setEnd(prevStart);
    setEndName(prevStartName);
    setStartQuery(endQuery);
    setEndQuery(startQuery);
    setMessage(null);
  }

  async function positionGps() {
    try {
      const pos = await getViagoCurrentPosition();
      applyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "start", "Ma position actuelle");
      setMessage(`Position GPS obtenue (précision ±${Math.round(pos.coords.accuracy)} m).`);
    } catch {
      setMessage("Position GPS indisponible. Autorisez la localisation ou choisissez le départ sur la carte.");
    }
  }

  // Lien profond depuis Adresse GN : /viago?to=<numéro> fixe la destination
  // et prend la position GPS actuelle comme départ (comme Waze / Google Maps).
  // Reveil anticipe du service Adresse GN (demarrage a froid de l'hebergement).
  useEffect(() => {
    void fetch("/viago-mobile/api/address-warmup", { cache: "no-store" }).catch(() => undefined);
  }, []);
  const [slowSearch, setSlowSearch] = useState(false);
  useEffect(() => {
    if (!searching) { setSlowSearch(false); return; }
    const timer = window.setTimeout(() => setSlowSearch(true), 4000);
    return () => window.clearTimeout(timer);
  }, [searching]);
  // Suggestions instantanees pendant la saisie : lieux Adresse GN par nom (service rapide, cache 2 min).
  // OSM reste sur validation explicite (limitation du service public).
  const liveSuggestToken = useRef(0);
  useEffect(() => {
    if (dirFocus === null || tracking) return;
    const q = (dirFocus === "start" ? startQuery : dirFocus === "end" ? endQuery : (stopQueries[dirFocus] ?? "")).trim();
    if (q.length < 2 || parseCoordinates(q) || looksLikeAddressGN(q)) return;
    const token = ++liveSuggestToken.current;
    const timer = window.setTimeout(() => {
      void searchNamedPlaces(q).then((found) => {
        if (token !== liveSuggestToken.current || found.length === 0) return;
        if (typeof dirFocus === "number") setStopPlaces(found);
        else { setSearchRole(dirFocus); setPlaces(found); }
      }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startQuery, endQuery, stopQueries, dirFocus, tracking]);
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const dlat = Number(params.get("dlat")), dlng = Number(params.get("dlng"));
    const shared = params.get("dlat") !== null && Number.isFinite(dlat) && Number.isFinite(dlng) && Math.abs(dlat) <= 90 && Math.abs(dlng) <= 180;
    if (shared) {
      const mode = params.get("mode");
      if (mode === "car" || mode === "motorcycle" || mode === "foot") setProfile(mode);
      const name = (params.get("dname") ?? "").slice(0, 80) || "Destination partagée";
      void (async () => {
        applyPoint({ lat: dlat, lng: dlng }, "end", name);
        await positionGps();
      })();
      return;
    }
    const target = (params.get("to") ?? "").trim();
    if (!target || target.length > 40) return;
    void (async () => {
      try {
        await resolveAddressGN(target, "end");
        await positionGps();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Adresse GN introuvable.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchDestination(event: React.FormEvent<HTMLFormElement>, role: PointRole) {
    event.preventDefault();
    const q = (role === "start" ? startQuery : endQuery).trim();
    if (!q) return;
    const coordinate = parseCoordinates(q);
    if (coordinate) {
      applyPoint(coordinate, role, role === "start" ? "Départ GPS" : "Destination GPS");
      setPlaces([]);
      return;
    }
    if (q.length < 2) {
      setMessage("Saisissez une Adresse GN ou au moins deux caractères d'un lieu.");
      return;
    }
    setSearching(true);
    setSearchRole(role);
    setPlaces([]);
    setMessage(null);
    try {
      // Adresse GN : GET public sans journalisation de recherche, distinct du routage local.
      if (looksLikeAddressGN(q)) {
        await resolveAddressGN(q, role);
        return;
      }
      // Lieux Adresse GN d'abord (par nom), puis OSM sur validation explicite (limitation du service public OSM).
      const results = await lookupQuery(q);
      setPlaces(results);
      if (results.length === 0) setMessage("Aucun lieu trouvé. Choisissez un point sur la carte.");
    } catch (error) {
      setMessage(looksLikeAddressGN(q)
        ? (error instanceof Error && !(error instanceof TypeError)
            ? error.message : "Service Adresse GN indisponible. Vérifiez que l'API Adresse GN est accessible.")
        : "Recherche de lieux indisponible. Vous pouvez choisir la destination sur la carte.");
    } finally {
      setSearching(false);
    }
  }

  function applyCoordinateFields() {
    const lat = Number(latitude.trim().replace(",", "."));
    const lng = Number(longitude.trim().replace(",", "."));
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) ||
        !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setMessage("Coordonnées GPS invalides.");
      return;
    }
    applyPoint({ lat, lng }, selection, selection === "start" ? "Départ GPS" : "Destination GPS");
  }

  function loadSample() {
    clearRoute();
    setStart(SAMPLE_START);
    setEnd(SAMPLE_END);
    setStartName("Conakry — départ test");
    setEndName("Conakry — arrivée test");
    setSelection("end");
    setStartQuery("Conakry — départ test");
    setEndQuery("Conakry — arrivée test");
    setMessage("Trajet témoin chargé. Calcul automatique en cours dès que l’API est accessible.");
    setSheetOpen(true);
  }

  // Recalcule sans clic supplémentaire lorsque départ, arrivée ou profil changent.
  // Les requêtes précédentes sont annulées pour ne jamais afficher une route périmée.
  // Alternatives : demandees apres l'affichage du trajet principal (le calcul est plus long).
  const loadAlternatives = useCallback(async (main: RouteCandidate, generation: number) => {
    if (!start || !end) return;
    setAltBusy(true);
    try {
      // Une alternative a la fois : la premiere s'affiche des qu'elle est prete.
      for (const wanted of [1, 2]) {
        const response = await fetch("/viago-mobile/api/route", {
          method: "POST", cache: "no-store", signal: AbortSignal.timeout(60000),
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            profile, start_latitude: start.lat, start_longitude: start.lng,
            end_latitude: end.lat, end_longitude: end.lng, alternatives: wanted,
          }),
        });
        if (!response.ok || altGeneration.current !== generation) return;
        const data = await response.json() as { alternatives?: unknown };
        if (altGeneration.current !== generation || !Array.isArray(data.alternatives)) return;
        const parsed: RouteCandidate[] = [];
        for (const raw of data.alternatives.slice(0, wanted)) {
          const alt = raw as RouteResult;
          const line = validLine(alt, profile);
          const maneuvers = verifiedManeuvers(alt.maneuvers);
          const distanceM = typeof alt.distance_m === "number" && Number.isFinite(alt.distance_m) && alt.distance_m >= 0 ? alt.distance_m : null;
          const durationS = typeof alt.duration_s === "number" && Number.isFinite(alt.duration_s) && alt.duration_s >= 0 &&
            alt.duration_source === "profile_effective_speed" ? alt.duration_s : null;
          if (line && maneuvers.length > 0 && distanceM !== null) parsed.push({ line, distance: distanceM, duration: durationS, maneuvers });
        }
        if (parsed.length > 0) setCandidates([main, ...parsed]);   // ordre stable : le choix de l'utilisateur reste valide
        if (parsed.length < wanted) return;   // pas d'autre alternative utile
      }
    } catch {
      /* alternatives facultatives : le trajet principal reste utilisable */
    } finally {
      if (altGeneration.current === generation) setAltBusy(false);
    }
  }, [start, end, profile]);

  const calculate = useCallback(async () => {
    if (!start || !end) return;
    routeRequest.current?.abort();
    const controller = new AbortController();
    routeRequest.current = controller;
    setBusy(true);
    setManeuvers([]);
    setRoute(null);
    setDistance(null);
    setSurface(null);
    altGeneration.current += 1;
    setCandidates([]);
    setChosenRoute(0);
    setAltBusy(false);
    setDuration(null);
    setArrivalAt(null);
    stopTracking();
    setMessage("Calcul automatique de l’itinéraire…");
    try {
      const viaPoints = stops.filter((s): s is { point: ViagoPoint; name: string } => s.point !== null);
      if (viaPoints.length > 0) {
        // Plusieurs etapes : un calcul par troncon, puis assemblage (pas d'alternatives dans ce mode).
        const waypoints = [start, ...viaPoints.map((s) => s.point), end];
        let mergedLine: ViagoPoint[] = [];
        const mergedManeuvers: ViagoManeuver[] = [];
        let totalDistance = 0;
        let totalDuration: number | null = 0;
        for (let leg = 0; leg < waypoints.length - 1; leg++) {
          const a = waypoints[leg], b = waypoints[leg + 1];
          const legResponse = await fetch("/viago-mobile/api/route", {
            method: "POST", cache: "no-store", signal: controller.signal,
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ profile, start_latitude: a.lat, start_longitude: a.lng, end_latitude: b.lat, end_longitude: b.lng }),
          });
          if (controller.signal.aborted) return;
          if (!legResponse.ok) throw new Error(`Calcul d’itinéraire indisponible (HTTP ${legResponse.status}).`);
          const legData = await legResponse.json() as RouteResult;
          if (controller.signal.aborted) return;
          const legLine = validLine(legData, profile);
          const legManeuvers = verifiedManeuvers(legData.maneuvers);
          const legDistance = typeof legData.distance_m === "number" && Number.isFinite(legData.distance_m) && legData.distance_m >= 0 ? legData.distance_m : null;
          if (!legLine || legManeuvers.length === 0 || legDistance === null) {
            setMessage(`Aucun trajet vérifié ${leg === 0 ? "jusqu’à l’étape 1" : leg === waypoints.length - 2 ? "vers la destination" : `entre les étapes ${leg} et ${leg + 1}`}.`);
            return;
          }
          const last = leg === waypoints.length - 2;
          for (const m of legManeuvers) {
            if (leg > 0 && m.kind === "depart") continue;
            if (!last && m.kind === "arrive") {
              mergedManeuvers.push({ kind: "continue", modifier: "straight", distanceFromStartM: totalDistance + m.distanceFromStartM, streetName: `Étape ${leg + 1}` });
            } else {
              mergedManeuvers.push({ ...m, distanceFromStartM: totalDistance + m.distanceFromStartM });
            }
          }
          mergedLine = mergedLine.length === 0 ? legLine : [...mergedLine, ...legLine.slice(1)];
          totalDistance += legDistance;
          const legDuration = typeof legData.duration_s === "number" && Number.isFinite(legData.duration_s) && legData.duration_s >= 0 &&
            legData.duration_source === "profile_effective_speed" ? legData.duration_s : null;
          totalDuration = totalDuration !== null && legDuration !== null ? totalDuration + legDuration : null;
        }
        setMapView("overview");
        setRoute(mergedLine);
        setManeuvers(mergedManeuvers);
        setDistance(totalDistance);
        setDuration(totalDuration);
        setArrivalAt(totalDuration !== null ? Date.now() + totalDuration * 1000 : null);
        setCandidates([{ line: mergedLine, distance: totalDistance, duration: totalDuration, maneuvers: mergedManeuvers }]);
        setChosenRoute(0);
        chosenRouteRef.current = 0;
        setMessage(null);
        return;
      }
      // The local Viago lab is loopback-only and explicitly rejects remote clients.
      // No Supabase session is required for public navigation testing.
      const response = await fetch("/viago-mobile/api/route", {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          profile, start_latitude: start.lat, start_longitude: start.lng,
          end_latitude: end.lat, end_longitude: end.lng,
        }),
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 404) throw new Error("API Viago non activée sur le serveur de routage.");
        if (response.status === 401 || response.status === 403) throw new Error("Accès au moteur Viago refusé (origine non autorisée ou jeton invalide). Relancez lancer_viago_national.ps1.");
        throw new Error(`Calcul d’itinéraire indisponible (HTTP ${response.status}).`);
      }
      const data = await response.json() as RouteResult;
      if (controller.signal.aborted) return;
      const line = validLine(data, profile);
      if (!line) {
        setMessage(data.status === "tie_requires_policy"
          ? "Plusieurs itinéraires équivalents : arbitrage nécessaire. Aucun tracé inventé."
          : data.status === "no_routable_start"
          ? "Le départ est trop loin d’une route praticable pour ce mode (plus de 1 km). Déplacez le départ."
          : data.status === "no_routable_end"
          ? "La destination est trop loin d’une route praticable pour ce mode (plus de 1 km)."
          : "Aucun trajet routable vérifié pour ce profil entre ces points.");
        return;
      }
      setMapView("overview");
      setRoute(line);
      setManeuvers(verifiedManeuvers(data.maneuvers));
      setSurface(verifiedSurface(data.surface));
      setDistance(typeof data.distance_m === "number" && Number.isFinite(data.distance_m) && data.distance_m >= 0
        ? data.distance_m : null);

      const nextDuration =
        typeof data.duration_s === "number" &&
        Number.isFinite(data.duration_s) &&
        data.duration_s >= 0 &&
        data.duration_source === "profile_effective_speed"
          ? data.duration_s
          : null;

      setDuration(nextDuration);
      setArrivalAt(
        nextDuration !== null
          ? Date.now() + nextDuration * 1000
          : null
      );
      setMessage(null);
      if (typeof data.distance_m === "number" && Number.isFinite(data.distance_m)) {
        const mainCandidate: RouteCandidate = { line, distance: data.distance_m, duration: nextDuration, maneuvers: verifiedManeuvers(data.maneuvers) };
        setCandidates([mainCandidate]);
        setChosenRoute(0);
        chosenRouteRef.current = 0;
        void loadAlternatives(mainCandidate, altGeneration.current);
      }
      // On small screens, reveal the actual computed route instead of
      // keeping the full-height search panel over the map.
      if (window.matchMedia("(max-width: 767px)").matches) {
        setSheetOpen(false);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : "Erreur de calcul du trajet.");
      }
    } finally {
      if (routeRequest.current === controller) {
        routeRequest.current = null;
        setBusy(false);
      }
    }
  }, [start, end, stops, profile, stopTracking, loadAlternatives]);

  useEffect(() => {
    if (!start || !end) return;
    const timeout = window.setTimeout(() => { void calculate(); }, 400);
    return () => {
      window.clearTimeout(timeout);
      routeRequest.current?.abort();
    };
  }, [start, end, stops, profile, calculate]);

  // G1-P4: verified, local routing only. Keep the last route if the retry fails.
  // The source is a fresh GPS fix after three independent off-route confirmations.
  const recalculateFromGps = useCallback(async (position: ViagoPoint, generation: number) => {
    if (!end || rerouteRequest.current !== null || watchGeneration.current !== generation ||
        pointDistanceM(position, end) <= 60) return;
    const controller = new AbortController();
    rerouteRequest.current = controller;
    setMessage("Écart à l’itinéraire confirmé : recherche d’un nouveau trajet…");
    try {
      const response = await fetch("/viago-mobile/api/route", {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          profile, start_latitude: position.lat, start_longitude: position.lng,
          end_latitude: end.lat, end_longitude: end.lng,
        }),
      });
      if (controller.signal.aborted || watchGeneration.current !== generation) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as RouteResult;
      if (controller.signal.aborted || watchGeneration.current !== generation) return;
      const line = validLine(data, profile);
      const newManeuvers = verifiedManeuvers(data.maneuvers);
      // Never replace the current route with an incomplete backend result.
      const newDistance = typeof data.distance_m === "number" && Number.isFinite(data.distance_m) &&
        data.distance_m >= 0 ? data.distance_m : null;
      if (!line || newManeuvers.length === 0 || newDistance === null)
        throw new Error("trajet non vérifié");
      const newDuration = typeof data.duration_s === "number" && Number.isFinite(data.duration_s) &&
        data.duration_s >= 0 && data.duration_source === "profile_effective_speed"
          ? data.duration_s : null;
      // Change geometry without changing planner start/end: the existing start/end
      // effect would otherwise stop the native GPS watcher.
      routeForGps.current = line;
      previousRouteMatch.current = null;
      recentRouteObservations.current = [];
      roadLock.current = initialRoadLock();
      pedestrianGate.current = freshPedestrianGate();
      setPedestrianGpsPosition(null);
      visualGpsFix.current = null;
      setLastConfirmedGuidance(null);
      setRouteProgress(null);
      setRoute(line);
      setManeuvers(newManeuvers);
      setSurface(verifiedSurface(data.surface));
      setDistance(newDistance);
      setDuration(newDuration);
      setArrivalAt(newDuration !== null ? Date.now() + newDuration * 1000 : null);
      setMessage("Itinéraire recalculé. Guidage GPS poursuivi.");
    } catch {
      if (!controller.signal.aborted && watchGeneration.current === generation) {
        setMessage("Recalcul indisponible : ancien itinéraire conservé. Vérifiez la route devant vous.");
      }
    } finally {
      if (rerouteRequest.current === controller) rerouteRequest.current = null;
    }
  }, [end, profile]);

  function startTracking() {
    if (!route) {
      setMessage("Le suivi GPS nécessite un itinéraire valide et la géolocalisation.");
      return;
    }
    if (watchId.current !== null || watchStarting.current) return;
    watchStarting.current = true;
    setFollow(true);
    setLivePosition(null);
    setGpsAccuracy(null);
    setGpsSpeedKmh(null);
    setRouteProgress(null);
    rerouteGate.current = freshOffRouteGate();
    previousRouteMatch.current = null;
    recentRouteObservations.current = [];
    roadLock.current = initialRoadLock();
    pedestrianGate.current = freshPedestrianGate();
    setPedestrianGpsPosition(null);
    visualGpsFix.current = null;
    motionGate.current = null;
    setMotionPhase("uncertain");
    lastHeading.current = null;
    lastHeadingObservation.current = null;
    setVehicleHeading(null);
    setGpsSignal("waiting");
    lastGpsSampleAt.current = Date.now();
    lastWatchRestartAt.current = Date.now();
    locationDenied.current = false;
    setGpsPermissionDenied(false);

    const generation = ++watchGeneration.current;
    setGpsSource(viagoGpsSource());
    setTracking(true);
    setMessage(null);
    setSheetOpen(false);
    // Annonce de depart : declenchee par le toucher sur "Demarrer" (autorisation audio du navigateur).
    if (voiceEnabled) {
      const first = maneuvers.find((m) => m.kind !== "depart");
      const sentence = !first ? "" : first.kind === "arrive"
        ? " Vous arriverez directement à destination."
        : ` ${spokenDistance(first.distanceFromStartM)}, ${maneuverTitle(first).toLowerCase()}${first.streetName ? ` sur ${first.streetName}` : ""}.`;
      void speakViagoFrench(`Allons-y !${sentence}`).catch(() => undefined);
    }
    const openGpsWatch = async (requestPermission = false) => {
      if (watchGeneration.current !== generation || locationDenied.current || watchStarting.current) return;
      // The previous watch must finish clearing before any retry.
      watchStarting.current = true;
      const previousWatch = watchId.current;
      watchId.current = null;
      if (previousWatch) await Promise.resolve(previousWatch.stop());
      if (watchGeneration.current !== generation || locationDenied.current) {
        watchStarting.current = false;
        return;
      }
      void watchViagoPosition(
        (pos) => {
          if (watchGeneration.current !== generation) return;
          lastGpsSampleAt.current = Date.now();
          if (gpsTelemetry.current) recordGpsSample(gpsTelemetry.current, pos, lastGpsSampleAt.current);

          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          const age = Date.now() - pos.timestamp;
          setGpsAccuracy(Number.isFinite(accuracy) ? accuracy : null);

          const coordinatesOk =
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            Math.abs(lat) <= 90 &&
            Math.abs(lng) <= 180;

          const accuracyOk =
            Number.isFinite(accuracy) &&
            accuracy >= 0 &&
            accuracy <= MAX_GPS_ACCURACY_M;

          const ageOk =
            Number.isFinite(pos.timestamp) &&
            age >= -1000 &&
            age <= MAX_GPS_SAMPLE_AGE_MS;

          setGpsSpeedKmh(null);

          if (!coordinatesOk) {
            if (gpsTelemetry.current) gpsTelemetry.current.rejectedInvalid++;
            setGpsSignal("invalid");
            setRouteProgress(null);
            return;
          }

          // A location may still be useful for the camera when it is too uncertain
          // for progress matching. Never move the camera with stale coordinates.
          if (!ageOk) {
            if (gpsTelemetry.current) gpsTelemetry.current.rejectedStale++;
            setGpsSignal("stale");
            return;
          }

          const visualFixOk = Number.isFinite(accuracy) && accuracy >= 0 &&
            accuracy <= MAX_GPS_VISUAL_ACCURACY_M;
          // P3-P2-R2: visual estimate only; no confirmed route progress.
          if (!accuracyOk) {
            if (gpsTelemetry.current) gpsTelemetry.current.rejectedAccuracy++;
            setGpsSignal("imprecise");
            setRouteProgress(null);

            if (visualFixOk && mapLibreEnabled) {
              const visual = fuseVisualGpsFix(visualGpsFix.current, {
                point: { lat, lng },
                at: pos.timestamp,
                accuracyM: accuracy,
              });
              if (visual) {
                visualGpsFix.current = visual;
                setLivePosition(visual.point);
              }
            }
            return;
          }

          const now = Date.now();
          const rawPosition = { lat, lng };
          // Walking: show the latest GPS *estimate* and its uncertainty on the map
          // even while manoeuvre progress is not yet confirmed.
          if (profile === "foot" && visualFixOk) setPedestrianGpsPosition(rawPosition);
          const previous = previousRouteMatch.current;
          const activeRoute = routeForGps.current;
          const result = activeRoute && activeRoute.length >= 2 ? matchRouteProgress(
            activeRoute, rawPosition, accuracy,
            previous?.meters ?? null,
            previous ? (now - previous.at) / 1000 : null,
          ) : null;
          // C14-P4-C: reject implausible jumps along the *existing* route.
          // Never infer a new road from an uncertain GPS fix.
          const dt = previous ? Math.max(0, (now - previous.at) / 1000) : 0;
          const maxSpeedMps = profile === "foot" ? 4 : profile === "motorcycle" ? 38 : 45;
          const continuityOk = viagoGpsSource() !== "android-native" || (
            result?.status === "on_route" && (!previous || (
              result.travelledMeters >= previous.meters - Math.max(12, accuracy * 0.5) &&
              result.travelledMeters <= previous.meters +
                Math.max(25, dt * maxSpeedMps + Math.min(accuracy, 20))
            ))
          );
          const speedMps = typeof pos.coords.speed === "number" && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0
            ? pos.coords.speed : null;
          // C13-P1-R1: protect MapLibre navigation from stationary GPS drift.
          // The browser speed alone is not proof of real vehicle movement.
          const wasMoving = profile === "foot" && viagoGpsSource() === "android-native"
            ? pedestrianGate.current.phase === "moving"
            : motionGate.current?.phase === "moving";
          // C14-P3: on Android, native speed corroborates a sequence of actual
          // displacements. A speed reading alone NEVER unlocks the vehicle.
          // Browser/Leaflet logic remains unchanged.
          const motion = mapLibreEnabled ? (
            viagoGpsSource() === "android-native"
              ? updateNativeMotionGate(motionGate.current, {
                  point: rawPosition, at: pos.timestamp, accuracyM: accuracy,
                  speedMps,
                })
              : updateMotionGate(motionGate.current, {
                  point: rawPosition, at: pos.timestamp, accuracyM: accuracy,
                })
          ) : null;
          if (motion) motionGate.current = motion;
          // C14-P4-D: the native route lock accepts only corroborated motion,
          // unambiguous geometry and physically plausible forward progression.
          // Existing browser matching is untouched.
          const androidNative = viagoGpsSource() === "android-native";
          // A pedestrian needs independent slow-motion confirmation; the native
          // vehicle gate can legitimately remain uncertain at walking speed.
          const footDecision = androidNative && profile === "foot"
            ? nextPedestrianGate(pedestrianGate.current, {
                at: pos.timestamp, point: rawPosition, accuracyM: accuracy,
                speedMps, travelledM: result?.status === "on_route" ? result.travelledMeters : null,
              }) : null;
          if (footDecision) pedestrianGate.current = footDecision.state;
          const effectivePhase = footDecision?.state.phase ?? motion?.phase ?? "uncertain";
          setMotionPhase(effectivePhase);
          if (gpsTelemetry.current && motion) {
            if (effectivePhase === "moving") gpsTelemetry.current.motionMoving++;
            else if (effectivePhase === "stationary") gpsTelemetry.current.motionStationary++;
            else gpsTelemetry.current.motionUncertain++;
          }
          // Only sustained, fresh, high-quality off-route motion initiates a retry.
          // Stationary drift, ambiguous matching and inaccurate GPS NEVER do.
          const rerouteCheck = nextOffRouteGate(rerouteGate.current, {
            at: now, accuracyM: accuracy,
            status: result?.status ?? "none",
            lateralMeters: result?.status === "off_route" ? result.lateralMeters : null,
            moving: androidNative && motion?.phase === "moving",
          });
          rerouteGate.current = rerouteCheck.state;
          if (rerouteCheck.shouldReroute && rerouteRequest.current === null) {
            void recalculateFromGps(rawPosition, generation);
          }
          const nativeDecision = androidNative && profile !== "foot" && motion?.phase === "moving" &&
            continuityOk && result?.status === "on_route" ? updateRoadLock(roadLock.current, {
              route: activeRoute ?? [], raw: rawPosition, accuracyM: accuracy,
              travelledMeters: result.travelledMeters, at: now,
              speedMps, maxSpeedMps,
            }) : null;
          if (nativeDecision) roadLock.current = nativeDecision.state;
          if (gpsTelemetry.current && androidNative && motion?.phase === "moving") {
            if (nativeDecision?.accepted) gpsTelemetry.current.roadAccepted++;
            else gpsTelemetry.current.roadRejected++;
          }
          const confirmedResult = androidNative
            ? (profile === "foot"
                ? (footDecision?.confirmed && continuityOk ? result : null)
                : (nativeDecision?.accepted ? result : null))
            : (continuityOk ? result : null);
          if (gpsTelemetry.current) {
            const d = gpsDbg.current;
            const st = result?.status ?? "none";
            d.phase = effectivePhase; d.acc = Math.round(accuracy * 10) / 10;
            d.spd = speedMps === null ? null : Math.round(speedMps * 3.6);
            d.route = st; d.cont = continuityOk;
            d.routes[st] = (d.routes[st] ?? 0) + 1;
            if (!continuityOk) d.contFail++;
            d.lock = nativeDecision ? nativeDecision.reason : "-";
            if (nativeDecision) d.locks[nativeDecision.reason] = (d.locks[nativeDecision.reason] ?? 0) + 1;
            if (confirmedResult?.status === "on_route") d.confirmed++;
          }
          setGpsSignal("valid");
          // G1-P3: speed is displayed only after corroborated motion. Prefer
          // Android's speed when plausible; otherwise derive it from two
          // accepted route positions, not from raw GPS drift or camera motion.
          const acceptedRouteSpeed = confirmedResult?.status === "on_route" &&
            effectivePhase === "moving"
              ? confirmedRouteSpeedKmh(previousRouteMatch.current, {
                  travelledMeters: confirmedResult.travelledMeters, at: now,
                }, accuracy, maxSpeedMps)
              : null;
          const nativeSpeed = speedMps !== null && speedMps >= 0.5 &&
            speedMps <= maxSpeedMps ? Math.round(speedMps * 3.6) : null;
          // A recent pedestrian lock permits the independently reported Android
          // speed between route-progress confirmations. Never infer movement from
          // camera updates, and expire the permission after 20 seconds.
          const recentFootLock = profile === "foot" &&
            pedestrianGate.current.lastAccepted !== null &&
            now - pedestrianGate.current.lastAccepted.at >= 0 &&
            now - pedestrianGate.current.lastAccepted.at <= 20000;
          // Vitesse affichée comme Waze : valeur Doppler d'Android dès 2 km/h, 0 à l'arrêt,
          // tant que le point GPS est précis. Aucune coordonnée n'est inventée ici.
          const directKmh = androidNative && speedMps !== null && accuracy <= 25 &&
            speedMps <= maxSpeedMps ? (speedMps < 0.5 ? 0 : Math.round(speedMps * 3.6)) : null;
          if (directKmh !== null) setGpsSpeedKmh(directKmh); else
          setGpsSpeedKmh(effectivePhase === "stationary" ? 0 :
            effectivePhase === "uncertain" ? null :
            androidNative ? (profile === "foot"
              ? (recentFootLock ? nativeSpeed ?? acceptedRouteSpeed : null)
              : (confirmedResult?.status === "on_route" ? nativeSpeed ?? acceptedRouteSpeed : null))
              : (speedMps === null ? null : Math.round(speedMps * 3.6)));
          if (motion && effectivePhase !== "moving") {
            // No route progress, new heading or camera step on uncertain/still GPS.
            setRouteProgress(null);
            setVehicleHeading(null);
            lastHeading.current = null;
            lastHeadingObservation.current = null;
            if (!visualGpsFix.current && motion.anchorAt > 0) {
              visualGpsFix.current = { point: motion.anchor, at: pos.timestamp, accuracyM: accuracy };
              setLivePosition(motion.anchor);
            }
            return;
          }
          if (motion && !wasMoving) visualGpsFix.current = null;
          setRouteProgress(confirmedResult);
          // Snap only a non-ambiguous GPS-to-route match; never snap to a merely nearby road.
          if (confirmedResult?.status === "on_route") {
            recentRouteObservations.current = appendRouteObservation(
              recentRouteObservations.current,
              { point: rawPosition, accuracyM: accuracy, travelledM: confirmedResult.travelledMeters, at: now },
            );
          } else {
            recentRouteObservations.current = [];
          }
          const matchedPoint = confirmedResult?.status === "on_route" && activeRoute
            ? corroboratedRoutePosition(activeRoute, rawPosition, confirmedResult.travelledMeters,
                accuracy, recentRouteObservations.current) : null;
          // P6-C13-P1: only MapLibre uses the camera-only temporal GPS filter.
          // Leaflet, route matching, confirmed progress and manoeuvres are unchanged.
          if (visualFixOk) {
            if (mapLibreEnabled) {
              const visual = fuseVisualGpsFix(visualGpsFix.current, {
                point: matchedPoint ?? rawPosition, at: pos.timestamp, accuracyM: accuracy,
              });
              if (visual) {
                visualGpsFix.current = visual;
                setLivePosition(visual.point);
              }
            } else {
              setLivePosition(matchedPoint ?? rawPosition);
            }
          }
          if (confirmedResult?.status === "on_route") {
            previousRouteMatch.current = { meters: confirmedResult.travelledMeters, at: now };
            setLastConfirmedGuidance({
              travelledMeters: confirmedResult.travelledMeters,
              remainingMeters: confirmedResult.remainingMeters,
              at: now,
            });
          }

          // Prefer the Android GPS course at genuine movement speed. Otherwise derive
          // bearing only from sufficiently separated, fresh reliable observations.
          const gpsCourse = pos.coords.heading;
          let nextHeading: number | null =
            speedMps !== null && speedMps >= 1.5 && typeof gpsCourse === "number" &&
            Number.isFinite(gpsCourse) && gpsCourse >= 0 && gpsCourse < 360 ? gpsCourse : null;
          const last = lastHeadingObservation.current;
          if (nextHeading === null && last) {
            const seconds = (now - last.at) / 1000;
            const moved = pointDistanceM(last.point, rawPosition);
            if (seconds > 0.8 && seconds <= 20 && moved >= Math.max(12, accuracy * 0.75) &&
                (speedMps === null || speedMps >= 1.5)) {
              nextHeading = movementBearing(last.point, rawPosition);
            }
          }
          if (nextHeading !== null && (matchedPoint !== null || confirmedResult?.status === "on_route")) {
            const updated = smoothBearing(lastHeading.current, nextHeading);
            lastHeading.current = updated;
            setVehicleHeading(updated);
          }
          if (!last || now - last.at > 2000) lastHeadingObservation.current = { point: rawPosition, at: now };
        },
        (error) => {
          if (watchGeneration.current !== generation) return;
          if (gpsTelemetry.current) {
            gpsTelemetry.current.nativeErrors++;
            if (error.code === 1) gpsTelemetry.current.permissionErrors++;
            gpsTelemetry.current.lastErrorAt = Date.now();
          }
          if (error.code === 1) {
            // A denied permission must never trigger an automatic retry.
            locationDenied.current = true;
            setGpsPermissionDenied(true);
            restartGpsWatch.current = null;
            watchId.current?.stop();
            watchId.current = null;
            setGpsSignal("invalid");
            setGpsSpeedKmh(null);
            setMessage("Localisation refusée : guidage GPS indisponible.");
            return;
          }
          // Intermittent GPS unavailability must not close active navigation.
          // Retain the last reliable camera position; no synthetic progress.
          // A transient native callback error may occur while the watcher
          // remains active. Keep a recent good fix until it actually expires.
          if (Date.now() - lastGpsSampleAt.current >= GPS_STALE_AFTER_MS) {
            setGpsSignal("stale");
            setRouteProgress(null);
          }
          setGpsSpeedKmh(null);
        },
        { requestPermission },
      ).then(watch => {
        if (watchGeneration.current !== generation) { watch.stop(); return; }
        watchStarting.current = false;
        watchId.current = watch;
        setGpsSource(watch.source);
        setGpsPermissionDenied(false);
        console.info("VIAGO_GPS_SOURCE", watch.source);
      }).catch((error: unknown) => {
        if (watchGeneration.current !== generation) return;
        if (gpsTelemetry.current) {
          gpsTelemetry.current.nativeErrors++;
          gpsTelemetry.current.lastErrorAt = Date.now();
        }
        watchStarting.current = false;
        const denied = error !== null && typeof error === "object" &&
          "code" in error && (error.code === 1 || error.code === "OS-PLUG-GLOC-0003");
        if (denied) {
          if (gpsTelemetry.current) gpsTelemetry.current.permissionErrors++;
          locationDenied.current = true;
          setGpsPermissionDenied(true);
          restartGpsWatch.current = null;
          setGpsSignal("invalid");
          setMessage("Autorisation de localisation refusée. Vérifiez les paramètres Android.");
          return;
        }
        // Do not end navigation or erase the last reliable position.
        setGpsSignal("stale");
        setGpsSpeedKmh(null);
        setRouteProgress(null);
      });
    };
    restartGpsWatch.current = () => { void openGpsWatch(false); };
    retryGpsPermission.current = () => {
      if (watchGeneration.current !== generation) return;
      locationDenied.current = false;
      setGpsPermissionDenied(false);
      void openGpsWatch(true);
    };
    watchStarting.current = false;
    void openGpsWatch(true);
  }

  // G1-P2: never invent turns or advance along a route from uncertain GPS.
  // Only the backend-provided offsets and an accepted road lock count as live
  // guidance. At rest, a recent last verified point may be shown as FROZEN.
  // Walking advances manoeuvres only at corroborated fixes. Between these,
  // retain a clearly labelled frozen last-confirmed distance (up to 60 s).
  const guidancePhase = profile === "foot" && motionPhase === "moving" &&
    routeProgress === null && lastConfirmedGuidance !== null
      ? "stationary" : motionPhase;
  const guidance = deriveViagoGuidance({
    maneuvers, gpsSignal, motionPhase: guidancePhase, routeProgress,
    lastConfirmed: lastConfirmedGuidance, nowMs: guidanceClock,
  });
  const nextManeuver = guidance.nextIndex >= 0 ? maneuvers[guidance.nextIndex] : null;
  const followingManeuver = guidance.nextIndex >= 0
    ? (maneuvers[guidance.nextIndex + 1] ?? null) : null;
  const metersToManeuver = guidance.metersToTurn;
  const guidanceDistanceLabel = guidance.mode === "live" ? "Suivi GPS routier confirmé"
    : guidance.mode === "held" ? (profile === "foot" && motionPhase === "moving"
        ? "Dernier point routier confirmé (marche en cours)"
        : "Dernière position routière confirmée (à l'arrêt)")
    : guidance.mode === "planned" ? "Depuis le départ prévu (indicatif)"
    : "Position routière non confirmée";
  // G1-P5-P1: only approved backend maneuver and moving, LIVE road position
  // can trigger speech; held, planned and uncertain fixes remain silent.
  useEffect(() => {
    const planned = planViagoVoice({
      enabled: voiceEnabled, tracking, profile,
      guidanceMode: guidance.mode, gpsSignal, motionPhase,
      accuracyM: gpsAccuracy, distanceM: guidance.metersToTurn,
      nextIndex: guidance.nextIndex, maneuver: nextManeuver,
      routeEpoch: voiceRouteEpoch.current, spoken: spokenVoiceKeys.current,
    });
    if (!planned) return;
    spokenVoiceKeys.current.add(planned.key);
    const announcedEpoch = voiceRouteEpoch.current;
    void speakViagoFrench(planned.text).then(() => {
      // Native TTS has accepted the command; actual audibility is field-tested.
      if (voiceRouteEpoch.current === announcedEpoch) {
        const announcedAt = Date.now();
        setLastAutomaticVoice({ text: planned.text, at: announcedAt, epoch: announcedEpoch, nextIndex: guidance.nextIndex });
        setLastReplayVoiceAt(null);
        setGuidanceClock(announcedAt);
      }
    }).catch(error => {
      setVoiceError(error instanceof Error ? error.message : "Lecture vocale impossible.");
      setVoiceEnabled(false);
    });
  }, [tracking, voiceEnabled, profile, guidance.mode, guidance.metersToTurn,
      guidance.nextIndex, nextManeuver, gpsSignal, gpsAccuracy, motionPhase]);

  // G1-P5-P3: re-listen only to a recent, already accepted instruction for
  // this exact route and maneuver; never replay a speculative/held position.
  const replayVoiceText = selectViagoVoiceReplay({
    enabled: voiceEnabled, tracking, profile, guidanceMode: guidance.mode,
    gpsSignal, accuracyM: gpsAccuracy, nextIndex: guidance.nextIndex,
    routeEpoch: voiceRouteEpoch.current, nowMs: guidanceClock,
    last: lastAutomaticVoice,
  });
  const canReplayVoice = replayVoiceText !== null && !voiceReplayBusy;
  async function replayVoiceInstruction() {
    if (!canReplayVoice || replayVoiceText === null) return;
    const token = ++voiceReplayToken.current;
    setVoiceReplayBusy(true);
    setVoiceError(null);
    try {
      // This is a manual request, not a new auto-announcement stage.
      await speakViagoFrench(replayVoiceText);
      if (token === voiceReplayToken.current) {
        const replayedAt = Date.now();
        setLastReplayVoiceAt(replayedAt);
        setGuidanceClock(replayedAt);
      }
    } catch (error) {
      if (token === voiceReplayToken.current) {
        setVoiceError(error instanceof Error ? error.message : "Répétition vocale impossible.");
      }
    } finally {
      if (token === voiceReplayToken.current) setVoiceReplayBusy(false);
    }
  }

  // G1-P5-P2: observable status explains why an automatic instruction was
  // sent or withheld. Never use the visual/raw GPS estimate to trigger sound.
  const voiceInputs = {
    enabled: voiceEnabled, tracking, profile,
    guidanceMode: guidance.mode, gpsSignal, motionPhase,
    accuracyM: gpsAccuracy, distanceM: guidance.metersToTurn,
    nextIndex: guidance.nextIndex, maneuver: nextManeuver,
    routeEpoch: voiceRouteEpoch.current, spoken: spokenVoiceKeys.current,
  };
  const recentAutomaticVoice = lastAutomaticVoice !== null &&
    lastAutomaticVoice.epoch === voiceRouteEpoch.current &&
    lastAutomaticVoice.nextIndex === guidance.nextIndex &&
    guidanceClock - lastAutomaticVoice.at >= 0 &&
    guidanceClock - lastAutomaticVoice.at <= 15000;
  const recentReplay = lastReplayVoiceAt !== null &&
    guidanceClock >= lastReplayVoiceAt && guidanceClock - lastReplayVoiceAt <= 8000;
  const voiceStatus = !voiceEnabled ? null : voiceError ? "Voix : erreur audio" :
    recentReplay ? "Voix : instruction répétée" :
    recentAutomaticVoice ? "Voix : annonce envoyée" : describeViagoVoice(voiceInputs);

  // G1-P4-P3: never replace verified trip metrics with arbitrary live values.
  // At a temporary lost route lock, freeze the last accepted snapshot (max 2 min).
  // Its ETA is anchored to the actual confirmation timestamp; it does not drift.
  const tripEstimate = deriveViagoTripEstimate({
    routeDistanceM: distance, routeDurationS: duration, routeArrivalAtMs: arrivalAt,
    guidanceMode: guidance.mode, liveRemainingM: guidance.remainingMeters,
    lastConfirmed: lastConfirmedGuidance, nowMs: guidanceClock,
  });
  const confirmedRemainingM = tripEstimate.remainingMeters;
  const displayedDurationS = tripEstimate.durationS;
  const displayedArrivalAt = tripEstimate.arrivalAtMs;
  const chooseCandidate = (index: number) => {
    const c = candidates[index];
    if (!c || tracking) return;
    setChosenRoute(index);
    chosenRouteRef.current = index;
    setRoute(c.line);
    setManeuvers(c.maneuvers as ViagoManeuver[]);
    setDistance(c.distance);
    setDuration(c.duration);
    setArrivalAt(c.duration !== null ? Date.now() + c.duration * 1000 : null);
    setSurface(null);
  };
  const previewShown = !tracking && route !== null && distance !== null;
  const dirSuggestions: Suggestion[] = (() => {
    const source = dirFocus === null ? [] : typeof dirFocus === "number" ? stopPlaces : (searchRole === dirFocus ? places : []);
    return source.map((p, i) => ({ id: String(i), label: p.label ?? p.display_name.split(",")[0], sub: p.sub ?? p.display_name.split(",").slice(1, 3).join(",").trim(), agn: Boolean(p.agn) }));
  })();
  const alongForAlerts = distance !== null && confirmedRemainingM !== null ? Math.max(0, distance - confirmedRemainingM) : 0;
  const alongBucket = Math.floor(alongForAlerts / 25) * 25;
  const alertsOnRoute = useMemo(() => alertsAhead(route, alerts, alongBucket), [route, alerts, alongBucket]);
  const alertNotice = tracking && alertsOnRoute.length > 0 && alertsOnRoute[0].aheadM <= 800
    ? `${ALERT_META[alertsOnRoute[0].alert.type].emoji} ${ALERT_META[alertsOnRoute[0].alert.type].label} · ${alertsOnRoute[0].aheadM < 40 ? "maintenant" : `dans ${prettyDistance(alertsOnRoute[0].aheadM)}`}`
    : null;
  const alertGeo = useMemo(() => alertFeatures(alerts), [alerts]);
  const selectedAlert = selectedAlertId ? alerts.find((a) => a.id === selectedAlertId) ?? null : null;
  // Annonce vocale unique d'un signalement qui approche sur l'itineraire (a moins de 600 m).
  const nextAlert = alertsOnRoute[0] ?? null;
  useEffect(() => {
    if (!tracking) { spokenAlerts.current.clear(); return; }
    if (!voiceEnabled || !nextAlert || nextAlert.aheadM > 600 || spokenAlerts.current.has(nextAlert.alert.id)) return;
    spokenAlerts.current.add(nextAlert.alert.id);
    const when = nextAlert.aheadM < 60 ? "juste devant" : spokenDistance(nextAlert.aheadM).replace(/^Dans/, "dans");
    void speakViagoFrench(`Attention, ${ALERT_META[nextAlert.alert.type].spoken} ${when}.`).catch(() => undefined);
  }, [tracking, voiceEnabled, nextAlert]);
  const altLines = useMemo(() => (tracking ? undefined : alternativeFeatures(candidates, chosenRoute)), [tracking, candidates, chosenRoute]);
  const surfaceLines = useMemo(() => surfaceSectionLines(route, surface, distance), [route, surface, distance]);
  const surfaceLabel = surfaceSummaryLabel(surface);
  const roadNotice = upcomingSurfaceNotice(surface, distance !== null && confirmedRemainingM !== null ? Math.max(0, distance - confirmedRemainingM) : null);

  return (
    <main className={`${tracking ? "viago-c3-driving" : ""} relative isolate h-dvh min-h-[570px] w-full overflow-hidden bg-[#e6f4f1] text-slate-900`} aria-label="Navigation Viago">
      {/* Bandes pleines sous la barre d'etat et sous les boutons Android : jamais de carte derriere l'heure/reseau ni les boutons. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[900] bg-[#0a3d5c]" style={{ height: "env(safe-area-inset-top, 0px)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] bg-[#0a3d5c]" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      {/* Carte interactive, jamais remplacée par une image de démonstration. */}
      <div className="absolute inset-0 z-0">
        {mapLibreEnabled ? (
          <ViagoMapLibre start={start} end={end} route={route} alertFeatures={alertGeo} onSelectAlert={(id) => setSelectedAlertId(id)} stopPoints={stops.flatMap((x) => x.point ? [x.point] : [])} altLines={altLines} onSelectAlt={chooseCandidate} surfaceLines={surfaceLines} onSelect={choosePoint}
            userPosition={livePosition} pedestrianMode={profile === "foot"} profile={profile}
            pedestrianPosition={profile === "foot" ? pedestrianGpsPosition : null}
            pedestrianAccuracyM={profile === "foot" ? gpsAccuracy : null}
            vehicleHeading={vehicleHeading} motionPhase={motionPhase} followUser={tracking && follow} recenterRequest={recenterRequest} progressMeters={tracking && lastConfirmedGuidance ? Math.floor(lastConfirmedGuidance.travelledMeters / 10) * 10 : null} onUserPan={() => { autoFollowMs.current = 8000; setFollow(false); }} gpsFixValid={gpsSignal === "valid" && routeProgress?.status === "on_route"} visualGpsUsable={(gpsSignal === "valid" || gpsSignal === "imprecise") && livePosition !== null && typeof gpsAccuracy === "number" && gpsAccuracy <= MAX_GPS_VISUAL_ACCURACY_M} navigationActive={tracking} sheetOpen={false} fitRequest={fitRequest} viewMode={mapView} detailRequest={detailRequest} />
        ) : (
          <ViagoLeafletMap start={start} end={end} route={route} onSelect={choosePoint}
            userPosition={livePosition} vehicleHeading={vehicleHeading} followUser={tracking && follow} gpsFixValid={gpsSignal === "valid" && routeProgress?.status === "on_route"} navigationActive={tracking} sheetOpen={false} fitRequest={fitRequest} viewMode={mapView} detailRequest={detailRequest} />
        )}
      </div>

      {/* Identité Viago : mêmes éléments visuels sur mobile et desktop. */}
      <div className="pointer-events-none absolute right-3 top-3 z-[480] hidden md:block">
        <div className="rounded-2xl bg-white/95 px-4 py-2.5 text-xs font-semibold text-emerald-900 shadow-md backdrop-blur">VIAGO · Navigation en Guinée</div>
      </div>



      {/* P6-C10A: autonomous, light-surface driving HUD. No legacy nav classes. */}
      {tracking && route && distance !== null && (
        <ViagoDrivingHud
          instruction={guidance.mode === "unconfirmed" ? "Recalage GPS en cours" : nextManeuver ? maneuverTitle(nextManeuver) : "Suivez le trajet"}
          arrow={guidance.mode === "unconfirmed" ? "◎" : nextManeuver ? maneuverArrow(nextManeuver) : "↑"}
          turnDistance={metersToManeuver !== null ? prettyDistance(metersToManeuver) : null}
          distanceQualifier={guidanceDistanceLabel}
          destination={guidance.mode === "unconfirmed" ? `Vers ${endName}` : nextManeuver?.streetName || `Vers ${endName}`}
          following={guidance.mode === "unconfirmed" ? null : followingManeuver ? {arrow: maneuverArrow(followingManeuver), title: maneuverTitle(followingManeuver)} : null}
          speed={gpsSignal === "valid" ? gpsSpeedKmh : null}
          gpsSignal={gpsSignal}
          gpsAccuracy={gpsAccuracy}
          confirmed={guidance.mode !== "unconfirmed"}
          showRecenter={!follow}
          roadNotice={alertNotice ?? roadNotice}
          onReport={() => setReporting(true)}
          remaining={confirmedRemainingM !== null ? prettyDistance(confirmedRemainingM) : prettyDistance(distance)}
          remainingLabel={tripEstimate.source === "live" ? "Distance restante" : tripEstimate.source === "last_confirmed" ? "Restante · dernier GPS" : "Distance initiale"}
          duration={displayedDurationS !== null ? prettyDuration(displayedDurationS) : "--"}
          durationLabel={tripEstimate.source === "last_confirmed" ? "Durée · dernier GPS" : "Estimation"}
          arrival={displayedArrivalAt !== null ? new Date(displayedArrivalAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          arrivalLabel={tripEstimate.source === "last_confirmed" ? "Arrivée · dernier GPS" : "Arrivée est."}
          voiceEnabled={voiceEnabled}
          canReplayVoice={canReplayVoice}
          voiceReplayBusy={voiceReplayBusy}
          onReplayVoice={() => { void replayVoiceInstruction(); }}
          voiceStatus={voiceStatus}
          voiceError={voiceError}
          onToggleVoice={() => { void toggleVoice(); }}
          onFollow={() => { setMapView("detail"); setFollow(true); setRecenterRequest((value) => value + 1); }}
          onOverview={() => { autoFollowMs.current = 20000; setFollow(false); setMapView("overview"); setFitRequest((value) => value + 1); }}
          onStop={() => { stopTracking(); setSheetOpen(true); setMapView("overview"); setFitRequest((value) => value + 1); }}
        />
      )}

      {/* Opt-in field telemetry; never records GPS coordinates or device identifiers. */}
      {tracking && gpsSource === "android-native" && (
        <div className="pointer-events-auto absolute bottom-[calc(155px+env(safe-area-inset-bottom,0px))] right-3 z-[570] flex flex-col items-end gap-2">
          <button type="button" onClick={toggleGpsDiagnostic}
            aria-expanded={telemetryEnabled}
            className="rounded-full border border-white/35 bg-gradient-to-br from-[#0b5d8f] to-[#0a7a8a] px-3.5 py-2 text-[12px] font-bold text-white shadow-[0_3px_12px_rgba(4,50,70,0.30)]">
            {telemetryEnabled ? "Fermer" : "GPS"}
          </button>
          {telemetryEnabled && telemetryCompact && (
            <button type="button" onClick={() => setTelemetryCompact(false)} aria-label="Afficher le diagnostic GPS complet"
              className="max-w-[200px] rounded-lg border border-slate-300 bg-white/95 px-2 py-1 text-left text-[10px] font-semibold leading-tight text-slate-800 shadow-lg">
              {dbgSnap.phase} · {dbgSnap.spd ?? "--"} km/h · ±{dbgSnap.acc ?? "--"} m<br />
              route {dbgSnap.route} · verrou {dbgSnap.lock} · conf. {dbgSnap.confirmed}
            </button>
          )}
          {telemetryEnabled && telemetryReport && !telemetryCompact && (
            <div role="region" aria-label="Statistiques de qualité GPS, sans coordonnées"
              className="max-h-[47dvh] w-[255px] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-3 text-[11px] text-slate-800 shadow-xl">
              <div className="mb-1 font-bold text-slate-900">Qualité GPS · diagnostic local</div>
              <p>Mesures : {telemetryReport.observations} · {telemetryReport.elapsedSec} s</p>
              <p>Précision médiane : {telemetryReport.accuracyMedianM ?? "--"} m</p>
              <p>Précision moyenne / pire : {telemetryReport.accuracyMeanM ?? "--"} / {telemetryReport.accuracyWorstM ?? "--"} m</p>
              <p>Intervalle médian : {telemetryReport.intervalMedianSec ?? "--"} s</p>
              <p>Âge médian : {telemetryReport.ageMedianSec ?? "--"} s</p>
              <p>Vitesse fournie : {telemetryReport.speedAvailablePct ?? "--"} %</p>
              <p>Cap fourni : {telemetryReport.headingAvailablePct ?? "--"} %</p>
              <p>Route confirmée / rejetée : {telemetryReport.roadAccepted} / {telemetryReport.rejected.route}</p>
              <p>GPS imprécis / ancien : {telemetryReport.rejected.accuracy} / {telemetryReport.rejected.stale}</p>
              <p>Erreurs / reprises : {telemetryReport.nativeErrors} / {telemetryReport.restarts}</p>
              <p>Mouvement : {dbgSnap.phase} · GPS {dbgSnap.spd ?? "--"} km/h</p>
              <p>Route : {Object.entries(dbgSnap.routes).map(([k, v]) => `${k} ${v}`).join(", ") || "--"}</p>
              <p>Continuité refusée : {dbgSnap.contFail} · Positions confirmées : {dbgSnap.confirmed}</p>
              <p>Verrou route : {Object.entries(dbgSnap.locks).map(([k, v]) => `${k} ${v}`).join(", ") || "--"}</p>
              <p>Signal actuel : {telemetryReport.staleNow === null ? "En attente" : telemetryReport.staleNow ? "Ancien" : "Récent"}</p>
              <p className="mt-1 text-[10px] text-slate-500">Aucune coordonnée enregistrée. Statistiques en mémoire uniquement, effacées à la fermeture du diagnostic.</p>
              <button type="button" onClick={() => void copyGpsDiagnostic()}
                className="mt-2 rounded-md bg-emerald-700 px-3 py-1.5 font-bold text-white">Copier les statistiques</button>
              <button type="button" onClick={() => setTelemetryCompact(true)}
                className="ml-2 mt-2 rounded-md bg-slate-700 px-3 py-1.5 font-bold text-white">Réduire</button>
              {telemetryCopyStatus && <p role="status" className="mt-1">{telemetryCopyStatus}</p>}
            </div>
          )}
        </div>
      )}

      {tracking && gpsSource === "android-native" && gpsPermissionDenied && (
        <div role="alert" className="pointer-events-auto absolute bottom-[calc(145px+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[550] flex max-w-[420px] items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2 shadow-xl">
          <span className="text-xs font-semibold text-slate-800">Localisation désactivée pour Viago.</span>
          <button type="button" onClick={() => retryGpsPermission.current?.()} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Réautoriser GPS</button>
        </div>
      )}

      {tracking && gpsSource === "android-native" && (
        <span aria-label="Source GPS native Android" className="sr-only">GPS Android natif</span>
      )}

      {reporting && <ViagoReportSheet busy={reportBusy} onPick={(type) => { void sendReport(type); }} onClose={() => setReporting(false)} />}

      {selectedAlert && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[560] mx-auto max-w-[460px] rounded-2xl bg-white p-4 shadow-[0_8px_30px_rgba(10,30,50,0.3)]" role="dialog" aria-label="Signalement">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-slate-900"><span aria-hidden="true">{ALERT_META[selectedAlert.type].emoji}</span> {ALERT_META[selectedAlert.type].label}</p>
              <p className="mt-0.5 text-xs text-slate-500">Signalé {timeAgo(selectedAlert.createdAt)} · {selectedAlert.confirms} confirmation{selectedAlert.confirms > 1 ? "s" : ""}</p>
            </div>
            <button type="button" onClick={() => setSelectedAlertId(null)} aria-label="Fermer" className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-700"><X className="size-4" /></button>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">Est-ce toujours là ?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { void voteAlert(selectedAlert.id, "still"); }} className="rounded-xl bg-[#0b7f78] py-2.5 text-sm font-bold text-white">Oui, toujours là</button>
            <button type="button" onClick={() => { void voteAlert(selectedAlert.id, "gone"); }} className="rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-800">Non, plus là</button>
          </div>
        </div>
      )}

      {!tracking && (
        <ViagoDirectionsCard
          startValue={startQuery}
          endValue={endQuery}
          stops={stops.map((_, i) => ({ value: stopQueries[i] ?? "", placeholder: `Étape ${i + 1} : lieu ou Adresse GN` }))}
          focus={dirFocus}
          searching={searching}
          slowSearch={slowSearch}
          suggestions={dirSuggestions}
          canShare={end !== null}
          onFocus={(role) => { setDirFocus(role); if (role === "start" || role === "end") setSearchRole(role); }}
          onChange={(role, value) => {
            if (role === "start") { setStartQuery(value); setPlaces([]); }
            else if (role === "end") { setEndQuery(value); setPlaces([]); }
            else { setStopQueries((c) => c.map((q, i) => i === role ? value : q)); setStopPlaces([]); }
          }}
          onSubmit={(role) => {
            if (typeof role === "number") void searchStop(role);
            else void searchDestination({ preventDefault() {} } as React.FormEvent<HTMLFormElement>, role);
          }}
          onPickSuggestion={(id) => {
            const idx = Number(id);
            if (typeof dirFocus === "number") { const p = stopPlaces[idx]; if (p) pickStop(dirFocus, p); return; }
            const p = places[idx];
            if (p && (dirFocus === "start" || dirFocus === "end")) {
              applyPoint({ lat: Number(p.lat), lng: Number(p.lon) }, dirFocus, p.display_name.split(",").slice(0, 2).join(","));
              setDirFocus(null);
            }
          }}
          onUseMyPosition={() => { setDirFocus(null); void positionGps(); }}
          onPickOnMap={(role) => { setDirFocus(null); setSelection(role); setMessage(role === "start" ? "Touchez la carte pour choisir le départ." : "Touchez la carte pour choisir l’arrivée."); }}
          onSwap={swapPoints}
          onAddStop={addStop}
          onRemoveStop={removeStop}
          onShare={() => { void shareRoute(); }}
          onTools={() => setAdvanced(true)}
          onReset={resetAll}
          onDismiss={() => setDirFocus(null)}
        />
      )}

      {!tracking && !previewShown && (
        <div className="pointer-events-none absolute inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-[520] mx-auto max-w-[460px]">
          <div className="pointer-events-auto rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_6px_24px_rgba(10,30,50,0.22)]">
            {busy ? "Calcul de l’itinéraire…" : start && end ? "Calcul de l’itinéraire…" : !start && !end ? "Saisissez une destination, une Adresse GN, ou touchez la carte." : !end ? "Choisissez la destination." : "Choisissez le point de départ."}
          </div>
        </div>
      )}

      {previewShown && (
        <ViagoRoutePreview
          profile={profile}
          onProfile={setProfile}
          candidates={candidates}
          chosen={chosenRoute}
          onChoose={chooseCandidate}
          altBusy={altBusy}
          distanceLabel={distance !== null ? prettyDistance(distance) : ""}
          durationS={duration}
          arrivalLabel={arrivalAt !== null ? new Date(arrivalAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null}
          onClose={resetAll}
          onStart={startTracking}
        />
      )}

      {/* Aperçu compact : le trajet et sa distance restent visibles carte ouverte. */}

      {route && route.length >= 2 && !tracking && !previewShown && (
        <button
          type="button"
          onClick={() => {
            setFollow(false);
            setSheetOpen(false);
            setMapView("detail");
            setDetailRequest((value) => value + 1);
          }}
          aria-label="Vue rapprochee du depart"
          title="Vue rapprochee du depart"
          className="pointer-events-auto absolute bottom-[calc(8rem+env(safe-area-inset-bottom,0px))] right-3 z-[510] flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-emerald-800 shadow-xl md:right-5"
        >
          <Navigation2 className="size-4" />
          Vue rapprochée
        </button>
      )}

      {route && route.length >= 2 && !tracking && !previewShown && (
        <button
          type="button"
          onClick={() => {
            setFollow(false);
            setSheetOpen(false);
            setMapView("overview");
            setFitRequest((value) => value + 1);
          }}
          aria-label="Voir tout le trajet"
          title="Voir tout le trajet"
          className="pointer-events-auto absolute bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-3 z-[510] flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-emerald-800 shadow-xl md:right-5"
        >
          <Navigation2 className="size-4" />
          Voir tout le trajet
        </button>
      )}

      <button type="button" onClick={() => { if (tracking && livePosition) setFollow(true); else positionGps(); }} aria-label="Recentrer sur ma position"
        className={tracking ? "hidden" : `absolute ${previewShown ? "bottom-[calc(360px+env(safe-area-inset-bottom,0px))]" : "bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]"} right-3 z-[510] flex size-12 items-center justify-center rounded-2xl bg-white shadow-xl md:right-5`}><Crosshair className="size-5 text-emerald-800"/></button>

      {message && <div className="pointer-events-auto absolute bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[550] mx-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-xs text-white shadow-xl md:bottom-5" role="status" aria-live="polite"><div className="flex items-start justify-between gap-3"><span>{message}</span><button type="button" aria-label="Fermer le message" onClick={() => setMessage(null)}><X className="size-4"/></button></div></div>}

      {advanced && <aside className="absolute right-3 top-[calc(5rem+env(safe-area-inset-top,0px))] z-[600] max-h-[75dvh] w-[min(350px,calc(100vw-24px))] overflow-auto rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 md:right-5" aria-label="Outils de test Viago">
        <div className="flex items-center justify-between"><p className="text-sm font-bold">Options et outils de test</p><button type="button" onClick={() => setAdvanced(false)} aria-label="Fermer les options"><X className="size-5"/></button></div>
        <p className="mt-2 text-xs text-slate-500">Outils techniques masqués aux utilisateurs habituels.</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelection("start")} className={`rounded-lg border px-2 py-2 text-xs ${selection === "start" ? "border-emerald-600 bg-emerald-50" : ""}`}>Point de départ</button><button type="button" onClick={() => setSelection("end")} className={`rounded-lg border px-2 py-2 text-xs ${selection === "end" ? "border-emerald-600 bg-emerald-50" : ""}`}>Destination</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs">Latitude<input type="text" inputMode="decimal" value={latitude} onChange={e => setLatitude(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label><label className="text-xs">Longitude<input type="text" inputMode="decimal" value={longitude} onChange={e => setLongitude(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label></div>
        <button type="button" onClick={applyCoordinateFields} className="mt-3 w-full rounded-lg border p-2 text-sm">Appliquer les coordonnées</button>
        <button type="button" onClick={() => { loadSample(); setAdvanced(false); }} className="mt-2 w-full rounded-lg bg-slate-900 p-2 text-sm text-white">Trajet témoin Conakry</button>
        <button type="button" onClick={() => { clearRoute(); setStart(null); setEnd(null); setAdvanced(false); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border p-2 text-sm"><RotateCcw className="size-4"/> Réinitialiser</button>
        <p className="mt-3 text-xs text-slate-500">Recherche Adresse GN : service public Adresse GN. Calcul Viago : graphe local en lecture seule. Aucun guidage vocal ni itinéraires alternatifs tant qu'ils ne sont pas disponibles.</p>
      </aside>}
    </main>
  );
}
