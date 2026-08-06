import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel } from "@/lib/geo";

export const Route = createFileRoute("/agent/_guard/history")({
  component: History,
});

type Periode = "jour" | "semaine" | "tout";

function depuis(periode: Periode): string | null {
  const maintenant = new Date();
  if (periode === "jour") {
    maintenant.setHours(0, 0, 0, 0);
    return maintenant.toISOString();
  }
  if (periode === "semaine") {
    maintenant.setDate(maintenant.getDate() - 7);
    return maintenant.toISOString();
  }
  return null;
}

async function chargerHistorique(periode: Periode) {
  let requete = supabase
    .from("installations")
    .select(
      "id, installed_at, validated_at, photo_url, beacons!inner(public_number, addresses(category))",
    )
    .order("installed_at", { ascending: false })
    .limit(100);

  const debut = depuis(periode);
  if (debut) requete = requete.gte("installed_at", debut);

  const { data, error } = await requete;
  if (error) throw error;
  return data ?? [];
}

function History() {
  const [periode, setPeriode] = useState<Periode>("tout");
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["agent-history", periode],
    queryFn: () => chargerHistorique(periode),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Historique</h1>
        <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Tabs value={periode} onValueChange={(v) => setPeriode(v as Periode)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="jour">Aujourd'hui</TabsTrigger>
          <TabsTrigger value="semaine">Cette semaine</TabsTrigger>
          <TabsTrigger value="tout">Tout</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isPending && (data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Clock className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune installation sur cette période.</p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {data?.map((ligne) => {
          const adresses = ligne.beacons?.addresses as
            { category: string } | { category: string }[] | null | undefined;
          const categorie = Array.isArray(adresses)
            ? (adresses[0]?.category ?? null)
            : (adresses?.category ?? null);

          return (
            <li key={ligne.id}>
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  {ligne.photo_url ? (
                    <img
                      src={ligne.photo_url}
                      alt=""
                      className="size-14 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="size-14 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {ligne.beacons?.public_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(categorie)} ·{" "}
                      {ligne.installed_at
                        ? new Date(ligne.installed_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                    <div className="mt-2">
                      <Badge variant={ligne.validated_at ? "default" : "secondary"}>
                        {ligne.validated_at ? "Validée" : "En attente de validation"}
                      </Badge>
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
