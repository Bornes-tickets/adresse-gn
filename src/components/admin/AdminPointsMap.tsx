import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { AdminPointsMapViewProps } from "@/components/admin/AdminPointsMapView";

const Vue = lazy(() => import("@/components/admin/AdminPointsMapView"));

/** Carte Leaflet des adresses (chargée après hydratation). */
export function AdminPointsMap(props: AdminPointsMapViewProps) {
  const fallback = <Skeleton className="h-full w-full" />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <Vue {...props} />
      </Suspense>
    </ClientOnly>
  );
}
