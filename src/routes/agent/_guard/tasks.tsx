import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agent/_guard/tasks")({
  component: Tasks,
});

const STATUT_LABEL: Record<string, string> = {
  generated: "À installer",
  assigned: "Assignée",
};

async function chargerBalises() {
  const { data, error } = await supabase
    .from("beacons")
    .select("id, public_number, status, created_at, lot_id")
    .in("status", ["assigned", "generated"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

function Tasks() {
  const navigate = useNavigate();
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ["agent-tasks"],
    queryFn: chargerBalises,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Tâches</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {isPending && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isPending && (data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              Aucune balise assignée
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Vos balises à installer apparaîtront ici dès qu'elles vous seront
              attribuées.
            </p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {data?.map((balise) => (
          <li key={balise.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold text-foreground">
                    {balise.public_number}
                  </p>
                  <div className="mt-2">
                    <Badge
                      variant={balise.status === "assigned" ? "default" : "secondary"}
                    >
                      {STATUT_LABEL[balise.status] ?? balise.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={() => navigate({ to: "/a/$number", params: { number: balise.public_number } })}
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
