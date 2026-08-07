import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, Navigation, Phone, Share2 } from "lucide-react";

import { BeaconMap } from "@/components/BeaconMap";
import { DirectionsSheet } from "@/components/DirectionsSheet";
import { ShareSheet } from "@/components/ShareSheet";
import { Button } from "@/components/ui/button";
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
    <div className="pb-16">
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={`Devanture de ${etablissement.business_name}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="gradient-signature size-full" aria-hidden />
        )}
        <div
          className="absolute inset-0 bg-linear-to-t from-slate-950/85 via-slate-950/35 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-4xl px-4 pb-8 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {categoryLabel(adresse.category)}
              </span>
              {adresse.verification_level === "verified" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  <BadgeCheck className="size-3.5" />
                  Vérifié
                </span>
              )}
              <span className="font-mono text-sm text-white/80">
                {adresse.public_number}
              </span>
            </div>
            <h1 className="text-display mt-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {etablissement.business_name}
            </h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="shadow-brand-lg -mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-card p-4 sm:flex-row sm:p-5">
          <Button
            size="lg"
            className="gradient-accent h-12 flex-1 text-base font-medium text-accent-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => setDirectionsOpen(true)}
          >
            <Navigation className="size-5" />
            S'y rendre
          </Button>
          {etablissement.phone && (
            <Button asChild variant="outline" size="lg" className="h-12 flex-1">
              <a href={`tel:${etablissement.phone}`}>
                <Phone className="size-4" />
                Appeler
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            className="h-12 flex-1"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="size-4" />
            Partager
          </Button>
        </div>

        {etablissement.description && (
          <p className="mt-10 max-w-2xl text-base leading-relaxed text-slate-500">
            {etablissement.description}
          </p>
        )}

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-12">
            {photos.length > 0 && (
              <section>
                <h2 className="text-display text-2xl font-bold text-foreground">
                  Photos
                </h2>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setPhotoActive(photo.url)}
                      className="group overflow-hidden rounded-xl border border-slate-200/60"
                    >
                      <img
                        src={photo.url}
                        alt={`Photo de ${etablissement.business_name}`}
                        loading="lazy"
                        className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {adresse.lat !== null && adresse.lng !== null && (
              <section>
                <h2 className="text-display text-2xl font-bold text-foreground">
                  Localisation
                </h2>
                <div className="shadow-brand mt-5 h-[60vh] overflow-hidden rounded-2xl border border-slate-200/60 md:h-[70vh]">
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

          {horaires && (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-slate-200/60 bg-card p-6">
                <h2 className="text-display flex items-center gap-2 text-lg font-bold text-foreground">
                  <Clock className="size-4 text-accent" />
                  Horaires
                </h2>
                <ul className="mt-4 divide-y divide-border text-sm">
                  {DAYS_FR.map((day) => (
                    <li
                      key={day.key}
                      className={`flex justify-between py-2.5 ${
                        day.key === jour
                          ? "font-semibold text-foreground"
                          : "text-slate-500"
                      }`}
                    >
                      <span>{day.label}</span>
                      <span className="font-mono">{horaires[day.key] ?? "Fermé"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}
        </div>
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
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto p-2 sm:w-full">
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
