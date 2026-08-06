/** Détection de connectivité réelle (événements + ping serveur toutes les 30 s). */
import { useEffect, useState } from "react";

import { ping } from "@/lib/ping.functions";

async function verifier(): Promise<boolean> {
  try {
    const reponse = await ping();
    return reponse === "ok";
  } catch {
    return false;
  }
}

export function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    let annule = false;

    const sonder = async () => {
      if (!navigator.onLine) {
        if (!annule) setIsOnline(false);
        return;
      }
      const ok = await verifier();
      if (!annule) setIsOnline(ok);
    };

    const onOnline = () => void sonder();
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void sonder();
    const timer = window.setInterval(() => void sonder(), 30_000);

    return () => {
      annule = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnline;
}
