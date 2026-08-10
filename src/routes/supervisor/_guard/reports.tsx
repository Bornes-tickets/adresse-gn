import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supervisorReports, supervisorUpdateReport } from "@/lib/supervisor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/supervisor/_guard/reports")({
  component: SupervisorReports,
});

const STATUTS = [
  { key: null, label: "Tous" },
  { key: "new", label: "Nouveaux" },
  { key: "in_review", label: "En cours" },
  { key: "resolved", label: "Résolus" },
  { key: "rejected", label: "Rejetés" },
];

function SupervisorReports() {
  const qc = useQueryClient();
  const listFn = useServerFn(supervisorReports);
  const updateFn = useServerFn(supervisorUpdateReport);

  const [filter, setFilter] = useState<string | null>("new");
  const [editing, setEditing] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState("in_review");
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sup-reports", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status: string; comment?: string | null }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Signalement mis à jour.");
      qc.invalidateQueries({ queryKey: ["sup-reports"] });
      setEditing(null);
      setComment("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          Signalements citoyens
        </h1>
        <p className="text-sm text-slate-600">Traiter les remontées de terrain et notifier les déclarants.</p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {STATUTS.map((s) => (
          <Button
            key={s.label}
            variant={filter === s.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Chargement…</div>
        ) : !data || data.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Aucun signalement.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Balise</th>
                <th className="text-left p-3">Motif</th>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Déclarant</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r: any) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3 font-mono">{r.beacon_number ?? "—"}</td>
                  <td className="p-3">{r.reason}</td>
                  <td className="p-3 max-w-xs truncate text-slate-600">{r.description ?? "—"}</td>
                  <td className="p-3 text-xs">
                    <div>{r.reporter_name ?? "—"}</div>
                    <div className="text-slate-500">{r.reporter_phone ?? ""}</div>
                  </td>
                  <td className="p-3 text-slate-600 text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="p-3">
                    <StatutBadge s={r.status} />
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(r); setNewStatus(r.status); }}>
                      Traiter
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traiter le signalement</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-semibold">{editing.reason}</div>
                <div className="text-slate-600 mt-1">{editing.description}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Nouveau statut</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="new">Nouveau</option>
                  <option value="in_review">En cours</option>
                  <option value="resolved">Résolu</option>
                  <option value="rejected">Rejeté</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Commentaire (optionnel)</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Message notifié au déclarant…"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button
              onClick={() => editing && update.mutate({ id: editing.id, status: newStatus, comment: comment.trim() || null })}
              disabled={update.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatutBadge({ s }: { s: string }) {
  const map: Record<string, { c: string; l: string }> = {
    new: { c: "bg-sky-100 text-sky-700", l: "Nouveau" },
    in_review: { c: "bg-amber-100 text-amber-700", l: "En cours" },
    resolved: { c: "bg-emerald-100 text-emerald-700", l: "Résolu" },
    rejected: { c: "bg-slate-200 text-slate-700", l: "Rejeté" },
  };
  const v = map[s] ?? { c: "bg-slate-100 text-slate-700", l: s };
  return <span className={`text-xs px-2 py-0.5 rounded ${v.c}`}>{v.l}</span>;
}
