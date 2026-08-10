import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  supervisorPlans,
  supervisorCreatePlan,
  supervisorUpdatePlan,
  supervisorDeletePlan,
  supervisorAgents,
  supervisorZones,
  supervisorBeacons,
} from "@/lib/supervisor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarClock, Plus, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/supervisor/_guard/planning")({
  component: SupervisorPlanning,
});

function SupervisorPlanning() {
  const qc = useQueryClient();
  const listFn = useServerFn(supervisorPlans);
  const createFn = useServerFn(supervisorCreatePlan);
  const updateFn = useServerFn(supervisorUpdatePlan);
  const deleteFn = useServerFn(supervisorDeletePlan);
  const agentsFn = useServerFn(supervisorAgents);
  const zonesFn = useServerFn(supervisorZones);
  const beaconsFn = useServerFn(supervisorBeacons);

  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    beaconId: "",
    agentId: "",
    communeId: "",
    scheduledDate: new Date().toISOString().slice(0, 10),
    addressHint: "",
    notes: "",
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ["sup-plans", status],
    queryFn: () => listFn({ data: { status } }),
  });
  const { data: agents } = useQuery({ queryKey: ["sup-agents-list"], queryFn: () => agentsFn() });
  const { data: zones } = useQuery({ queryKey: ["sup-zones-list"], queryFn: () => zonesFn() });
  const { data: beacons } = useQuery({
    queryKey: ["sup-beacons-planning"],
    queryFn: () => beaconsFn({ data: { page: 1, pageSize: 200, statuses: ["generated", "assigned"] } }),
  });

  const create = useMutation({
    mutationFn: (v: any) => createFn({ data: v }),
    onSuccess: () => {
      toast.success("Installation planifiée.");
      qc.invalidateQueries({ queryKey: ["sup-plans"] });
      setOpen(false);
      setForm({ beaconId: "", agentId: "", communeId: "", scheduledDate: new Date().toISOString().slice(0, 10), addressHint: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; patch: any }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Mise à jour effectuée.");
      qc.invalidateQueries({ queryKey: ["sup-plans"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Planification supprimée.");
      qc.invalidateQueries({ queryKey: ["sup-plans"] });
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-indigo-600" />
            Planification des installations
          </h1>
          <p className="text-sm text-slate-600">Assigner des balises à installer à un agent, une zone et une date.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nouvelle planification</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Planifier une installation</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Balise (optionnel)</label>
                <select
                  value={form.beaconId}
                  onChange={(e) => setForm({ ...form, beaconId: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">— Aucune (à décider sur place) —</option>
                  {beacons?.rows.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.public_number} ({b.category ?? "—"})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Agent *</label>
                <select
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {(agents as any[])?.filter((a) => a.active).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.badge_number} — {a.full_name ?? "?"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Commune</label>
                <select
                  value={form.communeId}
                  onChange={(e) => setForm({ ...form, communeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">— Aucune —</option>
                  {zones?.communes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Date prévue *</label>
                <Input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Repère d'adresse</label>
                <Input
                  placeholder="Ex : à côté de la mosquée, en face de la pharmacie…"
                  value={form.addressHint}
                  onChange={(e) => setForm({ ...form, addressHint: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Notes internes</label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button
                disabled={!form.agentId || !form.scheduledDate || create.isPending}
                onClick={() => create.mutate({
                  beaconId: form.beaconId || null,
                  agentId: form.agentId,
                  communeId: form.communeId || null,
                  scheduledDate: form.scheduledDate,
                  addressHint: form.addressHint || null,
                  notes: form.notes || null,
                })}
              >
                Planifier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-2 flex-wrap">
        {[null, "planned", "in_progress", "completed", "cancelled"].map((s) => (
          <Button
            key={s ?? "all"}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(s)}
          >
            {s === null ? "Toutes" : s === "planned" ? "Planifiées" : s === "in_progress" ? "En cours" : s === "completed" ? "Terminées" : "Annulées"}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Chargement…</div>
        ) : !plans || plans.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Aucune planification.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Agent</th>
                <th className="text-left p-3">Balise</th>
                <th className="text-left p-3">Commune</th>
                <th className="text-left p-3">Repère</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(plans as any[]).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{new Date(p.scheduled_date).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3">
                    <div>{p.agent_name ?? "—"}</div>
                    <div className="text-xs font-mono text-slate-500">{p.agent_badge ?? "—"}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{p.beacon_number ?? <span className="text-slate-400 italic">à décider</span>}</td>
                  <td className="p-3">{p.commune_name ?? "—"}</td>
                  <td className="p-3 text-xs text-slate-600 max-w-xs truncate">{p.address_hint ?? "—"}</td>
                  <td className="p-3">
                    <StatutBadge s={p.status} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {p.status === "planned" && (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, patch: { status: "in_progress" } })}>
                          <Play className="h-3 w-3 mr-1" /> Démarrer
                        </Button>
                      )}
                      {p.status === "in_progress" && (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, patch: { status: "completed" } })}>
                          Terminer
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600"
                        onClick={() => { if (confirm("Supprimer cette planification ?")) del.mutate(p.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function StatutBadge({ s }: { s: string }) {
  const map: Record<string, { c: string; l: string }> = {
    planned: { c: "bg-sky-100 text-sky-700", l: "Planifiée" },
    in_progress: { c: "bg-amber-100 text-amber-700", l: "En cours" },
    completed: { c: "bg-emerald-100 text-emerald-700", l: "Terminée" },
    cancelled: { c: "bg-slate-200 text-slate-700", l: "Annulée" },
  };
  const v = map[s] ?? { c: "bg-slate-100 text-slate-700", l: s };
  return <span className={`text-xs px-2 py-0.5 rounded ${v.c}`}>{v.l}</span>;
}
