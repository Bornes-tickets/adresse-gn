"use client";

import { useEffect } from "react";

import L from "leaflet";

import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";


export interface BeaconMapViewProps {
  lat: number;
  lng: number;
  label: string;

  zoom?: number;

  userPosition?: {
    lat: number;
    lng: number;
  } | null;
}


const beaconIcon = L.divIcon({
  className:
    "adresse-gn-marker",

  html: `
    <span
      style="
        display:block;
        width:28px;
        height:28px;
        border-radius:9999px 9999px 9999px 2px;
        transform:rotate(-45deg);
        background:#2E4A7B;
        border:3px solid #fff;
        box-shadow:0 4px 10px rgb(0 0 0 / 0.35);
      "
    ></span>
  `,

  iconSize: [28, 28],

  iconAnchor: [14, 28],
});


const userIcon = L.divIcon({
  className:
    "adresse-gn-user-marker",

  html: `
    <span
      style="
        display:block;
        width:14px;
        height:14px;
        border-radius:9999px;
        background:#0EA5A4;
        border:3px solid #fff;
        box-shadow:0 2px 6px rgb(0 0 0 / 0.3);
      "
    ></span>
  `,

  iconSize: [14, 14],

  iconAnchor: [7, 7],
});


function Recenter({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map =
    useMap();

  useEffect(() => {
    map.setView(
      [lat, lng],
      zoom,
    );
  }, [
    map,
    lat,
    lng,
    zoom,
  ]);

  return null;
}


export default function BeaconMapView({
  lat,
  lng,
  label,
  zoom = 17,
  userPosition,
}: BeaconMapViewProps) {
  return (
    <MapContainer
      center={[
        lat,
        lng,
      ]}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
        maxZoom={19}
      />

      <Marker
        position={[
          lat,
          lng,
        ]}
        icon={beaconIcon}
        title={label}
        alt={label}
      />

      {userPosition && (
        <Marker
          position={[
            userPosition.lat,
            userPosition.lng,
          ]}
          icon={userIcon}
          title="Votre position"
          alt="Votre position"
        />
      )}

      <Recenter
        lat={lat}
        lng={lng}
        zoom={zoom}
      />
    </MapContainer>
  );
}