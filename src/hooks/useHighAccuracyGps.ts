// src/hooks/useHighAccuracyGps.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type GpsQuality = "excellent" | "bon" | "moyen" | "faible" | "aucun";

function qualityFromAccuracy(acc: number | null): GpsQuality {
  if (acc == null) return "aucun";
  if (acc <= 5) return "excellent";
  if (acc <= 10) return "bon";
  if (acc <= 25) return "moyen";
  return "faible";
}

export interface UseHighAccuracyGpsOptions {
  /** Nombre de mesures à collecter avant de renvoyer la meilleure. Défaut : 5. */
  samples?: number;
  /** Timeout total en ms. Défaut : 30_000. */
  timeoutMs?: number;
  /** Précision cible en mètres (arrêt anticipé si atteinte). Défaut : 5. */
  targetAccuracy?: number;
}

/**
 * GPS haute précision : polling watchPosition, conserve la meilleure mesure,
 * retourne dès que la précision cible est atteinte ou après N échantillons.
 */
export function useHighAccuracyGps(opts: UseHighAccuracyGpsOptions = {}) {
  const { samples = 5, timeoutMs = 30_000, targetAccuracy = 5 } = opts;
  const [best, setBest] = useState<GpsPoint | null>(null);
  const [current, setCurrent] = useState<GpsPoint | null>(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<"idle" | "acquiring" | "done" | "error" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const acquire = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error"); setError("Géolocalisation non supportée"); return;
    }
    cleanup();
    setBest(null); setCurrent(null); setCount(0); setError(null);
    setStatus("acquiring");

    let localBest: GpsPoint | null = null;
    let localCount = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p: GpsPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setCurrent(p);
        localCount += 1;
        setCount(localCount);
        if (!localBest || p.accuracy < localBest.accuracy) {
          localBest = p;
          setBest(p);
        }
        if (p.accuracy <= targetAccuracy || localCount >= samples) {
          cleanup();
          setStatus("done");
        }
      },
      (err) => {
        cleanup();
        if (err.code === err.PERMISSION_DENIED) { setStatus("denied"); setError("Autorisation refusée"); }
        else { setStatus("error"); setError(err.message); }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );

    timeoutRef.current = setTimeout(() => {
      cleanup();
      if (localBest) setStatus("done");
      else { setStatus("error"); setError("Timeout — aucun signal GPS"); }
    }, timeoutMs);
  }, [samples, timeoutMs, targetAccuracy, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    if (best) setStatus("done"); else setStatus("idle");
  }, [cleanup, best]);

  return {
    best, current, count, status, error,
    quality: qualityFromAccuracy(best?.accuracy ?? null),
    acquire, stop,
    progress: samples > 0 ? Math.min(100, Math.round((count / samples) * 100)) : 0,
  };
}
