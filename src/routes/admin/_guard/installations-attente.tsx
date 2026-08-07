import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable, StatutBadge, type Colonne } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminAffecterInstallation,
  adminInstallationsAPlanifier,
  adminStatutInstallationAttente,
} from "@/lib/payment.functions";

export const Route = createFileRoute("/admin/_guard/installations-attente")({
  head: () => ({
    meta: [
      { title: "Installations à planifier — Administration Adresse GN" },
      {
        name: "description",
        content:
          "Gestion des demandes d'installation créées après confirmation de paiement : assignation d'agent et suivi de statut.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminInstallationsAttente,
});

const STATUTS = [
  { valeur: "pending", label: "En attente" },
  { valeur: "assigned", label: "Assignée" },
  { valeur: "planned", label: "Planifiée" },
  { valeur: "done", label: "Terminée" },
  { valeur: "cancelled", label: "Annulée" },
] as const;

function AdminInstallationsAttente() {
  const lister = useServerFn(adminInstallationsAPlanifier);
  const affecterFn = useServerFn(adminAffecterInstallation);
  const statuerFn = useServerFn(adminStatutInstallationAttente);
  const qc = useQueryClient();

  const [statut, setStatut] = useState("tous");
  const [agent, setAgent] = useState("tous");

  const filtres = {
    statut: statut === "tous" ? null : statut,
    agentId: agent === "tous" ? null : agent,
  };

  const demandes = useQuery({
    queryKey: ["admin", "pending-installations", filtres],
    queryFn: () => lister({ data: filtres }),
  });

  const rafraichir = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "pending-installations"] });
  };

  const affecter = useMutation({
    mutationFn: (v: { id: string; agentId: string }) => affecterFn({ data: v }),
    onSuccess: () => {
      toast.success("Agent assigné à la demande d'installation.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statuer = useMutation({
    mutationFn: (v: { id: string; statut: string }) => statuerFn({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agents = demandes.data?.agents ?? [];
  type Ligne = NonNullable<typeof demandes.data>["lignes"][number];

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "balise",
      entete: "Balise",
      rendu: (l) => <span className="font-mono text-sm">{l.public_number ?? "Non attribuée"}</span>,
    },
    {
      cle: "client",
      entete: "Client",
      rendu: (l) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{l.client}</p>
          <p className="text-xs text-muted-foreground">{l.phone ?? "Sans téléphone"}</p>
        </div>
      ),
    },
    {
      cle: "commande",
      entete: "Commande",
      rendu: (l) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{l.order_ref ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{l.offer_code ?? "—"}</p>
        </div>
      ),
    },
    { cle: "date", entete: "Créée le", rendu: (l) => formatDateTimeFr(l.created_at) },
    { cle: "statut", entete: "Statut", rendu: (l) => <StatutBadge valeur={l.status} /> },
    {
      cle: "agent",
      entete: "Agent assigné",
      rendu: (l) => (
        <Select
          value={l.assigned_agent_id ?? ""}
          onValueChange={(agentId) => affecter.mutate({ id: l.id, agentId })}
          disabled={l.status === "done" || l.status === "cancelled"}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Assigner un agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      cle: "actions",
      entete: "Statut",
      rendu: (l) => (
        <div className="flex flex-wrap gap-2">
          {l.status !== "planned" && l.status !== "done" && l.status !== "cancelled" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => statuer.mutate({ id: l.id, statut: "planned" })}
            >
              Planifier
            </Button>
          )}
          {l.status !== "done" && (
            <Button size="sm" onClick={() => statuer.mutate({ id: l.id, statut: "done" })}>
              Terminer
            </Button>
          )}
          {l.status !== "cancelled" && l.status !== "done" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => statuer.mutate({ id: l.id, statut: "cancelled" })}
            >
              Annuler
            </Button>
          )}
          {(l.status === "cancelled" || l.status === "done") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => statuer.mutate({ id: l.id, statut: "pending" })}
            >
              Réouvrir
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Demandes d'installation générées automatiquement après confirmation du paiement d'une
        balise. Assignez un agent puis suivez l'avancement jusqu'à la pose.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-44">
          <Label className="text-xs">Statut</Label>
          <Select value={statut} onValueChange={setStatut}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {STATUTS.map((s) => (
                <SelectItem key={s.valeur} value={s.valeur}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-64">
          <Label className="text-xs">Agent</Label>
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              <SelectItem value="aucun">Non assignées</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={rafraichir} className="w-full sm:ml-auto sm:w-auto">
          Rafraîchir
        </Button>
      </div>

      <AdminTable
        colonnes={colonnes}
        lignes={demandes.data?.lignes ?? []}
        chargement={demandes.isLoading}
        vide="Aucune demande d'installation pour ces filtres."
      />
    </div>
  );
}
