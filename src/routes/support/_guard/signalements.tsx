import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Search, RefreshCw, Download, Clock, CheckCircle2, XCircle,
  Phone, MessageCircle, Timer, Radio,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTimeFr } from "@/lib/admin";
import { supportReports, supportUpdateReport } from "@/lib/support.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support/_guard/signalements")({ component: SupportSignalements });

const STATUTS = [
  { v: "new", l: "Nouveau", cls: "bg-sky-100 text-sky-700", icon: AlertTriangle },
  { v: "in_review", l: "En cours", cls: "bg-amber-100 text-amber-700", icon: Clock },
  { v: "resolved", l: "Résolu", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  { v: "rejected", l: "Rejeté", cls: "bg-slate-200 text-slate-700", icon: XCircle },
];

function ageDays(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}

function SupportSignalements() {
  const listerFn = useServerFn(supportReports);
  const majFn = useServerFn(supportUpdateReport);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string | null>("new");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("in_review");
  const [comment, setComment] = useState("");

  const reports = useQuery({ queryKey: ["support", "reports", filter], queryFn: () => listerFn({ data: { status: filter } }) });
  useRealtimeInvalidate({ table: "reports", invalidate: [["support", "reports"]] });

  const maj = useMutation({
    mutationFn: (v: { id: string; status: string; comment?: string | null }) => majFn({ data: v }),
    onSuccess: () => {
      toast.success("Signalement mis à jour, déclarant notifié.");
      qc.invalidateQueries({ queryKey: ["support", "reports"] });
      setEditing(null); setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lignes = (reports.data ?? []) as any[];
  const filtered = useMemo(() => {
    if (!q.trim()) return lignes;
    const t = q.toLowerCase();
    return lignes.filter((r) => (r.reason ?? "").toLowerCase().includes(t) || (r.beacon_number ?? "").toLowerCase().includes(t) || (r.reporter_name ?? "").toLowerCase().includes(t));
  }, [lignes, q]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { new: 0, in_review: 0, resolved: 0, rejected: 0 };
    let urgents = 0;
    for (const r of lignes) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (!["resolved", "rejected"].includes(r.status) && ageDays(r.created_at) >= 7) urgents += 1;
    }
    return { counts, urgents };
  }, [lignes]);

  const csvUrl = useMemo(() => {
    if (!filtered.length) return null;
    const header = "balise,raison,description,declarant,telephone,statut,cree\n";
    const lines = filtered.map((r: any) => [r.beacon_number ?? "", r.reason, r.description ?? "", r.reporter_name ?? "", r.reporter_phone ?? "", r.status, r.created_at].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><AlertTriangle className="h-3.5 w-3.5" /> Tickets</div>
            <h1 className="mt-1 text-3xl font-bold">Signalements citoyens</h1>
            <p className="mt-1 text-sm text-white/80">Traiter les remontées terrain et notifier les déclarants.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => { qc.invalidateQueries({ queryKey: ["support", "reports"] }); toast.success("Actualisé."); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Rafraîchir
            </Button>
            {csvUrl && <a href={csvUrl} download={`signalements_${new Date().toISOString().slice(0,10)}.csv`}><Button variant="secondary" className="bg-white text-sky-700"><Download className="h-4 w-4 mr-1.5" />Export</Button></a>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUTS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.v} onClick={() => setFilter(filter === s.v ? null : s.v)}
              className={cn("text-left p-4 rounded-xl border bg-white transition hover:shadow-md",
                filter === s.v ? "border-sky-600 ring-2 ring-sky-200" : "border-slate-200")}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.l}</div>
                  <div className="text-2xl font-bold mt-1">{stats.counts[s.v] ?? 0}</div>
                </div>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.cls)}><Icon className="h-4 w-4" /></div>
              </div>
            </button>
          );
        })}
        <div className={cn("p-4 rounded-xl border bg-white", stats.urgents > 0 ? "border-rose-300 bg-gradient-to-br from-rose-50 to-red-50" : "border-slate-200")}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-rose-700">Urgents</div>
              <div className={cn("text-2xl font-bold mt-1", stats.urgents > 0 ? "text-rose-700" : "text-slate-400")}>{stats.urgents}</div>
              <div className="text-[10px] text-rose-600 mt-0.5">&gt; 7 jours</div>
            </div>
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", stats.urgents > 0 ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-400")}><Timer className="h-4 w-4" /></div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Raison, balise, déclarant…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {reports.isLoading ? <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin" /></div>
          : filtered.length === 0 ? <div className="p-16 text-center text-slate-500">Aucun signalement.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Balise</th>
                    <th className="text-left p-3 font-semibold">Raison</th>
                    <th className="text-left p-3 font-semibold">Description</th>
                    <th className="text-left p-3 font-semibold">Déclarant</th>
                    <th className="text-left p-3 font-semibold">Âge</th>
                    <th className="text-left p-3 font-semibold">Statut</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => {
                    const st = STATUTS.find((s) => s.v === r.status);
                    const StIcon = st?.icon ?? Clock;
                    const age = ageDays(r.created_at);
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-sky-50/30 transition group">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center"><Radio className="h-4 w-4 text-sky-600" /></div>
                            <span className="font-mono text-xs">{r.beacon_number ?? "—"}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm font-medium">{r.reason}</td>
                        <td className="p-3 max-w-xs truncate text-slate-600 text-xs">{r.description ?? "—"}</td>
                        <td className="p-3">
                          <div className="text-xs">{r.reporter_name ?? "—"}</div>
                          {r.reporter_phone && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{r.reporter_phone}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={cn("text-xs font-medium", age >= 14 ? "text-rose-600" : age >= 7 ? "text-orange-600" : "text-slate-500")}>{age}j</span>
                        </td>
                        <td className="p-3"><Badge className={cn("gap-1", st?.cls)}><StIcon className="h-3 w-3" />{st?.l ?? r.status}</Badge></td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end opacity-70 group-hover:opacity-100">
                            {r.reporter_phone && (
                              <a href={`https://wa.me/${r.reporter_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600"><MessageCircle className="h-3.5 w-3.5" /></Button>
                              </a>
                            )}
                            <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditing(r); setNewStatus(r.status); setComment(""); }}>Traiter</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Traiter le signalement</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-3 text-sm"><div className="font-semibold">{editing.reason}</div><div className="text-slate-600 mt-1 text-xs">{editing.description}</div></div>
              <div>
                <Label className="text-xs">Nouveau statut</Label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1">
                  {STATUTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Commentaire (envoyé au déclarant)</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Ex : Nous avons envoyé une équipe sur place…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => editing && maj.mutate({ id: editing.id, status: newStatus, comment: comment.trim() || null })} disabled={maj.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
