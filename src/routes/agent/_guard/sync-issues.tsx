import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { agentDb, type QueuedInstall } from "@/lib/agent-db";
import { syncQueue } from "@/lib/agent-sync";
import { categoryLabel } from "@/lib/geo";

export const Route = createFileRoute("/agent/_guard/sync-issues")({
  component: SyncIssues,
});

function SyncIssues() {
  const navigate = useNavigate();
  const [details, setDetails] = useState<QueuedInstall | null>(null);
  const [aSupprimer, setASupprimer] = useState<QueuedInstall | null>(null);

  const items = useLiveQuery(
    () => agentDb.install_queue.where("status").equals("error").toArray(),
    [],
    [] as QueuedInstall[],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Synchronisation</h1>
        <Button size="sm" variant="outline" className="h-11 min-h-11" onClick={() => void syncQueue({ force: true })}>
          <RefreshCw className="size-4" />
          Tout réessayer
        </Button>
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-foreground">Aucune installation en erreur.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Toutes vos installations locales sont synchronisées.
            </p>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="font-mono text-base font-semibold text-foreground">
                      {item.beacon_number}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.last_error ?? "Erreur inconnue"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.attempts} tentative{item.attempts > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="h-11 min-h-11"
                    onClick={async () => {
                      if (item.id) await agentDb.install_queue.update(item.id, {
                        status: "pending",
                        next_attempt_at: null,
                      });
                      await syncQueue({ force: true });
                    }}
                  >
                    <RefreshCw className="size-4" />
                    Réessayer
                  </Button>
                  <Button size="sm" variant="outline" className="h-11 min-h-11" onClick={() => setDetails(item)}>
                    Voir détails
                  </Button>
                  <Button size="sm" variant="ghost" className="h-11 min-h-11" onClick={() => setASupprimer(item)}>
                    <Trash2 className="size-4 text-destructive" />
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <Button variant="outline" className="h-12 w-full" onClick={() => navigate({ to: "/agent/tasks" })}>
        Retour aux tâches
      </Button>

      <AlertDialog open={!!details} onOpenChange={(ouvert) => !ouvert && setDetails(null)}>
        <AlertDialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">{details?.beacon_number}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-left text-sm">
                <p>Catégorie : {details ? categoryLabel(details.category) : "—"}</p>
                <p>Nom : {details?.name || "—"}</p>
                <p>Validée localement le : {details?.created_at.slice(0, 16).replace("T", " ")}</p>
                <p>Mesures GPS : {details?.measures.length ?? 0}</p>
                <p>Photo : {details?.photo_blob ? "présente" : "absente"}</p>
                <p className="break-words">Erreur : {details?.last_error ?? "—"}</p>
                <p className="break-all text-xs text-muted-foreground">
                  Clé locale : {details?.client_uuid}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Fermer</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!aSupprimer} onOpenChange={(ouvert) => !ouvert && setASupprimer(null)}>
        <AlertDialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette installation locale ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les données de la balise {aSupprimer?.beacon_number} seront définitivement perdues et
              devront être ressaisies sur le terrain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (aSupprimer?.id) await agentDb.install_queue.delete(aSupprimer.id);
                setASupprimer(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
