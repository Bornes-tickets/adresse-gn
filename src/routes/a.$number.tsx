import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";

import { BeaconMap } from "@/components/BeaconMap";
import { ClaimDialog } from "@/components/ClaimDialog";
import { DirectionsSheet } from "@/components/DirectionsSheet";
import { ReportSheet } from "@/components/ReportSheet";
import { ShareSheet } from "@/components/ShareSheet";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { displayName } from "@/lib/beacon";
import {
  categoryLabel,
  formatDistance,
  haversineKm,
  isCommercialCategory,
} from "@/lib/geo";
import { beaconContext, ownerToggleFavorite } from "@/lib/owner.functions";
import { searchBeacon } from "@/lib/search.functions";


export const Route = createFileRoute("/a/$number")({
  head: ({ params }) => ({
    meta: [
      { title: `Adresse ${params.number} — ADRESSE GN` },
      {
        name: "description",
        content: `Position GPS vérifiée, carte et itinéraire immédiat pour l'adresse ${params.number} en Guinée.`,
      },
      {
        property: "og:title",
        content: `Adresse ${params.number} — ADRESSE GN`,
      },
      {
        property: "og:description",
        content:
          "Un lieu · Un numéro · Un itinéraire. Ouvrez la carte et lancez la navigation.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: `https://place-id-finder.lovable.app/a/${params.number}`,
      },
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
  const [claimOpen, setClaimOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, error, isPending } = useQuery({
    queryKey: ["search-beacon", number],
    queryFn: () => searchBeacon({ data: { number } }),
    retry: false,
  });

  const contexte = useQuery({
    queryKey: ["beacon-context", number],
    queryFn: () => beaconContext({ data: { number } }),
    enabled: isAuthenticated && data?.status === "found",
    retry: false,
  });

  const basculerFavori = useMutation({
    mutationFn: () => ownerToggleFavorite({ data: { number } }),
    onSuccess: (res: { favorited?: boolean }) => {
      toast.success(res?.favorited === false ? "Retiré des favoris." : "Ajouté à vos favoris.");
      queryClient.invalidateQueries({ queryKey: ["beacon-context", number] });
    },
    onError: (e: Error) => toast.error(e.message),
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-3 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:p-0">
            <div className="shadow-brand-lg pointer-events-auto mx-auto w-full max-w-md rounded-2xl border border-slate-200/60 bg-card p-6 sm:p-7">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-lg font-semibold tracking-tight text-primary sm:text-xl">
                    {resultat.public_number}
                  </span>
                  {resultat.verification_level === "verified" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                      <BadgeCheck className="size-3.5" />
                      Vérifié
                    </span>
                  )}
                </div>

                <h1 className="text-display text-2xl font-bold leading-tight text-foreground">
                  {displayName(resultat)}
                </h1>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                    {categoryLabel(resultat.category)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <LocateFixed className="size-4 shrink-0 text-accent" />
                  {distance ? (
                    <span className="text-foreground">À {distance} de vous</span>
                  ) : (
                    <button
                      type="button"
                      onClick={demanderPosition}
                      className="text-accent underline underline-offset-2"
                    >
                      Calculer la distance depuis ma position
                    </button>
                  )}
                </div>

                {resultat.access_point_note && (
                  <p className="text-sm italic leading-relaxed text-slate-500">
                    {resultat.access_point_note}
                  </p>
                )}
                {geoError && <p className="text-xs text-destructive">{geoError}</p>}
              </div>

              <div className="my-6 h-px bg-border" />

              <Button
                className="gradient-accent h-14 w-full text-base font-medium text-accent-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => setDirectionsOpen(true)}
              >
                <Navigation className="size-5" />
                S'y rendre
              </Button>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="size-4" />
                  <span className="hidden sm:inline">Partager</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => setReportOpen(true)}
                >
                  <Flag className="size-4" />
                  <span className="hidden sm:inline">Signaler</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    if (!isAuthenticated) {
                      toast.info("Connectez-vous pour enregistrer un favori.");
                      return;
                    }
                    basculerFavori.mutate();
                  }}
                  disabled={basculerFavori.isPending}
                >
                  <Heart
                    className={`size-4 ${contexte.data?.favorite_id ? "fill-destructive text-destructive" : ""}`}
                  />
                  <span className="hidden sm:inline">Favori</span>
                </Button>
              </div>

              {!contexte.data?.is_mine && (
                <Button
                  variant="ghost"
                  className="mt-2 h-11 w-full text-sm"
                  onClick={() => setClaimOpen(true)}
                >
                  <ShieldCheck className="size-4" />
                  {contexte.data?.claim_status === "pending"
                    ? "Demande de réclamation envoyée"
                    : "Réclamer cette adresse"}
                </Button>
              )}

              {isCommercialCategory(resultat.category) && resultat.business_name && (
                <Button asChild variant="ghost" className="mt-1 h-11 w-full text-sm">
                  <Link to="/etablissement/$number" params={{ number }}>
                    <Building2 className="size-4" />
                    Voir la fiche établissement
                  </Link>
                </Button>
              )}
            </div>
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
          <ClaimDialog
            open={claimOpen}
            onOpenChange={setClaimOpen}
            number={resultat.public_number}
            claimStatus={contexte.data?.claim_status ?? null}
            isMine={contexte.data?.is_mine ?? false}
          />

        </>
      )}
    </div>
  );
}
