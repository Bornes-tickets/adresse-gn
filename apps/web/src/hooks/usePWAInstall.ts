// src/hooks/usePWAInstall.ts
import { useEffect, useState, useCallback } from "react";

type Choice = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: Choice; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "agn-install-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return Boolean(mq || iosStandalone);
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isDismissedRecently(): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  return Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS;
}

export interface UsePWAInstallResult {
  /** Peut être installé maintenant (prompt natif dispo, non installé, non dismiss récent). */
  canInstall: boolean;
  /** L'app tourne en standalone (déjà installée). */
  installed: boolean;
  /** iOS : pas de prompt natif, il faut afficher un guide manuel. */
  needsManualIosGuide: boolean;
  /** Déclenche le prompt d'installation (retourne le choix utilisateur). */
  promptInstall: () => Promise<Choice | null>;
  /** Marque l'invitation comme rejetée pour 7 jours (masque la bannière). */
  dismiss: () => void;
}

export function usePWAInstall(): UsePWAInstallResult {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setDismissed(isDismissedRecently());

    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try { localStorage.removeItem(DISMISS_KEY); } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<Choice | null> => {
    if (!deferred) return null;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
      setDismissed(true);
    }
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissed(true);
  }, []);

  const needsManualIosGuide = isIos() && !installed && !dismissed;
  const canInstall = !installed && !dismissed && (Boolean(deferred) || needsManualIosGuide);

  return { canInstall, installed, needsManualIosGuide, promptInstall, dismiss };
}
