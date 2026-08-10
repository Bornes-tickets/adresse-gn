import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supervisorClaims, supervisorDecideClaim } from "@/lib/supervisor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquareWarning, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/supervisor/_guard/claims")({
  component: SupervisorClaims,
});

const STATUTS = [
  { key: null, label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvées" },
  { key: "rejected", label: "Rejetées" },
];

function SupervisorClaims() {
  const qc = useQueryClient();
  const listFn = useServerFn(supervisorClaims);
  const decideFn = useServerFn(supervisorDecideClaim);

  const [filter, setFilter] = useState<string | null>("pending");
  const [decision, setDecision] = useState<{ id: string; d: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sup-claims", filter],
    queryFn: () => listFn({ data: { statut: filter } }),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected"; note?: string | null }) =>
      decideFn({ data: v }),
    onSuccess: () => {
      toast.success("Décision enregistrée.");
      qc.invalidateQueries({ queryKey: ["sup-claims"] });
      setDecision(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquareWarning className="h-6 w-6 text-violet-600" />
          Réclamations d'adresses
        </h1>
        <p className="text-sm text-slate-600">Approuver ou rejeter les demandes de réattribution.</p>
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
        ) : !data || (Array.isArray(data) && data.length === 0) ? (
          <div className="p-8 text-center text-slate-500">Aucune réclamation.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Demandeur</th>
                <th className="text-left p-3">Adresse concernée</th>
                <th className="text-left p-3">Motif</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data as any[]).map((c: any) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <div>{c.requester_name ?? c.requester_email ?? "—"}</div>
                    <div className="text-xs text-slate-500">{c.requester_phone ?? ""}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{c.beacon_number ?? c.address_name ?? "—"}</td>
                  <td className="p-3 max-w-sm truncate text-slate-600">{c.reason ?? c.motif ?? "—"}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {c.created_at ? new Date(c.created_at).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      c.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      c.status === "rejected" ? "bg-rose-100 text-rose-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {c.status ?? "pending"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {c.status !== "approved" && c.status !== "rejected" && (
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 border-emerald-300"
                          onClick={() => setDecision({ id: c.id, d: "approved" })}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-700 border-rose-300"
                          onClick={() => setDecision({ id: c.id, d: "rejected" })}
                        >
                          <X className="h-4 w-4 mr-1" /> Rejeter
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.d === "approved" ? "Approuver la réclamation" : "Rejeter la réclamation"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note interne (optionnelle, max 500 caractères)…"
            rows={4}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Annuler</Button>
            <Button
              className={decision?.d === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
              disabled={decide.isPending}
              onClick={() => decision && decide.mutate({ id: decision.id, decision: decision.d, note: note.trim() || null })}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
