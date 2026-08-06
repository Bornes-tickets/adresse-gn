import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  Flag,
  LocateFixed,
  Navigation,
  Share2,
} from "lucide-react";

import { BeaconMap } from "@/components/BeaconMap";
import { DirectionsSheet } from "@/components/DirectionsSheet";
import { ReportSheet } from "@/components/ReportSheet";
import { ShareSheet } from "@/components/ShareSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { displayName } from "@/lib/beacon";
import {
  categoryLabel,
  formatDistance,
  haversineKm,
  isCommercialCategory,
} from "@/lib/geo";
import { searchBeacon } from "@/lib/search.functions";

export const Route = createFileRoute("/a/$number")({
  head: () => ({
    meta: [
      { title: "Localisation d'une balise — Adresse GN" },
      {
        name: "description",
        content:
          "Carte, itinéraire et informations publiques d'une adresse guinéenne identifiée par son numéro de balise.",
      },
      { property: "og:title", content: "Localisation d'une balise — Adresse GN" },
      {
        property: "og:description",
        content: "Un lieu · Un numéro · Un itinéraire. Ouvrez la carte et lancez la navigation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BeaconResult,
});

function BeaconResult() {
  const { number } = Route.useParams();
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const { data, error, isPending } = useQuery({
    queryKey: ["search-beacon", number],
    queryFn: () => searchBeacon({ data: { number } }),
    retry: false,
  });

  const demanderPosition = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoError(null);
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGeoError("Position refusée. Autorisez la géolocalisation pour voir la distance."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (status.state === "granted") demanderPosition();
      })
      .catch(() => {
        /* API non supportée : l'utilisateur cliquera sur le bouton */
      });
  }, []);

  const resultat = data?.status === "found" ? data.result : null;
  const lat = resultat?.lat ?? null;
  const lng = resultat?.lng ?? null;

  const distance =
    position && lat !== null && lng !== null
      ? formatDistance(haversineKm(position, { lat, lng }))
      : null;

  return (
    <div className="relative h-[calc(100vh-8rem)] min-h-[520px] w-full">
      {isPending && <Skeleton className="h-full w-full rounded-none" />}

      {!isPending && lat !== null && lng !== null && resultat && (
        <BeaconMap
          lat={lat}
          lng={lng}
          zoom={17}
          label={displayName(resultat)}
          userPosition={position}
        />
      )}

      {!isPending && (!resultat || lat === null || lng === null) && (
        <div className="flex h-full items-center justify-center bg-muted px-4">
          <Card className="w-full max-w-md">
            <CardContent className="space-y-3 pt-6 text-center">
              <p className="font-mono text-lg text-primary">{number}</p>
              <p className="text-muted-foreground">
                {error
                  ? "Une erreur est survenue pendant la recherche."
                  : data?.status === "rate_limited"
                    ? (data.message ?? "Trop de recherches, réessayez plus tard.")
                    : data?.status === "invalid"
                      ? "Format de numéro invalide (attendu GN-XXX-999999)."
                      : "Aucune adresse ne correspond à ce numéro."}
              </p>
              <Button asChild variant="outline">
                <Link to="/">Nouvelle recherche</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {resultat && lat !== null && lng !== null && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3 sm:p-4">
            <Card className="pointer-events-auto mx-auto w-full max-w-md shadow-lg">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold text-foreground">
                    {displayName(resultat)}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{categoryLabel(resultat.category)}</Badge>
                    {resultat.verification_level === "verified" && (
                      <Badge className="bg-accent text-accent-foreground">
                        <BadgeCheck className="size-3.5" />
                        Vérifié
                      </Badge>
                    )}
                    <span className="font-mono text-sm text-muted-foreground">
                      {resultat.public_number}
                    </span>
                  </div>
                  {resultat.access_point_note && (
                    <p className="text-sm text-muted-foreground">
                      {resultat.access_point_note}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <LocateFixed className="size-4 text-accent" />
                    {distance ? (
                      <span className="text-foreground">À {distance} de vous</span>
                    ) : (
                      <button
                        type="button"
                        onClick={demanderPosition}
                        className="text-primary underline underline-offset-2"
                      >
                        Calculer la distance depuis ma position
                      </button>
                    )}
                  </div>
                  {geoError && <p className="text-xs text-destructive">{geoError}</p>}
                </div>

                <Button
                  size="lg"
                  className="h-14 w-full bg-accent text-base text-accent-foreground hover:bg-accent/90"
                  onClick={() => setDirectionsOpen(true)}
                >
                  <Navigation className="size-5" />
                  S'y rendre
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShareOpen(true)}
                  >
                    <Share2 className="size-4" />
                    Partager
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setReportOpen(true)}
                  >
                    <Flag className="size-4" />
                    Signaler
                  </Button>
                </div>

                {isCommercialCategory(resultat.category) && resultat.business_name && (
                  <Button asChild variant="ghost" className="w-full">
                    <Link to="/etablissement/$number" params={{ number }}>
                      <Building2 className="size-4" />
                      Voir la fiche établissement
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <DirectionsSheet
            open={directionsOpen}
            onOpenChange={setDirectionsOpen}
            number={resultat.public_number}
            lat={lat}
            lng={lng}
          />
          <ShareSheet
            open={shareOpen}
            onOpenChange={setShareOpen}
            number={resultat.public_number}
            name={displayName(resultat)}
          />
          <ReportSheet
            open={reportOpen}
            onOpenChange={setReportOpen}
            beaconId={data?.beacon_id ?? null}
            number={resultat.public_number}
          />
        </>
      )}
    </div>
  );
}
