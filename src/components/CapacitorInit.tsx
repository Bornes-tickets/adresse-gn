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

    (async () => {
      try {
        // Status Bar : match la couleur du header
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#2E4A7B" });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch {}

      try {
        // Splash Screen : cache après hydration
        const { SplashScreen } = await import("@capacitor/splash-screen");
        setTimeout(() => SplashScreen.hide({ fadeOutDuration: 400 }), 500);
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

    return () => { cleanup?.(); };
  }, [isNative, navigate, router]);

  return null;
}
