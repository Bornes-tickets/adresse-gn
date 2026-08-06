import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable, StatutBadge, type Colonne } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_STATUSES, formatDateTimeFr, statusLabel } from "@/lib/admin";
import { adminReports, adminUpdateReport } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/reports")({
  head: () => ({
    meta: [
      { title: "Signalements — Administration Adresse GN" },
      { name: "description", content: "Traitement des signalements utilisateurs Adresse GN." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReports,
});

const MOTIFS: Record<string, string> = {
  wrong_position: "Position erronée",
  damaged: "Balise endommagée",
  missing: "Balise absente",
  duplicate: "Doublon",
  other: "Autre",
  qc_sample: "Échantillon contrôle qualité",
  qc_reject: "Rejet contrôle qualité",
};

function AdminReports() {
  const lister = useServerFn(adminReports);
  const maj = useServerFn(adminUpdateReport);
  const qc = useQueryClient();

  const [statut, setStatut] = useState("tous");
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});

  const signalements = useQuery({
    queryKey: ["admin", "reports", statut],
    queryFn: () => lister({ data: { status: statut === "tous" ? null : statut } }),
  });

  const muter = useMutation({
    mutationFn: (v: { id: string; status: string; comment?: string | null }) => maj({ data: v }),
    onSuccess: () => {
      toast.success("Signalement mis à jour, le déclarant est notifié.");
      void qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof signalements.data>[number];

  const colonnes: Colonne<Ligne>[] = [
    { cle: "date", entete: "Reçu le", rendu: (l) => formatDateTimeFr(l.created_at) },
    {
      cle: "balise",
      entete: "Balise",
      rendu: (l) => <span className="font-mono text-sm">{l.beacon_number ?? "—"}</span>,
    },
    { cle: "motif", entete: "Motif", rendu: (l) => MOTIFS[l.reason] ?? l.reason },
    {
      cle: "desc",
      entete: "Description",
      rendu: (l) => <span className="line-clamp-2 max-w-xs">{l.description ?? "—"}</span>,
    },
    {
      cle: "declarant",
      entete: "Déclarant",
      rendu: (l) => (
        <span>
          {l.reporter_name ?? "Anonyme"}
          {l.reporter_phone ? ` · ${l.reporter_phone}` : ""}
        </span>
      ),
    },
    { cle: "statut", entete: "Statut", rendu: (l) => <StatutBadge valeur={l.status} /> },
    {
      cle: "actions",
      entete: "Traitement",
      rendu: (l) => (
        <div className="flex min-w-64 flex-col gap-2">
          <Input
            placeholder="Commentaire au déclarant"
            value={commentaires[l.id] ?? ""}
            onChange={(e) => setCommentaires((c) => ({ ...c, [l.id]: e.target.value }))}
          />
          <div className="flex flex-wrap gap-1">
            {REPORT_STATUSES.filter((s) => s !== l.status).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "rejected" ? "ghost" : "outline"}
                onClick={() =>
                  muter.mutate({ id: l.id, status: s, comment: commentaires[l.id] ?? null })
                }
              >
                {statusLabel(s)}
              </Button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="w-44">
        <Label className="text-xs">Statut</Label>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous</SelectItem>
            {REPORT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AdminTable
        colonnes={colonnes}
        lignes={signalements.data ?? []}
        chargement={signalements.isLoading}
      />
    </div>
  );
}
