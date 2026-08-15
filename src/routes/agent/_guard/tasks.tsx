import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Database, RefreshCw, Wrench, Radio, Search, Sparkles, ListChecks,
  Target, Package, ChevronRight, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnline } from "@/hooks/useOnline";
import { agentDb, mettreEnCacheTaches } from "@/lib/agent-db";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent/_guard/tasks")({ component: Tasks });

const STATUT_LABEL: Record<string, string> = {
  generated: "À installer",
  assigned: "Assignée",
};

async function chargerBalises() {
  const { data: assignations, error: erreurAssignations } = await supabase.from("lot_assignments").select("lot_id");
  if (erreurAssignations) throw erreurAssignations;
  const lots = (assignations ?? []).map((ligne) => ligne.lot_id);
  if (lots.length === 0) return [];
  const { data, error } = await supabase
    .from("beacons")
    .select("id, public_number, status, created_at, lot_id")
    .in("lot_id", lots)
    .in("status", ["assigned", "generated"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const balises = data ?? [];
  await mettreEnCacheTaches(balises.map((b) => ({ beacon_number: b.public_number, category_hint: null })));
  return balises;
}

async function chargerCache() {
  const [taches, meta] = await Promise.all([agentDb.cached_tasks.toArray(), agentDb.meta.get("tasks_cached_at")]);
  return {
    balises: taches.map((t, index) => ({ id: `cache-${index}`, public_number: t.beacon_number, status: "assigned" })),
    cachedAt: meta?.value ?? null,
  };
}

/** Extrait la région du numéro GN-XXX-NNNNNN pour couleur. */
function regionCode(numero: string): string {
  const parts = numero.split("-");
  return parts[1] ?? "XXX";
}

function regionColor(code: string): string {
  const palettes = [
    "from-orange-500 to-rose-600",
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-blue-600",
    "from-violet-500 to-fuchsia-600",
    "from-amber-500 to-orange-600",
    "from-pink-500 to-rose-600",
    "from-indigo-500 to-purple-600",
  ];
  const h = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[h % palettes.length]!;
}

function Tasks() {
  const navigate = useNavigate();
  const isOnline = useOnline();
  const [q, setQ] = useState("");

  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["agent-tasks"],
    queryFn: chargerBalises,
    enabled: isOnline,
  });

  const { data: cache } = useQuery({
    queryKey: ["agent-tasks-cache"],
    queryFn: chargerCache,
    enabled: !isOnline,
  });

  const liste = isOnline ? (data ?? []) : (cache?.balises ?? []);
  const filtered = useMemo(() => {
    if (!q.trim()) return liste;
    return liste.filter((b: any) => (b.public_number ?? "").toLowerCase().includes(q.toLowerCase()));
  }, [liste, q]);

  const total = liste.length;
  const restantes = filtered.length;
  const heureCache = cache?.cachedAt
    ? new Date(cache.cachedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-4">
      {/* Titre + objectif du jour */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-orange-600" />
              Mes tâches
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total > 0 ? `${total} balise${total > 1 ? "s" : ""} à installer` : "Aucune tâche assignée"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-11 min-h-11 rounded-full shadow-sm"
            onClick={() => void refetch()}
            disabled={isFetching || !isOnline}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        {/* Barre de progression / objectif */}
        {total > 0 && (
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 via-white to-rose-50 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white shadow-md">
                  <Target className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">{total}</span>
                    <span className="text-sm text-slate-500">balises</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">Objectif de la tournée</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">
                    <Sparkles className="h-3 w-3" />
                    En cours
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cache indicator */}
      {!isOnline && heureCache && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <Database className="h-3.5 w-3.5 shrink-0" />
          <span>Mode hors ligne · Cache mis à jour à <strong>{heureCache}</strong></span>
        </div>
      )}

      {/* Recherche */}
      {total > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Rechercher un numéro…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11 rounded-xl border-slate-200 bg-white shadow-sm"
          />
        </div>
      )}

      {/* Chargement */}
      {isOnline && isPending && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {/* État vide */}
      {!(isOnline && isPending) && total === 0 && (
        <Card className="border-dashed border-2 border-slate-200 bg-white">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-rose-100">
              <Package className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-base font-semibold text-slate-900">Aucune balise assignée</p>
            <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
              Vos balises à installer apparaîtront ici dès qu'un lot vous sera attribué.
            </p>
          </CardContent>
        </Card>
      )}

      {/* État vide filtre */}
      {total > 0 && filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            Aucune balise ne correspond à "{q}".
          </CardContent>
        </Card>
      )}

      {/* Liste des balises */}
      <ul className="space-y-3">
        {filtered.map((balise: any) => {
          const region = regionCode(balise.public_number);
          const grad = regionColor(region);
          return (
            <li key={balise.id}>
              <Card className="overflow-hidden border-slate-200 hover:shadow-md transition-all active:scale-[0.98]">
                <button
                  className="w-full text-left"
                  onClick={() =>
                    navigate({ to: "/agent/install/$number", params: { number: balise.public_number } })
                  }
                >
                  <div className="flex">
                    {/* Barre latérale colorée */}
                    <div className={cn("w-1.5 bg-gradient-to-b", grad)} />
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shadow-sm", grad)}>
                              <Radio className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-mono text-base font-bold text-slate-900 tracking-tight">
                                {balise.public_number}
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                Zone {region}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-semibold border-0",
                              balise.status === "assigned"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-700",
                            )}
                          >
                            {STATUT_LABEL[balise.status] ?? balise.status}
                          </Badge>
                        </div>

                        <div className={cn(
                          "flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-white font-semibold text-sm shadow-md bg-gradient-to-br shrink-0",
                          grad,
                        )}>
                          <Wrench className="h-4 w-4" />
                          <span>Poser</span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
