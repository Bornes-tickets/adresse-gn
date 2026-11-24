/**
 * VIAGO-C14-P2-B: single-owner GPS source for the Capacitor Android DEV shell.
 * The Android bridge is injected into the remote WebView by Capacitor.
 * No second browser watcher is started when a native bridge is available.
 * This does NOT perform inertial fusion or override the route progress gate.
 */
export type ViagoGpsPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
  };
  timestamp: number;
};

export type ViagoGpsError = { code: number; message: string };
export type ViagoGpsWatch = { source: "android-native" | "browser"; stop: () => void | Promise<void> };

type NativeBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options?: Record<string, unknown>) => Promise<unknown>;
  nativeCallback?: (
    plugin: string, method: string, options: Record<string, unknown>,
    callback: (data: unknown, error?: unknown) => void,
  ) => string;
};

type BridgeWindow = Window & { Capacitor?: NativeBridge };

function bridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as BridgeWindow).Capacitor;
  if (!cap || cap.getPlatform?.() !== "android" || cap.isNativePlatform?.() !== true) return null;
  return cap;
}

function requireNativeBridge(cap: NativeBridge): asserts cap is NativeBridge & {
  nativePromise: NonNullable<NativeBridge["nativePromise"]>;
  nativeCallback: NonNullable<NativeBridge["nativeCallback"]>;
} {
  if (cap.isPluginAvailable?.("Geolocation") === false ||
      typeof cap.nativePromise !== "function" || typeof cap.nativeCallback !== "function") {
    throw { code: 1, message: "Pont GPS Android indisponible. Reconstruire l’APK Viago DEV." };
  }
}

function asPosition(data: unknown): ViagoGpsPosition {
  if (!data || typeof data !== "object") throw new Error("Réponse native GPS vide");
  const raw = data as Record<string, unknown>;
  const c = raw.coords;
  if (!c || typeof c !== "object") throw new Error("Coordonnées natives absentes");
  const coords = c as Record<string, unknown>;
  const latitude = coords.latitude, longitude = coords.longitude, accuracy = coords.accuracy;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0) {
    throw new Error("Mesure Android GPS invalide");
  }
  const timestamp = typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
    ? raw.timestamp : 0;
  const speed = typeof coords.speed === "number" && Number.isFinite(coords.speed) && coords.speed >= 0
    ? coords.speed : null;
  const heading = typeof coords.heading === "number" && Number.isFinite(coords.heading) &&
    coords.heading >= 0 && coords.heading < 360 ? coords.heading : null;
  return { coords: { latitude, longitude, accuracy, speed, heading }, timestamp };
}

export function normalizeViagoGpsError(error: unknown): ViagoGpsError {
  const obj = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const rawCode = obj.code;
  // Native Capacitor uses string codes; browser GeolocationPositionError uses numbers.
  const denied = rawCode === 1 || rawCode === "OS-PLUG-GLOC-0003";
  const code = denied ? 1 : 2;
  const message = denied ? "Autorisation de localisation refusée ou expirée." :
    rawCode === "OS-PLUG-GLOC-0007" || rawCode === "OS-PLUG-GLOC-0017"
      ? "Activez la localisation du téléphone pour continuer." :
    rawCode === "OS-PLUG-GLOC-0010"
      ? "Le signal GPS tarde à répondre. Viago conserve la dernière position fiable." :
    "Position Android temporairement indisponible.";
  return { code, message };
}

async function grantNativeLocation(cap: NativeBridge, allowPrompt: boolean): Promise<void> {
  requireNativeBridge(cap);
  const permissions = await cap.nativePromise("Geolocation", "checkPermissions", {}) as {
    location?: string;
  };
  if (permissions?.location === "granted") return;
  // Never open a system permission dialog from a background GPS recovery timer.
  if (!allowPrompt) {
    throw { code: 1, message: "Autorisation GPS absente : relancez-la depuis Viago." };
  }
  const requested = await cap.nativePromise("Geolocation", "requestPermissions", { permissions: ["location"] }) as {
    location?: string;
  };
  if (requested?.location !== "granted") {
    throw { code: 1, message: "Localisation refusée. Utilisez « Réautoriser GPS » pour réessayer." };
  }
}

export function viagoGpsSource(): "android-native" | "browser" {
  return bridge() ? "android-native" : "browser";
}

export async function getViagoCurrentPosition(): Promise<ViagoGpsPosition> {
  const cap = bridge();
  if (cap) {
    await grantNativeLocation(cap, true);
    requireNativeBridge(cap);
    return asPosition(await cap.nativePromise("Geolocation", "getCurrentPosition", {
      enableHighAccuracy: true, timeout: 15000, maximumAge: 0,
    }));
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject({ code: 2, message: "GPS navigateur indisponible" }); return; }
    navigator.geolocation.getCurrentPosition(
      position => resolve(asPosition(position)),
      error => reject(normalizeViagoGpsError(error)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function watchViagoPosition(
  onPosition: (position: ViagoGpsPosition) => void,
  onError: (error: ViagoGpsError) => void,
  options: { requestPermission?: boolean } = {},
): Promise<ViagoGpsWatch> {
  const cap = bridge();
  if (cap) {
    try {
      await grantNativeLocation(cap, options.requestPermission === true);
    } catch (cause) {
      throw normalizeViagoGpsError(cause);
    }
    requireNativeBridge(cap);
    let stopped = false;
    const id = cap.nativeCallback("Geolocation", "watchPosition", {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000,
      // Sans "interval", le plugin Capacitor utilise le timeout (15 s) comme cadence : une position toutes les 15 s.
      interval: 1000,
      minimumUpdateInterval: 1000,
    }, (data, error) => {
      if (stopped) return;
      if (error) { onError(normalizeViagoGpsError(error)); return; }
      try { onPosition(asPosition(data)); } catch (cause) { onError(normalizeViagoGpsError(cause)); }
    });
    return {
      source: "android-native",
      stop: () => {
        if (stopped) return;
        stopped = true;
        return cap.nativePromise("Geolocation", "clearWatch", { id }).then(() => undefined, () => undefined);
      },
    };
  }
  if (!navigator.geolocation) throw { code: 2, message: "GPS navigateur indisponible" };
  const id = navigator.geolocation.watchPosition(
    p => { try { onPosition(asPosition(p)); } catch (cause) { onError(normalizeViagoGpsError(cause)); } },
    error => onError(normalizeViagoGpsError(error)),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
  );
  return { source: "browser", stop: () => navigator.geolocation.clearWatch(id) };
}
