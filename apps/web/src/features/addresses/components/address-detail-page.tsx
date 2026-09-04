"use client";

import {
  BadgeCheck,
  Building2,
  Flag,
  Heart,
  LocateFixed,
  Navigation,
  Share2,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { toast } from "sonner";

import { BeaconMap } from "@/components/BeaconMap";
import { InstallBanner } from "@/components/InstallBanner";
import { ShareSheet } from "@/components/ShareSheet";
import { Button } from "@/components/ui/button";

import { getAddressDetail } from "@/features/addresses/api";

import type {
  BeaconResult,
} from "@/features/addresses/types";

import {
  formatDistance,
  haversineKm,
} from "@/lib/geo";


type Props = {
  number: string;
};


function displayName(
  result: BeaconResult,
) {
  return (
    result.business_name ??
    result.name ??
    result.public_number
  );
}


function categoryLabel(
  category: string,
) {
  const labels:
    Record<string, string> = {
      restaurant:
        "Restaurant",

      hotel:
        "Hôtel",

      commerce:
        "Commerce",

      business:
        "Entreprise",

      residence:
        "Résidence",

      home:
        "Domicile",
    };

  return (
    labels[category] ??
    category
  );
}


export function AddressDetailPage({
  number,
}: Props) {
  const [
    result,
    setResult,
  ] =
    useState<BeaconResult | null>(
      null,
    );

  const [
    beaconId,
    setBeaconId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    position,
    setPosition,
  ] =
    useState<{
      lat: number;
      lng: number;
    } | null>(null);

  const [
    geoError,
    setGeoError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    shareOpen,
    setShareOpen,
  ] =
    useState(false);


  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response =
          await getAddressDetail(
            number,
            controller.signal,
          );

        if (
          response.status !==
            "found" ||
          !response.result
        ) {
          setResult(null);
          setBeaconId(null);

          setError(
            response.message ??
              "Adresse introuvable.",
          );

          return;
        }

        setResult(
          response.result,
        );

        setBeaconId(
          response.beacon_id,
        );
      } catch (err) {
        if (
          err instanceof
            DOMException &&
          err.name ===
            "AbortError"
        ) {
          return;
        }

        setResult(null);
        setBeaconId(null);

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger cette adresse.",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [number]);


  function demanderPosition() {
    if (
      !(
        "geolocation" in
        navigator
      )
    ) {
      setGeoError(
        "La géolocalisation n'est pas disponible sur cet appareil.",
      );

      return;
    }

    navigator.geolocation
      .getCurrentPosition(
        (pos) => {
          setGeoError(null);

          setPosition({
            lat:
              pos.coords
                .latitude,

            lng:
              pos.coords
                .longitude,
          });
        },

        () => {
          setGeoError(
            "L'accès à votre position a été refusé.",
          );
        },

        {
          enableHighAccuracy:
            true,

          timeout:
            10000,
        },
      );
  }


  useEffect(() => {
    if (
      typeof navigator ===
        "undefined" ||
      !navigator.permissions
        ?.query
    ) {
      return;
    }

    navigator.permissions
      .query({
        name:
          "geolocation" as PermissionName,
      })
      .then(
        (permission) => {
          if (
            permission.state ===
            "granted"
          ) {
            demanderPosition();
          }
        },
      )
      .catch(() => {
        // L'utilisateur pourra
        // déclencher manuellement
        // la géolocalisation.
      });
  }, []);


  if (loading) {
    return (
      <div className="relative h-[60vh] min-h-[760px] w-full bg-slate-100 md:h-[70vh] md:min-h-[760px]">
        <div className="h-full w-full animate-pulse bg-slate-100" />
      </div>
    );
  }


  /*
   * Snapshot local du résultat.
   *
   * À partir d'ici, on n'utilise plus directement
   * la variable d'état `result`. Cela évite que
   * TypeScript la considère de nouveau comme
   * potentiellement nulle dans les callbacks
   * et fonctions asynchrones du composant.
   */
  const currentResult =
    result;


  if (
    error ||
    currentResult === null
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-muted px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="font-mono text-lg text-primary">
            {number}
          </p>

          <p className="mt-3 text-sm text-muted-foreground">
            {error ??
              "Adresse introuvable."}
          </p>

          <Button
            asChild
            variant="outline"
            className="mt-5"
          >
            <a href="/">
              Nouvelle recherche
            </a>
          </Button>
        </div>
      </div>
    );
  }


  /*
   * Valeur définitivement non nulle.
   *
   * On la capture dans une constante explicitement typée
   * pour que TypeScript conserve ce type dans les fonctions
   * imbriquées et callbacks asynchrones.
   */
  const address: BeaconResult =
    currentResult;


  const currentLat =
    address.lat;

  const currentLng =
    address.lng;


  if (
    currentLat === null ||
    currentLng === null
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-muted px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="font-mono text-lg text-primary">
            {number}
          </p>

          <p className="mt-3 text-sm text-muted-foreground">
            Cette adresse ne possède pas de position exploitable.
          </p>

          <Button
            asChild
            variant="outline"
            className="mt-5"
          >
            <a href="/">
              Nouvelle recherche
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const distance =
    position
      ? formatDistance(
          haversineKm(
            position,
            {
              lat:
                currentLat,

              lng:
                currentLng,
            },
          ),
        )
      : null;


  const mapsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${currentLat},${currentLng}`;

  const wazeUrl =
    `https://www.waze.com/ul?ll=${currentLat},${currentLng}&navigate=yes`;



  return (
    <div className="relative h-[60vh] min-h-[760px] w-full md:h-[70vh] md:min-h-[760px]">
      <BeaconMap
        lat={currentLat}
        lng={currentLng}
        zoom={17}
        label={
          displayName(
            address,
          )
        }
        userPosition={
          position
        }
      />


      <div className="absolute inset-x-0 bottom-0 z-[500] md:inset-x-auto md:bottom-auto md:left-6 md:top-6">
        <div className="shadow-brand-lg mx-auto w-full max-w-md rounded-t-2xl border border-slate-200/60 bg-card p-6 sm:p-7 md:mx-0 md:max-w-sm md:rounded-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-semibold tracking-tight text-primary sm:text-xl">
                {
                  address.public_number
                }
              </span>

              {address.verification_level ===
                "verified" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  <BadgeCheck className="size-3.5" />

                  Vérifiée
                </span>
              )}
            </div>


            <h1 className="text-display text-2xl font-bold leading-tight text-foreground">
              {displayName(
                address,
              )}
            </h1>


            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                {categoryLabel(
                  address.category,
                )}
              </span>
            </div>


            <div className="flex items-center gap-2 text-sm">
              <LocateFixed className="size-4 shrink-0 text-accent" />

              {distance ? (
                <span className="text-foreground">
                  À {distance} de
                  votre position
                </span>
              ) : (
                <button
                  type="button"
                  onClick={
                    demanderPosition
                  }
                  className="text-accent underline underline-offset-2"
                >
                  Calculer la
                  distance
                </button>
              )}
            </div>


            {address.access_point_note && (
              <p className="text-sm italic leading-relaxed text-slate-500">
                {
                  address.access_point_note
                }
              </p>
            )}


            {geoError && (
              <p className="text-xs text-destructive">
                {geoError}
              </p>
            )}
          </div>


          <div className="my-6 h-px bg-border" />


          <div className="grid grid-cols-2 gap-2">
            <Button
              asChild
              className="h-14 bg-accent text-base font-semibold text-white hover:bg-accent-dark"
            >
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="size-5" />

                Google Maps
              </a>
            </Button>

            <Button
              asChild
              variant="outline"
              className="h-14 text-base font-semibold"
            >
              <a
                href={wazeUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="size-5" />

                Waze
              </a>
            </Button>
          </div>


          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() =>
                setShareOpen(true)
              }
            >
              <Share2 className="size-4" />

              <span className="hidden sm:inline">
                Partager
              </span>
            </Button>


            <Button
              variant="outline"
              className="h-11"
              onClick={() =>
                toast.info(
                  "Le signalement sera réactivé lors de la migration du module utilisateur.",
                )
              }
            >
              <Flag className="size-4" />

              <span className="hidden sm:inline">
                Signaler
              </span>
            </Button>


            <Button
              variant="outline"
              className="h-11"
              onClick={() =>
                toast.info(
                  "Les favoris seront réactivés avec l'authentification Supabase.",
                )
              }
            >
              <Heart className="size-4" />

              <span className="hidden sm:inline">
                Favori
              </span>
            </Button>
          </div>


          <Button
            variant="ghost"
            className="mt-2 h-11 w-full text-sm"
            onClick={() =>
              toast.info(
                "La revendication d'adresse sera migrée avec le module compte.",
              )
            }
          >
            <ShieldCheck className="size-4" />

            Revendiquer cette
            adresse
          </Button>


          {address.business_name && (
            <Button
              variant="ghost"
              className="mt-1 h-11 w-full text-sm"
              onClick={() =>
                toast.info(
                  "La fiche établissement sera migrée dans une prochaine étape.",
                )
              }
            >
              <Building2 className="size-4" />

              Voir
              l'établissement
            </Button>
          )}


          {beaconId && (
            <span className="sr-only">
              {beaconId}
            </span>
          )}
        </div>
      </div>


      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        number={address.public_number}
        name={displayName(address)}
      />

      <InstallBanner
        variant="bottom"
      />
    </div>
  );
}