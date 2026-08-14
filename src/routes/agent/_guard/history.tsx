import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, RefreshCw, CheckCircle2, Timer, TrendingUp, Camera, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel } from "@/lib/geo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent/_guard/history")({ component: History });

type Periode = "jour" | "semaine" | "tout";

function depuis(periode: Periode): string | null {
  const maintenant = new Date();
  if (periode === "jour") { maintenant.setHours(0, 0, 0, 0); return maintenant.toISOString(); }
  if (periode === "semaine") { maintenant.setDate(maintenant.getDate() - 7); return maintenant.toISOString(); }
  return null;
}

async function chargerHistorique(periode: Periode) {
  let requete = supabase
    .from("installations")
    .select("id, installed_at, validated_at, photo_url, beacons!inner(public_number, addresses(category))")
    .order("installed_at", { ascending: false })
    .limit(100);
  const debut = depuis(periode);
  if (debut) requete = requete.gte("installed_at", debut);
  const { data, error } = await requete;
  if (error) throw error;
  return data ?? [];
}

function History() {
  const [periode, setPeriode] = useState<Periode>("jour");
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["agent-history", periode],
    queryFn: () => chargerHistorique(periode),
  });

  const lignes = data ?? [];
  const stats = useMemo(() => ({
    total: lignes.length,
    validees: lignes.filter((l: any) => l.validated_at).length,
    enAttente: lignes.filter((l: any) => !l.validated_at).length,
  }), [lignes]);

  const tauxValidation = stats.total > 0 ? Math.round((stats.validees / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-emerald-600" />
            Historique
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Vos installations récentes</p>
        </div>
        <Button size="sm" variant="outline" className="h-11 min-h-11 rounded-full shadow-sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-slate-200 bg-gradient-to-br from-sky-50 to-blue-50">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Validées</div>
            <div className="text-2xl font-bold text-emerald-900 mt-0.5">{stats.validees}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold">Attente</div>
            <div className="text-2xl font-bold text-amber-900 mt-0.5">{stats.enAttente}</div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de progression validation */}
      {stats.total > 0 && (
        <Card className="border-slate-200 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700">Taux de validation</span>
              </div>
              <span className="text-lg font-bold text-emerald-700">{tauxValidation}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all" style={{ width: `${tauxValidation}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtre période — pill design */}
      <div className="flex gap-2 bg-slate-100 rounded-full p-1">
        {[
          { v: "jour" as const, l: "Aujourd'hui" },
          { v: "semaine" as const, l: "7 jours" },
          { v: "tout" as const, l: "Tout" },
        ].map((p) => (
          <button
            key={p.v}
            onClick={() => setPeriode(p.v)}
            className={cn(
              "flex-1 px-3 py-2 rounded-full text-xs font-semibold transition-all",
              periode === p.v
                ? "bg-white text-slate-900 shadow-md"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {p.l}
          </button>
        ))}
      </div>

      {/* Chargement */}
      {isPending && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {/* État vide */}
      {!isPending && lignes.length === 0 && (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100">
              <Clock className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-base font-semibold text-slate-900">Aucune installation</p>
            <p className="mt-2 text-sm text-slate-500">Aucune pose enregistrée sur cette période.</p>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <ul className="space-y-3">
        {lignes.map((ligne: any, i: number) => {
          const adresses = ligne.beacons?.addresses as { category: string } | { category: string }[] | null | undefined;
          const categorie = Array.isArray(adresses) ? (adresses[0]?.category ?? null) : (adresses?.category ?? null);
          const date = ligne.installed_at ? new Date(ligne.installed_at) : null;
          return (
            <li key={ligne.id}>
              <Card className="overflow-hidden border-slate-200 hover:shadow-md transition">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {/* Vignette photo ou placeholder */}
                    {ligne.photo_url ? (
                      <img
                        src={ligne.photo_url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg border-2 border-white shadow-sm object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Camera className="h-6 w-6 text-slate-400" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Radio className="h-3.5 w-3.5 text-orange-600" />
                        <span className="font-mono text-sm font-bold text-slate-900">{ligne.beacons?.public_number}</span>
                      </div>
                      <div className="text-xs text-slate-500 mb-1.5">
                        {categoryLabel(categorie)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Timer className="h-3 w-3" />
                          {date ? date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </div>
                        {ligne.validated_at ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Validée
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1 text-[10px]">
                            <Timer className="h-3 w-3" /> En attente
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
