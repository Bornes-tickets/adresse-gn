import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, RefreshCw, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnline } from "@/hooks/useOnline";
import { agentDb, mettreEnCacheTaches } from "@/lib/agent-db";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agent/_guard/tasks")({
  component: Tasks,
});

const STATUT_LABEL: Record<string, string> = {
  generated: "À installer",
  assigned: "Assignée",
};

/** Balises des lots assignés à l'agent connecté, encore installables. */
async function chargerBalises() {
  const { data: assignations, error: erreurAssignations } = await supabase
    .from("lot_assignments")
    .select("lot_id");
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
  await mettreEnCacheTaches(
    balises.map((b) => ({ beacon_number: b.public_number, category_hint: null })),
  );
  return balises;
}

/** Bascule sur le cache local quand le réseau est absent. */
async function chargerCache() {
  const [taches, meta] = await Promise.all([
    agentDb.cached_tasks.toArray(),
    agentDb.meta.get("tasks_cached_at"),
  ]);
  return {
    balises: taches.map((t, index) => ({
      id: `cache-${index}`,
      public_number: t.beacon_number,
      status: "assigned",
    })),
    cachedAt: meta?.value ?? null,
  };
}

function Tasks() {
  const navigate = useNavigate();
  const isOnline = useOnline();
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
  const total = liste.length;
  const heureCache = cache?.cachedAt
    ? new Date(cache.cachedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Tâches</h1>
          <p className="text-sm text-muted-foreground">
            {total} balise{total > 1 ? "s" : ""} à installer
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-11 min-h-11"
          onClick={() => void refetch()}
          disabled={isFetching || !isOnline}
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {!isOnline && heureCache && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Database className="size-3.5" />
          Cache — dernière mise à jour à {heureCache}
        </div>
      )}

      {isOnline && isPending && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!(isOnline && isPending) && total === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-foreground">Aucune balise assignée</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vos balises à installer apparaîtront ici dès qu'un lot vous sera attribué.
            </p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {liste.map((balise) => (
          <li key={balise.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold text-foreground">
                    {balise.public_number}
                  </p>
                  <div className="mt-2">
                    <Badge variant={balise.status === "assigned" ? "default" : "secondary"}>
                      {STATUT_LABEL[balise.status] ?? balise.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="h-12"
                  onClick={() =>
                    navigate({
                      to: "/agent/install/$number",
                      params: { number: balise.public_number },
                    })
                  }
                >
                  <Wrench className="size-4" />
                  Installer
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
