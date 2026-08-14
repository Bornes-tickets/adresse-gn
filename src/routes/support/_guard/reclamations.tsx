import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MessageSquareWarning, Search, RefreshCw, Download, Check, X, Clock,
  CheckCircle2, XCircle, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTimeFr } from "@/lib/admin";
import { supportClaims, supportDecideClaim } from "@/lib/support.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support/_guard/reclamations")({ component: SupportReclamations });

const STATUTS = [
  { v: "pending", l: "En attente", cls: "bg-amber-100 text-amber-700", icon: Clock },
  { v: "approved", l: "Approuvées", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  { v: "rejected", l: "Rejetées", cls: "bg-rose-100 text-rose-700", icon: XCircle },
];

function SupportReclamations() {
  const listerFn = useServerFn(supportClaims);
  const deciderFn = useServerFn(supportDecideClaim);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<string | null>("pending");
  const [q, setQ] = useState("");
  const [decision, setDecision] = useState<{ id: string; d: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const claims = useQuery({ queryKey: ["support", "claims", filter], queryFn: () => listerFn({ data: { statut: filter } }) });
  useRealtimeInvalidate({ table: "address_claims", invalidate: [["support", "claims"]] });

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected"; note?: string | null }) => deciderFn({ data: v }),
    onSuccess: () => {
      toast.success("Décision enregistrée.");
      qc.invalidateQueries({ queryKey: ["support", "claims"] });
      setDecision(null); setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (claims.data ?? []) as any[];
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter((c) => (c.requester_name ?? "").toLowerCase().includes(t) || (c.beacon_number ?? "").toLowerCase().includes(t) || (c.reason ?? "").toLowerCase().includes(t));
  }, [rows, q]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const c of rows) counts[c.status ?? "pending"] = (counts[c.status ?? "pending"] ?? 0) + 1;
    return counts;
  }, [rows]);

  const csvUrl = useMemo(() => {
    if (!filtered.length) return null;
    const header = "demandeur,email,telephone,adresse,motif,statut,cree\n";
    const lines = filtered.map((c: any) => [c.requester_name ?? "", c.requester_email ?? "", c.requester_phone ?? "", c.beacon_number ?? c.address_name ?? "", c.reason ?? c.motif ?? "", c.status ?? "pending", c.created_at].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><MessageSquareWarning className="h-3.5 w-3.5" /> Tickets</div>
            <h1 className="mt-1 text-3xl font-bold">Réclamations d'adresses</h1>
            <p className="mt-1 text-sm text-white/80">Statuer sur les demandes de réattribution d'adresse.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => { qc.invalidateQueries({ queryKey: ["support", "claims"] }); toast.success("Actualisé."); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Rafraîchir
            </Button>
            {csvUrl && <a href={csvUrl} download={`reclamations_${new Date().toISOString().slice(0,10)}.csv`}><Button variant="secondary" className="bg-white text-sky-700"><Download className="h-4 w-4 mr-1.5" />Export</Button></a>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {STATUTS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.v} onClick={() => setFilter(filter === s.v ? null : s.v)}
              className={cn("text-left p-4 rounded-xl border bg-white transition hover:shadow-md",
                filter === s.v ? "border-sky-600 ring-2 ring-sky-200" : "border-slate-200")}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.l}</div>
                  <div className="text-2xl font-bold mt-1">{stats[s.v] ?? 0}</div>
                </div>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.cls)}><Icon className="h-4 w-4" /></div>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Demandeur, balise, motif…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {claims.isLoading ? <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin" /></div>
          : filtered.length === 0 ? <div className="p-16 text-center text-slate-500">Aucune réclamation.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Demandeur</th>
                    <th className="text-left p-3 font-semibold">Adresse</th>
                    <th className="text-left p-3 font-semibold">Motif</th>
                    <th className="text-left p-3 font-semibold">Date</th>
                    <th className="text-left p-3 font-semibold">Statut</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: any) => {
                    const st = STATUTS.find((s) => s.v === (c.status ?? "pending"));
                    const StIcon = st?.icon ?? Clock;
                    return (
                      <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50/30 transition group">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">{(c.requester_name ?? c.requester_email ?? "?").slice(0, 2).toUpperCase()}</div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{c.requester_name ?? c.requester_email ?? "—"}</div>
                              {c.requester_phone && <div className="text-[10px] text-slate-500">{c.requester_phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs">{c.beacon_number ?? c.address_name ?? "—"}</td>
                        <td className="p-3 max-w-sm truncate text-slate-600 text-xs">{c.reason ?? c.motif ?? "—"}</td>
                        <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(c.created_at)}</td>
                        <td className="p-3"><Badge className={cn("gap-1", st?.cls)}><StIcon className="h-3 w-3" />{st?.l ?? c.status}</Badge></td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end opacity-80 group-hover:opacity-100">
                            {(c.status ?? "pending") === "pending" && (
                              <>
                                <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setDecision({ id: c.id, d: "approved" }); setNote(""); }}>
                                  <Check className="h-3.5 w-3.5 mr-1" />Approuver
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-rose-600 border-rose-300" onClick={() => { setDecision({ id: c.id, d: "rejected" }); setNote(""); }}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
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

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decision?.d === "approved" ? "Approuver la réclamation" : "Rejeter la réclamation"}</DialogTitle></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne (optionnelle, max 500 caractères)…" rows={4} maxLength={500} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Annuler</Button>
            <Button className={decision?.d === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
              onClick={() => decision && decide.mutate({ id: decision.id, decision: decision.d, note: note.trim() || null })} disabled={decide.isPending}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
