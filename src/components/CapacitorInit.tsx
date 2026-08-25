// src/components/CapacitorInit.tsx
// À monter une seule fois dans le layout racine (__root.tsx)
import { useEffect } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useIsNative } from "@/hooks/useCapacitor";

export function CapacitorInit() {
  const isNative = useIsNative();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!isNative) return;
    let cleanup: (() => void) | null = null;
    let resumeListener: { remove: () => void } | null = null;

    /**
     * Force la StatusBar dans l'état voulu.
     * Appelé au boot ET à chaque fois que l'app repasse au premier plan.
     */
    const applyStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // 1) WebView passe SOUS la StatusBar (header étend son fond via env(safe-area-inset-top))
        await StatusBar.setOverlaysWebView({ overlay: true });
        // 2) Icônes SOMBRES (heure, batterie) car le header est blanc
        await StatusBar.setStyle({ style: Style.Dark });
        // 3) Fond de la StatusBar blanc — aligné avec le header
        await StatusBar.setBackgroundColor({ color: "#ffffff" });
      } catch (e) {
        console.warn("[CapacitorInit] StatusBar apply failed:", e);
      }
    };

    (async () => {
      // ⚡ FORCE la StatusBar dès le démarrage
      await applyStatusBar();

      try {
        // Splash Screen : cache après hydration
        const { SplashScreen } = await import("@capacitor/splash-screen");
        setTimeout(() => SplashScreen.hide({ fadeOutDuration: 400 }), 500);
      } catch {}

      try {
        // 🔁 Réapplique la StatusBar à chaque retour au premier plan.
        // Android peut la réinitialiser après un long temps en arrière-plan
        // ou après un rechargement du WebView.
        const { App } = await import("@capacitor/app");
        const rl = await App.addListener("appStateChange", (state: any) => {
          if (state.isActive) {
            void applyStatusBar();
          }
        });
        resumeListener = rl;
      } catch {}

      try {
        // Bouton retour Android : gère la navigation router avant de quitter l'app
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", (e: any) => {
          if (e.canGoBack || window.history.length > 1) {
            router.history.back();
          } else {
            App.exitApp();
          }
        });
        cleanup = () => { listener.remove(); };
      } catch {}

      try {
        // Ouvre les liens externes dans le navigateur système (pas dans la WebView)
        const { App } = await import("@capacitor/app");
        await App.addListener("appUrlOpen", (event: any) => {
          const url = new URL(event.url);
          if (url.origin === "https://adresse-gn.netlify.app" || url.origin === "capacitor://localhost") {
            const path = url.pathname + url.search + url.hash;
            navigate({ to: path });
          }
        });
      } catch {}

      try {
        // Feedback haptique subtil sur navigation
        const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
        router.subscribe("onBeforeNavigate", () => {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        });
      } catch {}
    })();

    return () => {
      cleanup?.();
      resumeListener?.remove();
    };
  }, [isNative, navigate, router]);

  return null;
}
