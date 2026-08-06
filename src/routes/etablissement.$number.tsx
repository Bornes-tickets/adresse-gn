import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, Navigation, Phone, Share2 } from "lucide-react";

import { BeaconMap } from "@/components/BeaconMap";
import { DirectionsSheet } from "@/components/DirectionsSheet";
import { ShareSheet } from "@/components/ShareSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryLabel, DAYS_FR, todayKey } from "@/lib/geo";
import { getEstablishment, searchBeacon } from "@/lib/search.functions";

export const Route = createFileRoute("/etablissement/$number")({
  head: () => ({
    meta: [
      { title: "Fiche établissement — Adresse GN" },
      {
        name: "description",
        content:
          "Horaires, photos, contact et itinéraire d'un établissement guinéen identifié par son numéro Adresse GN.",
      },
      { property: "og:title", content: "Fiche établissement — Adresse GN" },
      {
        property: "og:description",
        content: "Horaires, photos et itinéraire d'un établissement référencé par Adresse GN.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EstablishmentPage,
});

function EstablishmentPage() {
  const { number } = Route.useParams();
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [photoActive, setPhotoActive] = useState<string | null>(null);

  const searchQuery = useQuery({
    queryKey: ["search-beacon", number],
    queryFn: () => searchBeacon({ data: { number } }),
    retry: false,
  });

  const detailsQuery = useQuery({
    queryKey: ["establishment", number],
    queryFn: () => getEstablishment({ data: { number } }),
    retry: false,
  });

  const adresse = searchQuery.data?.status === "found" ? searchQuery.data.result : null;
  const etablissement = detailsQuery.data?.establishment ?? null;
  const photos = detailsQuery.data?.photos ?? [];
  const horaires = etablissement?.opening_hours ?? adresse?.opening_hours ?? null;
  const jour = todayKey();

  if (searchQuery.isPending || detailsQuery.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!adresse || !etablissement) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="font-mono text-lg text-primary">{number}</p>
        <p className="mt-2 text-muted-foreground">
          Aucun établissement n'est associé à ce numéro.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/a/$number" params={{ number }}>
            Voir l'adresse
          </Link>
        </Button>
      </div>
    );
  }

  const cover = etablissement.cover_url ?? adresse.cover_url;

  return (
    <div className="mx-auto max-w-3xl pb-10">
      {cover ? (
        <img
          src={cover}
          alt={`Devanture de ${etablissement.business_name}`}
          loading="lazy"
          className="h-52 w-full object-cover sm:h-64"
        />
      ) : (
        <div className="h-40 w-full bg-primary/90 sm:h-52" aria-hidden />
      )}

      <div className="space-y-6 px-4 py-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {etablissement.business_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{categoryLabel(adresse.category)}</Badge>
            {adresse.verification_level === "verified" && (
              <Badge className="bg-accent text-accent-foreground">
                <BadgeCheck className="size-3.5" />
                Vérifié
              </Badge>
            )}
            <span className="font-mono text-sm text-muted-foreground">
              {adresse.public_number}
            </span>
          </div>
          {etablissement.description && (
            <p className="text-sm text-muted-foreground">{etablissement.description}</p>
          )}
        </header>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setDirectionsOpen(true)}
          >
            <Navigation className="size-5" />
            S'y rendre
          </Button>
          {etablissement.phone && (
            <Button asChild variant="outline" size="lg" className="flex-1">
              <a href={`tel:${etablissement.phone}`}>
                <Phone className="size-4" />
                Appeler
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="size-4" />
            Partager
          </Button>
        </div>

        {horaires && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
                <Clock className="size-4" />
                Horaires
              </h2>
              <ul className="mt-3 divide-y divide-border text-sm">
                {DAYS_FR.map((day) => (
                  <li
                    key={day.key}
                    className={`flex justify-between py-2 ${
                      day.key === jour
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span>{day.label}</span>
                    <span className="font-mono">{horaires[day.key] ?? "Fermé"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {photos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-primary">Photos</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setPhotoActive(photo.url)}
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={photo.url}
                    alt={`Photo de ${etablissement.business_name}`}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {adresse.lat !== null && adresse.lng !== null && (
          <section>
            <h2 className="text-lg font-semibold text-primary">Localisation</h2>
            <div className="mt-3 h-64 overflow-hidden rounded-lg border border-border">
              <BeaconMap
                lat={adresse.lat}
                lng={adresse.lng}
                zoom={17}
                label={etablissement.business_name}
              />
            </div>
          </section>
        )}
      </div>

      {adresse.lat !== null && adresse.lng !== null && (
        <DirectionsSheet
          open={directionsOpen}
          onOpenChange={setDirectionsOpen}
          number={adresse.public_number}
          lat={adresse.lat}
          lng={adresse.lng}
        />
      )}
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        number={adresse.public_number}
        name={etablissement.business_name}
      />

      <Dialog open={!!photoActive} onOpenChange={(open) => !open && setPhotoActive(null)}>
        <DialogContent className="max-w-3xl p-2">
          {photoActive && (
            <img
              src={photoActive}
              alt={`Photo de ${etablissement.business_name}`}
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
