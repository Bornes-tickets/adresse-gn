import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminTable, StatutBadge, type Colonne } from "@/components/admin/AdminTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOT_STATUSES, formatDateFr, statusLabel } from "@/lib/admin";
import { adminLots, adminUpdateLot } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/lots")({
  head: () => ({
    meta: [
      { title: "Lots de balises — Administration Adresse GN" },
      { name: "description", content: "Suivi des lots de fabrication et de distribution." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLots,
});

function AdminLots() {
  const lister = useServerFn(adminLots);
  const maj = useServerFn(adminUpdateLot);
  const qc = useQueryClient();

  const lots = useQuery({ queryKey: ["admin", "lots"], queryFn: () => lister() });

  const muter = useMutation({
    mutationFn: (v: { id: string; status: string }) => maj({ data: v }),
    onSuccess: () => {
      toast.success("Lot mis à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "lots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof lots.data>[number];

  const colonnes: Colonne<Ligne>[] = [
    { cle: "code", entete: "Code", rendu: (l) => <span className="font-mono">{l.code}</span> },
    { cle: "qte", entete: "Quantité", rendu: (l) => String(l.quantity) },
    { cle: "fournisseur", entete: "Fournisseur", rendu: (l) => l.supplier ?? "—" },
    { cle: "recu", entete: "Reçu le", rendu: (l) => formatDateFr(l.received_at) },
    {
      cle: "affect",
      entete: "Agents affectés",
      rendu: (l) =>
        l.assignations.length === 0
          ? "—"
          : l.assignations.map((a) => a.badge ?? "?").join(", "),
    },
    { cle: "statut", entete: "Statut", rendu: (l) => <StatutBadge valeur={l.status} /> },
    {
      cle: "actions",
      entete: "Changer le statut",
      rendu: (l) => (
        <Select
          value={l.status ?? "created"}
          onValueChange={(v) => muter.mutate({ id: l.id, status: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <AdminTable
      colonnes={colonnes}
      lignes={lots.data ?? []}
      chargement={lots.isLoading}
      cle={(l) => l.id}
    />
  );
}
