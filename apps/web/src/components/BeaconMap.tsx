"use client";

import dynamic from "next/dynamic";

import type {
  BeaconMapViewProps,
} from "@/components/BeaconMapView";


const BeaconMapView = dynamic(
  () =>
    import(
      "@/components/BeaconMapView"
    ),
  {
    ssr: false,

    loading: () => (
      <div className="h-full w-full animate-pulse bg-slate-100" />
    ),
  },
);


export function BeaconMap(
  props: BeaconMapViewProps,
) {
  return (
    <BeaconMapView
      {...props}
    />
  );
}