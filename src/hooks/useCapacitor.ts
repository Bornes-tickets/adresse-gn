import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Indique si l'application s'exécute dans une WebView Capacitor native.
 * La valeur reste `false` pendant le SSR et le premier rendu afin d'éviter
 * toute divergence d'hydratation avec le navigateur.
 */
export function useIsNative(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  return isNative;
}
