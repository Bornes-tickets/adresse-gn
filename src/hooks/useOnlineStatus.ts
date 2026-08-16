// src/hooks/useOnlineStatus.ts
import { useEffect, useState } from "react";

/**
 * Hook temps réel du statut réseau (navigator.onLine + events online/offline).
 * Ping périodique optionnel pour détecter les connexions "captives" (WiFi sans internet).
 */
export function useOnlineStatus(pingUrl?: string, intervalMs = 30_000) {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => {
      setOnline(true);
      // wasOffline permet au composant de déclencher un toast "Reconnecté, sync..."
    };
    const off = () => {
      setOnline(false);
      setWasOffline(true);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!pingUrl) return;
    const check = async () => {
      try {
        const res = await fetch(pingUrl, { method: "HEAD", cache: "no-store" });
        if (res.ok) setOnline(true);
      } catch {
        setOnline(false);
        setWasOffline(true);
      }
    };
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [pingUrl, intervalMs]);

  const acknowledgeReconnect = () => setWasOffline(false);

  return { online, wasOffline, acknowledgeReconnect };
}
