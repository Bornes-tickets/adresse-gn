import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { BeaconMapViewProps } from "@/components/BeaconMapView";

const BeaconMapView = lazy(() => import("@/components/BeaconMapView"));

/**
 * Carte Leaflet / OpenStreetMap. Leaflet touche au DOM : chargement
 * uniquement après hydratation côté navigateur.
 */
export function BeaconMap(props: BeaconMapViewProps) {
  const fallback = <Skeleton className="h-full w-full rounded-none" />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <BeaconMapView {...props} />
      </Suspense>
    </ClientOnly>
  );
}
