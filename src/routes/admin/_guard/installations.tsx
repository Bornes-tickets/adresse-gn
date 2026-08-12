import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock, Search, RefreshCw, CheckCircle2, XCircle, RotateCcw,
  User, Phone, Package, Clock, AlertTriangle, Users, MoreVertical,
  MessageCircle, Copy, Download, ChevronRight, ChevronDown, Layers,
  ArrowUp, ArrowDown, ArrowUpDown, Timer, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { formatDateTimeFr } from "@/lib/admin";
import { salesInstallationsAPlanifier, salesAffecterInstallation, salesStatutInstallation } from "@/lib/sales.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/installations")({
  component: SalesInstallations,
});

const STATUTS = [
  { valeur: "pending", label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  { valeur: "assigned", label: "Assignée", cls: "bg-sky-100 text-sky-700 border-sky-200", icon: User },
  { valeur: "planned", label: "Planifiée", cls: "bg-violet-100 text-violet-700 border-violet-200", icon: CalendarClock },
  { valeur: "done", label: "Terminée", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  { valeur: "cancelled", label: "Annulée", cls: "bg-slate-200 text-slate-700 border-slate-300", icon: XCircle },
] as const;

function ageDays(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}
function slaBadge(days: number, status: string) {
  if (status === "done" || status === "cancelled") return null;
  if (days >= 14) return { cls: "bg-rose-100 text-rose-700 border-rose-300", label: `${days}j · Urgent`, icon: AlertTriangle };
  if (days >= 7) return { cls: "bg-orange-100 text-orange-700 border-orange-300", label: `${days}j · Prioritaire`, icon: Timer };
  return { cls: "bg-slate-100 text-slate-600 border-slate-200", label: `${days}j`, icon: Clock };
}

function SalesInstallations() {
  const lister = useServerFn(salesInstallationsAPlanifier);
  const affecterFn = useServerFn(salesAffecterInstallation);
  const statuerFn = useServerFn(salesStatutInstallation);
  const qc = useQueryClient();

  const [statut, setStatut] = useState("tous");
  const [agent, setAgent] = useState("tous");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"created_at" | "client">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtres = {
    statut: statut === "tous" ? null : statut,
    agentId: agent === "tous" ? null : agent,
  };

  const demandes = useQuery({
    queryKey: ["sales", "pending-installations", filtres],
    queryFn: () => lister({ data: filtres }),
  });

  useRealtimeInvalidate({
    table: "pending_installations",
    invalidate: [["sales", "pending-installations"]],
  });

  const rafraichir = () => { void qc.invalidateQueries({ queryKey: ["sales", "pending-installations"] }); toast.success("Actualisé."); };

  const affecter = useMutation({
    mutationFn: (v: { id: string; agentId: string }) => affecterFn({ data: v }),
    onSuccess: () => { toast.success("Agent assigné."); rafraichir(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const statuer = useMutation({
    mutationFn: (v: { id: string; statut: string }) => statuerFn({ data: v }),
    onSuccess: () => { toast.success("Statut mis à jour."); rafraichir(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const agents = demandes.data?.agents ?? [];
  const lignes = demandes.data?.lignes ?? [];

  const filteredLignes = useMemo(() => {
    let r = lignes as any[];
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((l) =>
        (l.public_number ?? "").toLowerCase().includes(t) ||
        (l.client ?? "").toLowerCase().includes(t) ||
        (l.order_ref ?? "").toLowerCase().includes(t) ||
        (l.phone ?? "").includes(t),
      );
    }
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [lignes, q, sortKey, sortDir]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, assigned: 0, planned: 0, done: 0, cancelled: 0 };
    let sla = 0;
    for (const l of lignes as any[]) {
      counts[l.status] = (counts[l.status] ?? 0) + 1;
      if (!["done", "cancelled"].includes(l.status) && ageDays(l.created_at) >= 7) sla += 1;
    }
    return { counts, sla, total: lignes.length };
  }, [lignes]);

  const csvUrl = useMemo(() => {
    if (!filteredLignes.length) return null;
    const header = "balise,client,telephone,commande,cree_le,statut,age_jours\n";
    const lines = filteredLignes.map((l: any) => [
      l.public_number ?? "", l.client ?? "", l.phone ?? "", l.order_ref ?? "",
      l.created_at ?? "", l.status ?? "", ageDays(l.created_at),
    ].map((v) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [filteredLignes]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="space-y-6">
      {/* Header hero émeraude */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <CalendarClock className="h-3.5 w-3.5" /> Pipeline post-paiement
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-[10px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> TEMPS RÉEL
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-bold">Installations à planifier</h1>
            <p className="mt-1 text-sm text-white/80">Demandes générées après paiement — assignez un agent et suivez la pose.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={rafraichir}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
            </Button>
            {csvUrl && (
              <a href={csvUrl} download={`installations_${new Date().toISOString().slice(0,10)}.csv`}>
                <Button variant="secondary" className="bg-white text-emerald-700 hover:bg-white/90">
                  <Download className="h-4 w-4 mr-1.5" /> Export CSV
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {STATUTS.map((s) => {
          const Icon = s.icon;
          const active = statut === s.valeur;
          return (
            <button key={s.valeur} onClick={() => setStatut(active ? "tous" : s.valeur)}
              className={cn("text-left p-4 rounded-xl border transition-all hover:shadow-lg hover:-translate-y-0.5 bg-white",
                active ? "border-emerald-600 shadow-lg ring-2 ring-emerald-200" : "border-slate-200")}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.label}</div>
                  <div className="text-2xl font-bold mt-1">{stats.counts[s.valeur] ?? 0}</div>
                </div>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.cls)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </button>
          );
        })}
        <div className={cn("p-4 rounded-xl border bg-white", stats.sla > 0 ? "border-rose-300 bg-gradient-to-br from-rose-50 to-red-50" : "border-slate-200")}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-rose-700">SLA dépassé</div>
              <div className={cn("text-2xl font-bold mt-1", stats.sla > 0 ? "text-rose-700" : "text-slate-400")}>{stats.sla}</div>
              <div className="text-[10px] text-rose-600 mt-0.5">&gt; 7 jours</div>
            </div>
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", stats.sla > 0 ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-400")}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="N° balise, client, commande, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="w-full lg:w-44">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Statut</Label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  {STATUTS.map((s) => <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-64">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Agent</Label>
              <Select value={agent} onValueChange={setAgent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="aucun">Non assignées</SelectItem>
                  {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="border-slate-200 overflow-hidden">
        {demandes.isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin mb-3" />
            <div className="text-sm text-slate-500">Chargement…</div>
          </div>
        ) : filteredLignes.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Aucune demande</h3>
            <p className="text-sm text-slate-600 mt-1">Tous les paiements ont été traités.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="w-8 p-2" />
                  <th className="text-left p-3 font-semibold">Balise</th>
                  <SortableTh label="Client" k="client" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="text-left p-3 font-semibold">Commande</th>
                  <SortableTh label="Créée" k="created_at" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                  <th className="text-left p-3 font-semibold">SLA</th>
                  <th className="text-left p-3 font-semibold">Statut</th>
                  <th className="text-left p-3 font-semibold">Agent</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLignes.map((l: any) => (
                  <LigneAttente key={l.id} l={l} agents={agents}
                    expanded={expanded === l.id}
                    onToggleExpand={() => setExpanded(expanded === l.id ? null : l.id)}
                    onAssigner={affecter.mutate} onStatuer={statuer.mutate} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SortableTh({ label, k, cur, dir, onClick }: { label: string; k: any; cur: any; dir: any; onClick: (k: any) => void }) {
  const active = cur === k;
  return (
    <th className="text-left p-3 font-semibold">
      <button onClick={() => onClick(k)} className="inline-flex items-center gap-1 hover:text-emerald-600 transition">
        {label}
        {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </button>
    </th>
  );
}

function LigneAttente({ l, agents, expanded, onToggleExpand, onAssigner, onStatuer }: any) {
  const statutInfo = STATUTS.find((s) => s.valeur === l.status) ?? STATUTS[0];
  const StatutIcon = statutInfo.icon;
  const isClose = l.status === "done" || l.status === "cancelled";
  const age = ageDays(l.created_at);
  const sla = slaBadge(age, l.status);
  const SlaIcon = sla?.icon;

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-emerald-50/30 transition group">
        <td className="p-2">
          <button onClick={onToggleExpand} className="text-slate-400 hover:text-emerald-600 transition p-1">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
              <Package className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="font-mono text-xs font-medium">{l.public_number ?? <span className="text-slate-400 italic">Non attribuée</span>}</span>
          </div>
        </td>
        <td className="p-3">
          <div className="text-sm font-medium truncate">{l.client}</div>
          {l.phone && <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>}
        </td>
        <td className="p-3">
          <div className="font-mono text-xs">{l.order_ref ?? "—"}</div>
          {l.offer_code && <Badge variant="outline" className="text-[10px] mt-0.5">{l.offer_code}</Badge>}
        </td>
        <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(l.created_at)}</td>
        <td className="p-3">
          {sla && SlaIcon && <Badge className={cn("gap-1", sla.cls)}><SlaIcon className="h-3 w-3" />{sla.label}</Badge>}
        </td>
        <td className="p-3"><Badge className={cn("gap-1", statutInfo.cls)}><StatutIcon className="h-3 w-3" />{statutInfo.label}</Badge></td>
        <td className="p-3">
          <Select value={l.assigned_agent_id ?? ""} onValueChange={(agentId) => onAssigner({ id: l.id, agentId })} disabled={isClose}>
            <SelectTrigger className="w-52 h-9 text-xs bg-white"><SelectValue placeholder="Assigner…" /></SelectTrigger>
            <SelectContent>
              {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className="p-3">
          <div className="flex gap-1 justify-end">
            {!isClose && (
              <>
                <Button size="sm" variant="ghost" className="h-8 text-violet-600 hover:bg-violet-50" onClick={() => onStatuer({ id: l.id, statut: "planned" })}>
                  <CalendarClock className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onStatuer({ id: l.id, statut: "done" })}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {l.phone && (
                  <>
                    <DropdownMenuItem asChild><a href={`tel:${l.phone}`} className="flex items-center gap-2"><Phone className="h-4 w-4" />Appeler</a></DropdownMenuItem>
                    <DropdownMenuItem asChild><a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-emerald-600" />WhatsApp</a></DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {l.order_ref && <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(l.order_ref); toast.success("Copié."); }}><Copy className="h-4 w-4 mr-2" />Copier réf commande</DropdownMenuItem>}
                <DropdownMenuSeparator />
                {!isClose && <DropdownMenuItem onClick={() => onStatuer({ id: l.id, statut: "cancelled" })} className="text-rose-600"><XCircle className="h-4 w-4 mr-2" />Annuler</DropdownMenuItem>}
                {isClose && <DropdownMenuItem onClick={() => onStatuer({ id: l.id, statut: "pending" })}><RotateCcw className="h-4 w-4 mr-2" />Réouvrir</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/50 border-t border-slate-100">
          <td colSpan={9} className="p-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Détails</div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">ID</span><span className="font-mono text-xs">{l.id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Âge</span><span className="font-semibold">{age} jour(s)</span></div>
                  {l.note && <div><span className="text-slate-500">Note :</span><div className="text-xs mt-1 italic">{l.note}</div></div>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Contact</div>
                <div className="space-y-1">
                  <div>{l.client}</div>
                  {l.phone && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`tel:${l.phone}`}><Button size="sm" variant="outline" className="h-7 text-[10px]"><Phone className="h-3 w-3 mr-1" />{l.phone}</Button></a>
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="h-7 text-[10px] text-emerald-600 border-emerald-300"><MessageCircle className="h-3 w-3 mr-1" />WhatsApp</Button></a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
