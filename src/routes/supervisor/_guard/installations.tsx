import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  supervisorInstallations,
  supervisorReviewInstallation,
  supervisorQcQueue,
} from "@/lib/supervisor.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
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
import { CheckCircle2, XCircle, ClipboardCheck, MapPin, Camera } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/supervisor/_guard/installations")({
  component: SupervisorInstallations,
});

function SupervisorInstallations() {
  const qc = useQueryClient();
  const listFn = useServerFn(supervisorInstallations);
  const queueFn = useServerFn(supervisorQcQueue);
  const reviewFn = useServerFn(supervisorReviewInstallation);

  const [filter, setFilter] = useState<"pending" | "validated" | null>("pending");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [motif, setMotif] = useState("");

  const { data: list, isLoading } = useQuery({
    queryKey: ["sup-installations", filter],
    queryFn: () => listFn({ data: { page: 1, pageSize: 50, validation: filter } }),
  });

  const { data: queue } = useQuery({
    queryKey: ["sup-qc-queue"],
    queryFn: () => queueFn(),
  });

  // Auto-refresh temps réel
  useRealtimeInvalidate({
    table: "installations",
    invalidate: [["sup-installations"], ["sup-qc-queue"]],
  });
  useRealtimeInvalidate({
    table: "reports",
    filter: "reason=eq.qc_recheck",
    invalidate: [["sup-qc-queue"]],
  });

  const review = useMutation({
    mutationFn: (v: { installationId: string | null; reportId: string | null; decision: "valider" | "rejeter"; motif?: string | null }) =>
      reviewFn({ data: v }),
    onSuccess: (_, v) => {
      toast.success(v.decision === "valider" ? "Installation validée." : "Installation rejetée.");
      qc.invalidateQueries({ queryKey: ["sup-installations"] });
      qc.invalidateQueries({ queryKey: ["sup-qc-queue"] });
      setRejectFor(null);
      setMotif("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-indigo-600" />
            Validations d'installations
          </h1>
          <p className="text-sm text-slate-600">
            Valider ou rejeter les balises installées par les agents sur le terrain.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>En attente</Button>
          <Button variant={filter === "validated" ? "default" : "outline"} size="sm" onClick={() => setFilter("validated")}>Validées</Button>
          <Button variant={filter === null ? "default" : "outline"} size="sm" onClick={() => setFilter(null)}>Toutes</Button>
        </div>
      </header>

      {queue && queue.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 font-semibold text-amber-900 mb-2">
            <AlertBadge /> File de contrôle QC ({queue.length})
          </div>
          <div className="space-y-2">
            {queue.slice(0, 5).map((q: any) => (
              <div key={q.report_id} className="flex justify-between text-sm bg-white p-2 rounded">
                <span className="font-mono">{q.beacon_number ?? "—"}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${q.coherence === "ok" ? "bg-emerald-100 text-emerald-700" : q.coherence === "hors_zone" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                  {q.coherence}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => review.mutate({ installationId: q.installation_id, reportId: q.report_id, decision: "valider" })}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectFor(q.installation_id ?? q.report_id)}>
                    <XCircle className="h-3 w-3 mr-1" /> Rejeter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Chargement…</div>
        ) : !list || list.rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Aucune installation.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Balise</th>
                <th className="text-left p-3">Agent</th>
                <th className="text-left p-3">GPS</th>
                <th className="text-left p-3">Précision</th>
                <th className="text-left p-3">Posée le</th>
                <th className="text-left p-3">État</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r: any) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3 font-mono">{r.beacon_number ?? "—"}</td>
                  <td className="p-3">{r.agent_badge ?? "—"}</td>
                  <td className="p-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {r.gps_lat && r.gps_lng ? `${Number(r.gps_lat).toFixed(5)}, ${Number(r.gps_lng).toFixed(5)}` : "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    {r.accuracy_m != null ? (
                      <Badge variant={r.accuracy_m <= 10 ? "default" : r.accuracy_m <= 30 ? "secondary" : "destructive"}>
                        ±{Math.round(r.accuracy_m)}m
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-slate-600">
                    {r.installed_at ? new Date(r.installed_at).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="p-3">
                    {r.validated_at ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Validée</Badge>
                    ) : (
                      <Badge variant="outline">En attente</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {!r.validated_at && (
                      <div className="flex gap-1 justify-end">
                        {r.photo_url && (
                          <a href={r.photo_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost">
                              <Camera className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => review.mutate({ installationId: r.id, reportId: null, decision: "valider" })}
                          disabled={review.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-700 border-rose-300 hover:bg-rose-50"
                          onClick={() => setRejectFor(r.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Rejeter
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

      <Dialog open={rejectFor !== null} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter cette installation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Précisez le motif du rejet. L'agent sera notifié.</p>
            <Textarea
              placeholder="Ex : GPS hors zone, photo illisible, balise mal fixée…"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Annuler</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              disabled={!motif.trim() || review.isPending}
              onClick={() =>
                review.mutate({
                  installationId: rejectFor,
                  reportId: null,
                  decision: "rejeter",
                  motif: motif.trim(),
                })
              }
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertBadge() {
  return <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />;
}
