import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgent } from "@/hooks/useAgent";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agent/_guard/profile")({
  component: Profile,
});

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{valeur}</span>
    </div>
  );
}

function useEspaceLocal() {
  const [mo, setMo] = useState<number | null>(null);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((estimation) => {
      setMo((estimation.usage ?? 0) / (1024 * 1024));
    });
  }, []);

  return mo;
}

function Profile() {
  const { agent } = useAgent();
  const espaceMo = useEspaceLocal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deconnexion = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/agent/login", replace: true });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Profil</h1>

      <Card>
        <CardContent className="py-2">
          <Ligne label="Badge" valeur={agent?.badge_number ?? "—"} />
          <Ligne label="Nom" valeur={agent?.full_name ?? "—"} />
          <Ligne label="Téléphone" valeur={agent?.phone ?? "—"} />
          <Ligne label="Zone d'affectation" valeur={agent?.zone_name ?? "Non affectée"} />
          {espaceMo !== null && (
            <Ligne
              label="Espace utilisé pour la synchro"
              valeur={`${espaceMo.toFixed(1)} Mo`}
            />
          )}
        </CardContent>
      </Card>

      {espaceMo !== null && espaceMo > 50 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Plus de 50 Mo utilisés localement. Synchronisez vos installations en attente pour
            libérer de l'espace.
          </p>
        </div>
      )}

      <Button variant="outline" size="lg" className="w-full" onClick={deconnexion}>
        <LogOut className="size-4" />
        Se déconnecter
      </Button>
    </div>
  );
}
