import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAffecterInstallation,
  adminConfirmerPaiement,
  adminInstallationsAPlanifier,
  adminLancerFacturation,
  adminPaiements,
  adminRejeterPaiement,
} from "@/lib/payment.functions";
import { PAYMENT_PROVIDER_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/pricing";

export const Route = createFileRoute("/admin/_guard/payments")({
  head: () => ({
    meta: [
      { title: "Paiements — Back-office Adresse GN" },
      {
        name: "description",
        content:
          "Confirmez les paiements encaissés sur place, rejetez les paiements invalides et planifiez les installations Adresse GN.",
      },
      { property: "og:title", content: "Paiements — Back-office Adresse GN" },
      { property: "og:description", content: "Confirmation manuelle des paiements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaiementsAdminPage,
});

function gnf(m: number): string {
  return `${(m ?? 0).toLocaleString("fr-FR")} GNF`;
}

function PaiementsAdminPage() {
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState("pending");
  const [cible, setCible] = useState<{ id: string; order_ref: string } | null>(null);
  const [refRecu, setRefRecu] = useState("");
  const [note, setNote] = useState("");
  const [rejet, setRejet] = useState<{ id: string; order_ref: string } | null>(null);
  const [motif, setMotif] = useState("");

  const paiements = useQuery({
    queryKey: ["admin-paiements", statut],
    queryFn: () => adminPaiements({ data: { statut, page: 1, pageSize: 50 } }),
  });

  const installations = useQuery({
    queryKey: ["admin-installations-planifier"],
    queryFn: () => adminInstallationsAPlanifier({ data: {} }),
  });

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-paiements"] });
    queryClient.invalidateQueries({ queryKey: ["admin-installations-planifier"] });
  };

  const confirmer = useMutation({
    mutationFn: () =>
      adminConfirmerPaiement({
        data: { paymentId: cible!.id, externalRef: refRecu, note: note || null },
      }),
    onSuccess: (r) => {
      toast.success(`Paiement confirmé — ${r.effets.join(", ")}`);
      setCible(null);
      setRefRecu("");
      setNote("");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejeter = useMutation({
    mutationFn: () => adminRejeterPaiement({ data: { paymentId: rejet!.id, motif } }),
    onSuccess: () => {
      toast.success("Paiement rejeté.");
      setRejet(null);
      setMotif("");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const affecter = useMutation({
    mutationFn: (v: { id: string; agentId: string }) => adminAffecterInstallation({ data: v }),
    onSuccess: () => {
      toast.success("Installation affectée à l'agent.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const facturation = useMutation({
    mutationFn: () => adminLancerFacturation(),
    onSuccess: (r) =>
      toast.success(
        `Facturation exécutée : ${r.crees} échéance(s) créée(s), ${r.suspendus} suspension(s).`,
      ),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Paiements</h2>
          <p className="text-sm text-muted-foreground">
            Confirmez les encaissements réalisés sur place et suivez les installations à
            planifier.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="success">Confirmés</SelectItem>
              <SelectItem value="failed">Échoués</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => facturation.mutate()}
            disabled={facturation.isPending}
          >
            {facturation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Lancer la facturation
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {paiements.data?.total ?? 0} paiement(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {paiements.isPending && <Skeleton className="h-40 w-full" />}
          {!paiements.isPending && !paiements.data?.lignes.length && (
            <p className="text-sm text-muted-foreground">Aucun paiement pour ce filtre.</p>
          )}
          {paiements.data?.lignes.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-foreground">{p.order_ref}</p>
                <p className="text-xs text-muted-foreground">
                  {p.client}
                  {p.client_phone ? ` · ${p.client_phone}` : ""} · {p.offer_code}
                </p>
                {p.external_ref && (
                  <p className="text-xs text-muted-foreground">Reçu : {p.external_ref}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-foreground">{gnf(p.amount_gnf)}</span>
                <Badge variant="secondary">
                  {PAYMENT_PROVIDER_LABELS[p.provider ?? "manual"] ?? p.provider}
                </Badge>
                <Badge variant={p.status === "success" ? "default" : "secondary"}>
                  {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                </Badge>
                {p.status === "pending" && p.provider === "manual" && (
                  <>
                    <Button size="sm" onClick={() => setCible({ id: p.id, order_ref: p.order_ref })}>
                      <CheckCircle2 className="mr-1.5 size-4" />
                      Confirmer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejet({ id: p.id, order_ref: p.order_ref })}
                    >
                      <XCircle className="mr-1.5 size-4" />
                      Rejeter
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Installations à planifier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {installations.isPending && <Skeleton className="h-24 w-full" />}
          {!installations.isPending && !installations.data?.lignes.length && (
            <p className="text-sm text-muted-foreground">Aucune installation en attente.</p>
          )}
          {installations.data?.lignes.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {l.client} · {l.public_number ?? "balise à attribuer"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.order_ref ?? "—"} · {l.note ?? ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={l.status === "assigned" ? "default" : "secondary"}>
                  {l.status === "assigned" ? "Affectée" : "En attente"}
                </Badge>
                <Select
                  value={l.assigned_agent_id ?? ""}
                  onValueChange={(agentId) => affecter.mutate({ id: l.id, agentId })}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Affecter à un agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {(installations.data?.agents ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!cible} onOpenChange={(o) => !o && setCible(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Confirmer le paiement</DialogTitle>
            <DialogDescription>
              Commande {cible?.order_ref}. La confirmation active l'offre et génère la facture.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="recu">Référence du reçu</Label>
              <Input
                id="recu"
                value={refRecu}
                onChange={(e) => setRefRecu(e.target.value)}
                placeholder="REC-2026-0001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note interne (optionnelle)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCible(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => confirmer.mutate()}
              disabled={confirmer.isPending || refRecu.trim().length < 3}
            >
              {confirmer.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmer et activer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejet} onOpenChange={(o) => !o && setRejet(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Rejeter le paiement</DialogTitle>
            <DialogDescription>
              Commande {rejet?.order_ref}. Le client sera notifié du motif.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motif">Motif</Label>
            <Textarea id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejet(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejeter.mutate()}
              disabled={rejeter.isPending || motif.trim().length < 3}
            >
              {rejeter.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
