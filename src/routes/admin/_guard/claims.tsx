import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { adminClaims, adminDecideClaim } from "@/lib/admin.functions";
import { CLAIM_STATUS_LABELS } from "@/lib/portal";

export const Route = createFileRoute("/admin/_guard/claims")({
  head: () => ({
    meta: [
      { title: "Réclamations d'adresses — Admin Adresse GN" },
      {
        name: "description",
        content:
          "File de traitement des demandes de propriété d'adresse : vérification des preuves, approbation ou rejet.",
      },
      { property: "og:title", content: "Réclamations d'adresses — Admin Adresse GN" },
      { property: "og:description", content: "Back-office de validation des réclamations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminClaimsPage,
});

type Decision = { id: string; decision: "approved" | "rejected" } | null;

function AdminClaimsPage() {
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState("pending");
  const [decision, setDecision] = useState<Decision>(null);
  const [note, setNote] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["admin-claims", statut],
    queryFn: () => adminClaims({ data: { statut: statut === "all" ? null : statut } }),
  });

  const decider = useMutation({
    mutationFn: () =>
      adminDecideClaim({
        data: { id: decision!.id, decision: decision!.decision, note: note.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Décision enregistrée.");
      setDecision(null);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-claims"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Réclamations d'adresses</h1>
        <p className="text-sm text-muted-foreground">
          Vérifiez les preuves fournies avant d'attribuer la propriété d'une adresse.
        </p>
      </div>

      <Tabs value={statut} onValueChange={setStatut}>
        <TabsList>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="approved">Approuvées</TabsTrigger>
          <TabsTrigger value="rejected">Rejetées</TabsTrigger>
          <TabsTrigger value="all">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending && <Skeleton className="h-40 w-full" />}
      {!isPending && !data?.length && (
        <p className="text-sm text-muted-foreground">Aucune demande dans cette catégorie.</p>
      )}

      <div className="space-y-4">
        {data?.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-mono text-sm text-primary">{c.beacon_number}</p>
                  <p className="text-sm text-foreground">
                    {c.requester_name ?? "Utilisateur"}{" "}
                    {c.requester_phone && (
                      <span className="text-muted-foreground">· {c.requester_phone}</span>
                    )}
                  </p>
                  {c.unclaimed_owner && (
                    <p className="text-xs text-muted-foreground">
                      Occupant relevé à l'installation : {c.unclaimed_owner.name ?? "—"}{" "}
                      {c.unclaimed_owner.phone ?? ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Demande du {new Date(c.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <Badge
                  variant={
                    c.status === "approved"
                      ? "default"
                      : c.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {CLAIM_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
              </div>

              {c.evidence && (
                <p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm text-foreground">
                  {c.evidence}
                </p>
              )}
              {c.decision_note && (
                <p className="text-sm text-muted-foreground">Note : {c.decision_note}</p>
              )}

              {c.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setDecision({ id: c.id, decision: "approved" })}
                  >
                    <Check className="size-4" />
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDecision({ id: c.id, decision: "rejected" })}
                  >
                    <X className="size-4" />
                    Rejeter
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {decision?.decision === "approved"
                ? "Approuver la réclamation"
                : "Rejeter la réclamation"}
            </DialogTitle>
            <DialogDescription>
              {decision?.decision === "approved"
                ? "La propriété de l'adresse sera transférée au demandeur."
                : "Le demandeur sera notifié du refus."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Note de décision (optionnel)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Annuler
            </Button>
            <Button onClick={() => decider.mutate()} disabled={decider.isPending}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
