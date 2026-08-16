// src/routes/a/$number.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, ArrowLeft, Home, Store, Building2, Loader2, AlertTriangle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareBar } from "@/components/public/ShareBar";
import { OnboardingSheet } from "@/components/public/OnboardingSheet";
import { ClaimAddressCard } from "@/components/public/ClaimAddressCard";
import { InstallBanner } from "@/components/InstallBanner";
import { searchBeacon } from "@/lib/search.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/a/$number")({
  component: AddressLanding,
});

const CATEGORY_ICONS: Record<string, { icon: any; label: string; cls: string }> = {
  residential: { icon: Home, label: "Résidentiel", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  professional: { icon: Store, label: "Commerce", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  institutional: { icon: Building2, label: "Institution", cls: "bg-sky-100 text-sky-700 border-sky-200" },
};

function AddressLanding() {
  const { number } = Route.useParams();
  const navigate = useNavigate();
  const searchFn = useServerFn(searchBeacon);

  const q = useQuery({
    queryKey: ["public-address", number],
    queryFn: () => searchFn({ data: { number } }),
  });

  const loading = q.isLoading;
  const data: any = q.data;
  const notFound = data?.status === "not_found";
  const address = data?.address ?? null;
  const beacon = data?.beacon ?? null;

  const cat = address?.category ?? "residential";
  const catInfo = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS['residential']!;
  const CatIcon = catInfo.icon;

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header sticky */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="flex items-center gap-2 px-3 py-3 max-w-md mx-auto">
          <button
            onClick={() => navigate({ to: "/" })}
            className="h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Adresse GN</div>
            <div className="font-mono text-sm font-bold text-slate-900 truncate">{number}</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow shrink-0">
            <QrCode className="h-5 w-5" />
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 space-y-4">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
            <div className="mt-3 text-sm text-slate-500">Chargement de l'adresse…</div>
          </div>
        ) : notFound ? (
          <div className="py-12 text-center">
            <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-10 w-10 text-slate-400" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">Adresse introuvable</h1>
            <p className="mt-2 text-sm text-slate-600">
              Le numéro <span className="font-mono font-bold">{number}</span> n'existe pas dans notre système.
            </p>
            <Button className="mt-6 h-12" onClick={() => navigate({ to: "/" })}>
              Rechercher une autre adresse
            </Button>
          </div>
        ) : (
          <>
            {/* Carte principale */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              {/* Bandeau catégorie */}
              <div className={cn("h-1 bg-gradient-to-r", cat === "residential" ? "from-emerald-500 to-teal-600" : cat === "professional" ? "from-amber-500 to-orange-600" : "from-sky-500 to-blue-600")} />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shrink-0", catInfo.cls)}>
                    <CatIcon className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-slate-900 leading-tight">
                      {address?.name ?? `Adresse ${number}`}
                    </h1>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px]", catInfo.cls)}>
                        <CatIcon className="h-3 w-3 mr-1" />{catInfo.label}
                      </Badge>
                      {address?.verification_level === "verified" && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                          ✓ Vérifiée
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {address?.commune_name && (
                  <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate">{address.commune_name}</span>
                  </div>
                )}

                {address?.access_point_note && (
                  <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                    <div className="font-semibold mb-1">Point d'accès</div>
                    <div>{address.access_point_note}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions de partage + itinéraire */}
            <ShareBar
              numero={number}
              nom={address?.name ?? null}
              lat={address?.point?.lat ?? beacon?.lat ?? null}
              lng={address?.point?.lng ?? beacon?.lng ?? null}
            />

            {/* Revendication propriétaire */}
            <ClaimAddressCard
              numero={number}
              hasOwner={!!address?.owner_id}
              ownerName={address?.owner_name ?? null}
            />

            {/* Établissement (si commerce) */}
            {data?.establishment && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Commerce</div>
                <div className="font-bold text-slate-900">{data.establishment.business_name}</div>
                {data.establishment.description && (
                  <div className="text-sm text-slate-600 mt-1">{data.establishment.description}</div>
                )}
                {data.establishment.phone && (
                  <a href={`tel:${data.establishment.phone}`} className="mt-3 block">
                    <Button variant="outline" className="w-full h-11">
                      {data.establishment.phone}
                    </Button>
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer léger */}
      <footer className="max-w-md mx-auto w-full px-4 py-6 text-center text-xs text-slate-500">
        <div>Un service <a href="/" className="font-semibold text-orange-600">Adresse GN</a></div>
        <div className="mt-1">Système d'adressage numérique de la Guinée</div>
      </footer>

      {/* Onboarding au premier scan */}
      <OnboardingSheet />

      {/* Bannière installation PWA */}
      <InstallBanner variant="bottom" />
    </div>
  );
}

