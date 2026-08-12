import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock, Search, RefreshCw, Play, CheckCircle2, XCircle, RotateCcw,
  User, Phone, Package, Filter, Clock, ArrowRight, AlertCircle, Users,
  LayoutGrid, List, Calendar as CalIcon, Download, Rows, Rows3, ChevronDown,
  ChevronRight, X, Check, MapPin, TrendingUp, AlertTriangle, Sparkles, Timer,
  Building2, Copy, MoreVertical, Zap, Layers, ArrowUpDown, ArrowUp, ArrowDown,
  MessageCircle, Mail, FileText, History, Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminAffecterInstallation, adminInstallationsAPlanifier, adminStatutInstallationAttente,
} from "@/lib/payment.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/installations-attente")({
  head: () => ({
    meta: [
      { title: "Installations à planifier — Administration Adresse GN" },
      { name: "description", content: "Pipeline complet des demandes d'installation post-paiement." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminInstallationsAttente,
});

const STATUTS = [
  { valeur: "pending", label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", ring: "ring-amber-200", icon: Clock, tone: "from-amber-400 to-orange-500" },
  { valeur: "assigned", label: "Assignée", cls: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500", ring: "ring-sky-200", icon: User, tone: "from-sky-400 to-blue-500" },
  { valeur: "planned", label: "Planifiée", cls: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500", ring: "ring-violet-200", icon: CalendarClock, tone: "from-violet-400 to-fuchsia-500" },
  { valeur: "done", label: "Terminée", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", ring: "ring-emerald-200", icon: CheckCircle2, tone: "from-emerald-400 to-teal-500" },
  { valeur: "cancelled", label: "Annulée", cls: "bg-slate-200 text-slate-700 border-slate-300", dot: "bg-slate-400", ring: "ring-slate-200", icon: XCircle, tone: "from-slate-400 to-slate-500" },
] as const;

type SortKey = "created_at" | "public_number" | "client" | "status";
type SortDir = "asc" | "desc";
type ViewMode = "table" | "kanban" | "calendar";

function ageDays(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}

function slaBadge(days: number, status: string) {
  if (status === "done" || status === "cancelled") return null;
  if (days >= 14) return { cls: "bg-rose-100 text-rose-700 border-rose-300", label: `${days}j · Urgent`, icon: AlertTriangle };
  if (days >= 7) return { cls: "bg-orange-100 text-orange-700 border-orange-300", label: `${days}j · Prioritaire`, icon: Timer };
  if (days >= 3) return { cls: "bg-amber-100 text-amber-700 border-amber-200", label: `${days}j`, icon: Clock };
  return { cls: "bg-slate-100 text-slate-600 border-slate-200", label: `${days}j`, icon: Clock };
}

function AdminInstallationsAttente() {
  const lister = useServerFn(adminInstallationsAPlanifier);
  const affecterFn = useServerFn(adminAffecterInstallation);
  const statuerFn = useServerFn(adminStatutInstallationAttente);
  const qc = useQueryClient();

  const [statut, setStatut] = useState("tous");
  const [agent, setAgent] = useState("tous");
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("tous");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d" | "sla">("all");
  const [view, setView] = useState<ViewMode>("table");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [density, setDensity] = useState<"compact" | "confortable">("confortable");
  const [showWorkload, setShowWorkload] = useState(false);
  const [bulkDialog, setBulkDialog] = useState<null | "assign" | "status">(null);
  const [bulkAgent, setBulkAgent] = useState("");
  const [bulkStatus, setBulkStatus] = useState("planned");

  const filtres = {
    statut: statut === "tous" ? null : statut,
    agentId: agent === "tous" ? null : agent,
  };

  const demandes = useQuery({
    queryKey: ["admin", "pending-installations", filtres],
    queryFn: () => lister({ data: filtres }),
  });

  useRealtimeInvalidate({
    table: "orders",
    invalidate: [["admin", "pending-installations"]],
    toastOnChange: false,
  });

  const rafraichir = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "pending-installations"] });
    toast.success("Liste actualisée.");
  };

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
    if (dateRange !== "all") {
      const now = Date.now();
      if (dateRange === "sla") {
        r = r.filter((l) => ageDays(l.created_at) >= 7 && !["done", "cancelled"].includes(l.status));
      } else {
        const cutoff = dateRange === "today" ? new Date(new Date().setHours(0,0,0,0)).getTime()
          : dateRange === "7d" ? now - 7 * 864e5 : now - 30 * 864e5;
        r = r.filter((l) => new Date(l.created_at).getTime() >= cutoff);
      }
    }
    if (priority !== "tous") {
      r = r.filter((l) => {
        const d = ageDays(l.created_at);
        if (priority === "urgent") return d >= 14;
        if (priority === "prioritaire") return d >= 7 && d < 14;
        if (priority === "normal") return d < 7;
        return true;
      });
    }
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [lignes, q, dateRange, priority, sortKey, sortDir]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, assigned: 0, planned: 0, done: 0, cancelled: 0 };
    let sla = 0;
    for (const l of lignes as any[]) {
      counts[l.status] = (counts[l.status] ?? 0) + 1;
      if (!["done", "cancelled"].includes(l.status) && ageDays(l.created_at) >= 7) sla += 1;
    }
    const openTotal = (counts['pending'] ?? 0) + (counts['assigned'] ?? 0) + (counts['planned'] ?? 0);
    const throughput = counts['done'] ?? 0;
    return { counts, sla, openTotal, throughput, total: lignes.length };
  }, [lignes]);

  const workload = useMemo(() => {
    const map = new Map<string, { agent: any; total: number; pending: number; planned: number; done: number }>();
    for (const a of agents as any[]) map.set(a.id, { agent: a, total: 0, pending: 0, planned: 0, done: 0 });
    for (const l of lignes as any[]) {
      if (!l.assigned_agent_id) continue;
      const cur = map.get(l.assigned_agent_id);
      if (!cur) continue;
      cur.total += 1;
      if (l.status === "pending" || l.status === "assigned") cur.pending += 1;
      if (l.status === "planned") cur.planned += 1;
      if (l.status === "done") cur.done += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.pending + b.planned - (a.pending + a.planned));
  }, [agents, lignes]);

  const csvUrl = useMemo(() => {
    if (!filteredLignes.length) return null;
    const header = "balise,client,telephone,commande,offre,cree_le,statut,agent,age_jours\n";
    const lines = filteredLignes.map((l: any) => [
      l.public_number ?? "", l.client ?? "", l.phone ?? "", l.order_ref ?? "",
      l.offer_code ?? "", l.created_at ?? "", l.status ?? "",
      agents.find((a: any) => a.id === l.assigned_agent_id)?.label ?? "",
      ageDays(l.created_at),
    ].map((v) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [filteredLignes, agents]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const toggleAll = () => {
    const openIds = filteredLignes.filter((l: any) => !["done", "cancelled"].includes(l.status)).map((l: any) => l.id);
    if (openIds.every((id: string) => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(openIds));
  };

  const bulkAssign = async () => {
    if (!bulkAgent) { toast.error("Sélectionne un agent"); return; }
    for (const id of selected) {
      await affecter.mutateAsync({ id, agentId: bulkAgent });
    }
    setSelected(new Set()); setBulkDialog(null); setBulkAgent("");
    toast.success(`${selected.size} demande(s) assignée(s).`);
  };

  const bulkChangeStatus = async () => {
    for (const id of selected) {
      await statuer.mutateAsync({ id, statut: bulkStatus });
    }
    setSelected(new Set()); setBulkDialog(null);
    toast.success(`${selected.size} demande(s) mise(s) à jour.`);
  };

  const activeFilters = [
    q.trim() && { key: "q", label: `"${q}"`, clear: () => setQ("") },
    statut !== "tous" && { key: "s", label: `Statut : ${STATUTS.find((x) => x.valeur === statut)?.label}`, clear: () => setStatut("tous") },
    agent !== "tous" && { key: "a", label: `Agent : ${agents.find((x: any) => x.id === agent)?.label ?? agent}`, clear: () => setAgent("tous") },
    priority !== "tous" && { key: "p", label: `Priorité : ${priority}`, clear: () => setPriority("tous") },
    dateRange !== "all" && { key: "d", label: `Période : ${dateRange === "sla" ? "SLA dépassé" : dateRange}`, clear: () => setDateRange("all") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const completionRate = stats.total > 0 ? Math.round(((stats.throughput ?? 0) / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* HEADER HERO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <CalendarClock className="h-3.5 w-3.5" /> Pipeline · Installations
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-[10px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" /> TEMPS RÉEL
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-bold">Installations à planifier</h1>
            <p className="mt-1 text-sm text-white/80">
              Pipeline complet post-paiement · Assignation · Suivi terrain · SLA
            </p>
          </div>

          {/* Progression complétion */}
          <div className="hidden md:block bg-white/10 backdrop-blur rounded-xl p-3 min-w-[220px]">
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">Taux de complétion</div>
            <div className="text-2xl font-bold mt-0.5">{completionRate}%</div>
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${completionRate}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-white/70">{stats.throughput} sur {stats.total} demandes</div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => setShowWorkload(!showWorkload)}>
              <Users className="h-4 w-4 mr-1.5" /> Workload
            </Button>
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={rafraichir}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
            </Button>
            {csvUrl && (
              <a href={csvUrl} download={`installations_planifier_${new Date().toISOString().slice(0,10)}.csv`}>
                <Button variant="secondary" className="bg-white text-orange-700 hover:bg-white/90">
                  <Download className="h-4 w-4 mr-1.5" /> Exporter
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* KPIs pipeline + SLA */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {STATUTS.map((s) => {
          const Icon = s.icon;
          const active = statut === s.valeur;
          return (
            <button
              key={s.valeur}
              onClick={() => setStatut(active ? "tous" : s.valeur)}
              className={cn(
                "text-left p-4 rounded-xl border transition-all hover:shadow-lg hover:-translate-y-0.5 group relative overflow-hidden",
                active ? "border-slate-900 shadow-lg bg-white ring-2 ring-slate-900" : "border-slate-200 bg-white",
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition", s.tone)} />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.label}</div>
                  <div className="text-2xl font-bold mt-1">{stats.counts[s.valeur] ?? 0}</div>
                  {s.valeur === "pending" && (stats.counts['pending'] ?? 0) > 0 && (
                    <div className="text-[10px] text-slate-500 mt-0.5">à assigner</div>
                  )}
                </div>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.cls)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </button>
          );
        })}
        {/* SLA warning card */}
        <button
          onClick={() => setDateRange(dateRange === "sla" ? "all" : "sla")}
          className={cn(
            "text-left p-4 rounded-xl border transition-all hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden",
            dateRange === "sla"
              ? "border-rose-500 shadow-lg bg-gradient-to-br from-rose-50 to-red-50 ring-2 ring-rose-300"
              : stats.sla > 0
                ? "border-rose-300 bg-gradient-to-br from-rose-50 to-red-50"
                : "border-slate-200 bg-white",
          )}
        >
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
        </button>
      </div>

      <div className={cn("grid gap-4 transition-all", showWorkload ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1")}>
        <div className="space-y-4">
          {/* View switcher + toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {[
                { v: "table" as const, label: "Liste", icon: List },
                { v: "kanban" as const, label: "Kanban", icon: LayoutGrid },
                { v: "calendar" as const, label: "Calendrier", icon: CalIcon },
              ].map((b) => {
                const Ic = b.icon;
                return (
                  <button
                    key={b.v}
                    onClick={() => setView(b.v)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition",
                      view === b.v ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <Ic className="h-3.5 w-3.5" /> {b.label}
                  </button>
                );
              })}
            </div>

            {/* Presets date */}
            <div className="flex items-center gap-1.5">
              {(["all", "today", "7d", "30d"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setDateRange(p)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] rounded-full border font-medium transition",
                    dateRange === p ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400",
                  )}
                >
                  {p === "all" ? "Toutes" : p === "today" ? "Aujourd'hui" : p === "7d" ? "7 jours" : "30 jours"}
                </button>
              ))}
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
                <div className="w-full lg:w-40">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Priorité</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Toutes</SelectItem>
                      <SelectItem value="urgent">🔴 Urgent (≥14j)</SelectItem>
                      <SelectItem value="prioritaire">🟠 Prioritaire (≥7j)</SelectItem>
                      <SelectItem value="normal">⚪ Normal (&lt;7j)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full lg:w-56">
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

              {activeFilters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Filtres actifs</span>
                  {activeFilters.map((f) => (
                    <button key={f.key} onClick={f.clear} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs text-orange-700 hover:bg-orange-100 transition">
                      {f.label} <X className="h-3 w-3" />
                    </button>
                  ))}
                  <button onClick={() => { setQ(""); setStatut("tous"); setAgent("tous"); setPriority("tous"); setDateRange("all"); }} className="text-xs text-slate-500 hover:text-slate-900 underline ml-2">
                    Tout effacer
                  </button>
                </div>
              )}

              {/* Bulk toolbar */}
              {selected.size > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 bg-orange-50/50 -mx-4 -mb-4 px-4 py-3">
                  <div className="text-sm font-semibold text-orange-900">{selected.size} sélection(s)</div>
                  <div className="flex gap-1.5 ml-2">
                    <Button size="sm" variant="outline" className="h-8 border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => setBulkDialog("assign")}>
                      <User className="h-3.5 w-3.5 mr-1" /> Assigner
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => setBulkDialog("status")}>
                      <Layers className="h-3.5 w-3.5 mr-1" /> Changer statut
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={() => setSelected(new Set())}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ============ VUE TABLE ============ */}
          {view === "table" && (
            <Card className="border-slate-200 overflow-hidden">
              {/* Toolbar densité */}
              <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between text-xs">
                <div className="text-slate-500">
                  {filteredLignes.length} ligne(s) · trié par <span className="font-semibold">{sortKey}</span> {sortDir === "asc" ? "↑" : "↓"}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDensity("compact")} className={cn("p-1 rounded transition", density === "compact" ? "bg-orange-100 text-orange-700" : "text-slate-400 hover:bg-slate-100")}>
                    <Rows className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDensity("confortable")} className={cn("p-1 rounded transition", density === "confortable" ? "bg-orange-100 text-orange-700" : "text-slate-400 hover:bg-slate-100")}>
                    <Rows3 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {demandes.isLoading ? (
                <div className="p-16 text-center">
                  <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-orange-600 rounded-full animate-spin mb-3" />
                  <div className="text-sm text-slate-500">Chargement…</div>
                </div>
              ) : filteredLignes.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="w-10 p-2"><Checkbox
                          checked={filteredLignes.filter((l: any) => !["done","cancelled"].includes(l.status)).every((l: any) => selected.has(l.id)) && filteredLignes.some((l: any) => !["done","cancelled"].includes(l.status))}
                          onCheckedChange={toggleAll}
                        /></th>
                        <th className="w-8 p-2" />
                        <SortableTh label="Balise" k="public_number" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                        <SortableTh label="Client" k="client" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                        <th className="text-left p-3 font-semibold">Commande</th>
                        <SortableTh label="Créée" k="created_at" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                        <th className="text-left p-3 font-semibold">Âge / SLA</th>
                        <SortableTh label="Statut" k="status" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                        <th className="text-left p-3 font-semibold">Agent</th>
                        <th className="text-right p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLignes.map((l: any) => (
                        <LigneAttente
                          key={l.id}
                          l={l}
                          agents={agents}
                          selected={selected.has(l.id)}
                          expanded={expanded === l.id}
                          density={density}
                          onSelect={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(l.id); else next.delete(l.id);
                            setSelected(next);
                          }}
                          onToggleExpand={() => setExpanded(expanded === l.id ? null : l.id)}
                          onAssigner={affecter.mutate}
                          onStatuer={statuer.mutate}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ============ VUE KANBAN ============ */}
          {view === "kanban" && (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {STATUTS.map((s) => {
                const items = filteredLignes.filter((l: any) => l.status === s.valeur);
                const Icon = s.icon;
                return (
                  <div key={s.valeur} className="bg-slate-50 rounded-xl border border-slate-200 flex flex-col max-h-[70vh]">
                    <div className="p-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-slate-50 rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                        <span className="text-sm font-semibold">{s.label}</span>
                      </div>
                      <Badge className={s.cls}>{items.length}</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {items.length === 0 ? (
                        <div className="text-xs text-slate-400 text-center py-6 italic">Aucune demande</div>
                      ) : items.map((l: any) => (
                        <KanbanCard key={l.id} l={l} agents={agents} onStatuer={statuer.mutate} onAssigner={affecter.mutate} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============ VUE CALENDRIER ============ */}
          {view === "calendar" && (
            <CalendarView items={filteredLignes} agents={agents} onStatuer={statuer.mutate} />
          )}
        </div>

        {/* ============ PANEL WORKLOAD ============ */}
        {showWorkload && (
          <Card className="border-slate-200 h-fit lg:sticky lg:top-4">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" /> Charge de travail
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Par agent</div>
              </div>
              <button onClick={() => setShowWorkload(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="p-3 max-h-[70vh] overflow-y-auto space-y-2">
              {workload.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">Aucun agent</div>
              ) : workload.map(({ agent: a, total, pending, planned, done }) => {
                const charge = pending + planned;
                const load = charge >= 10 ? "high" : charge >= 5 ? "med" : "low";
                return (
                  <div key={a.id} className={cn(
                    "p-3 rounded-lg border transition hover:shadow-sm",
                    load === "high" ? "border-rose-200 bg-rose-50" : load === "med" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50",
                  )}>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-[10px] font-bold shadow">
                        {(a.label ?? "??").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{a.label}</div>
                        <div className="text-[10px] text-slate-500">
                          {load === "high" ? "Surchargé" : load === "med" ? "Chargé" : "Disponible"}
                        </div>
                      </div>
                      <div className="text-lg font-bold">{charge}</div>
                    </div>
                    <div className="mt-2 flex gap-1 text-[10px]">
                      <span className="flex-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-center">
                        {pending} en attente
                      </span>
                      <span className="flex-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-center">
                        {planned} planifiés
                      </span>
                      <span className="flex-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-center">
                        {done} finis
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Dialog bulk assign */}
      <Dialog open={bulkDialog === "assign"} onOpenChange={(o) => !o && setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assigner {selected.size} demande(s) à un agent</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Agent</Label>
            <Select value={bulkAgent} onValueChange={setBulkAgent}>
              <SelectTrigger><SelectValue placeholder="Choisir un agent…" /></SelectTrigger>
              <SelectContent>
                {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Annuler</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" disabled={!bulkAgent || affecter.isPending} onClick={bulkAssign}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog bulk status */}
      <Dialog open={bulkDialog === "status"} onOpenChange={(o) => !o && setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Changer le statut de {selected.size} demande(s)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Nouveau statut</Label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS.map((s) => <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Annuler</Button>
            <Button className="bg-orange-600 hover:bg-orange-700" disabled={statuer.isPending} onClick={bulkChangeStatus}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================== EMPTY STATE ============================== */

function EmptyState() {
  return (
    <div className="p-16 text-center">
      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">Aucune demande</h3>
      <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
        Aucune demande d'installation ne correspond aux filtres. Toutes les commandes payées sont traitées.
      </p>
    </div>
  );
}

/* ============================== SORTABLE TH ============================== */

function SortableTh({ label, k, cur, dir, onClick }: { label: string; k: SortKey; cur: SortKey; dir: SortDir; onClick: (k: SortKey) => void }) {
  const active = cur === k;
  return (
    <th className="text-left p-3 font-semibold">
      <button onClick={() => onClick(k)} className="inline-flex items-center gap-1 hover:text-orange-600 transition">
        {label}
        {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </button>
    </th>
  );
}

/* ============================== LIGNE TABLE ============================== */

function LigneAttente({
  l, agents, selected, expanded, density, onSelect, onToggleExpand, onAssigner, onStatuer,
}: {
  l: any; agents: any[]; selected: boolean; expanded: boolean; density: "compact" | "confortable";
  onSelect: (v: boolean) => void; onToggleExpand: () => void;
  onAssigner: (v: { id: string; agentId: string }) => void;
  onStatuer: (v: { id: string; statut: string }) => void;
}) {
  const statutInfo = STATUTS.find((s) => s.valeur === l.status) ?? STATUTS[0];
  const StatutIcon = statutInfo.icon;
  const isClose = l.status === "done" || l.status === "cancelled";
  const age = ageDays(l.created_at);
  const sla = slaBadge(age, l.status);
  const SlaIcon = sla?.icon;
  const pad = density === "compact" ? "p-2" : "p-3";

  return (
    <>
      <tr className={cn("border-t border-slate-100 hover:bg-orange-50/30 transition group", selected && "bg-orange-50")}>
        <td className={pad}>
          {!isClose && <Checkbox checked={selected} onCheckedChange={onSelect} />}
        </td>
        <td className={pad}>
          <button onClick={onToggleExpand} className="text-slate-400 hover:text-orange-600 transition p-1">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className={pad}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <Package className="h-4 w-4 text-orange-600" />
            </div>
            <span className="font-mono text-xs font-medium">{l.public_number ?? <span className="text-slate-400 italic">Non attribuée</span>}</span>
          </div>
        </td>
        <td className={pad}>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{l.client}</div>
            {l.phone && <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>}
          </div>
        </td>
        <td className={pad}>
          <div className="min-w-0">
            <div className="font-mono text-xs">{l.order_ref ?? "—"}</div>
            {l.offer_code && <Badge variant="outline" className="text-[10px] mt-0.5">{l.offer_code}</Badge>}
          </div>
        </td>
        <td className={cn(pad, "text-xs text-slate-500")}>{formatDateTimeFr(l.created_at)}</td>
        <td className={pad}>
          {sla && SlaIcon && (
            <Badge className={cn("gap-1", sla.cls)}>
              <SlaIcon className="h-3 w-3" /> {sla.label}
            </Badge>
          )}
        </td>
        <td className={pad}>
          <Badge className={cn("gap-1", statutInfo.cls)}>
            <StatutIcon className="h-3 w-3" /> {statutInfo.label}
          </Badge>
        </td>
        <td className={pad}>
          <Select value={l.assigned_agent_id ?? ""} onValueChange={(agentId) => onAssigner({ id: l.id, agentId })} disabled={isClose}>
            <SelectTrigger className="w-52 h-9 text-xs bg-white"><SelectValue placeholder="Assigner…" /></SelectTrigger>
            <SelectContent>
              {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className={pad}>
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
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {l.phone && (
                  <>
                    <DropdownMenuItem asChild>
                      <a href={`tel:${l.phone}`} className="flex items-center gap-2"><Phone className="h-4 w-4" /> Appeler</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {l.public_number && (
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(l.public_number); toast.success("N° copié."); }}>
                    <Copy className="h-4 w-4 mr-2" /> Copier le n° balise
                  </DropdownMenuItem>
                )}
                {l.order_ref && (
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(l.order_ref); toast.success("Réf. copiée."); }}>
                    <Copy className="h-4 w-4 mr-2" /> Copier la réf. commande
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {!isClose && (
                  <DropdownMenuItem onClick={() => onStatuer({ id: l.id, statut: "cancelled" })} className="text-rose-600">
                    <XCircle className="h-4 w-4 mr-2" /> Annuler
                  </DropdownMenuItem>
                )}
                {isClose && (
                  <DropdownMenuItem onClick={() => onStatuer({ id: l.id, statut: "pending" })}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Réouvrir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/50 border-t border-slate-100">
          <td colSpan={10} className="p-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Détails */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Détails demande</div>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-500">ID interne</span><span className="font-mono text-xs">{l.id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Créée</span><span>{formatDateTimeFr(l.created_at)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Âge</span><span className="font-semibold">{age} jour(s)</span></div>
                  {l.offer_code && (
                    <div className="flex justify-between"><span className="text-slate-500">Offre</span><Badge variant="outline">{l.offer_code}</Badge></div>
                  )}
                </div>
              </div>
              {/* Contact */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Contact client</div>
                <div className="text-sm space-y-1.5">
                  <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /> {l.client}</div>
                  {l.phone && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{l.phone}</span>
                      <a href={`tel:${l.phone}`}><Button size="sm" variant="outline" className="h-6 text-[10px]">Appeler</Button></a>
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-emerald-600 border-emerald-300">WhatsApp</Button>
                      </a>
                    </div>
                  )}
                </div>
              </div>
              {/* Timeline statut */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                  <History className="h-3 w-3" /> Progression pipeline
                </div>
                <div className="flex items-center gap-1">
                  {STATUTS.filter((s) => s.valeur !== "cancelled").map((s, i) => {
                    const idx = STATUTS.findIndex((x) => x.valeur === l.status);
                    const done = i <= idx && l.status !== "cancelled";
                    const Ic = s.icon;
                    return (
                      <div key={s.valeur} className="flex-1 flex items-center">
                        <div className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center transition",
                          done ? `${s.cls} border` : "bg-slate-100 text-slate-400 border border-slate-200",
                        )}>
                          <Ic className="h-3 w-3" />
                        </div>
                        {i < STATUTS.filter((s) => s.valeur !== "cancelled").length - 1 && (
                          <div className={cn("flex-1 h-0.5 mx-1", done ? "bg-slate-400" : "bg-slate-200")} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                  {STATUTS.filter((s) => s.valeur !== "cancelled").map((s) => <span key={s.valeur} className="flex-1 text-center">{s.label}</span>)}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ============================== KANBAN CARD ============================== */

function KanbanCard({ l, agents, onStatuer, onAssigner }: {
  l: any; agents: any[];
  onStatuer: (v: { id: string; statut: string }) => void;
  onAssigner: (v: { id: string; agentId: string }) => void;
}) {
  const age = ageDays(l.created_at);
  const sla = slaBadge(age, l.status);
  const assignedAgent = agents.find((a: any) => a.id === l.assigned_agent_id);
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-xs font-semibold">{l.public_number ?? <span className="text-slate-400 italic text-[10px]">Non attribuée</span>}</div>
        {sla && <Badge className={cn("text-[9px] gap-0.5", sla.cls)}><Clock className="h-2.5 w-2.5" />{sla.label}</Badge>}
      </div>
      <div>
        <div className="text-xs font-medium truncate">{l.client}</div>
        {l.phone && <div className="text-[10px] text-slate-500">{l.phone}</div>}
      </div>
      {l.order_ref && (
        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <FileText className="h-2.5 w-2.5" /> {l.order_ref}
        </div>
      )}
      {assignedAgent && (
        <div className="text-[10px] flex items-center gap-1 text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
          <User className="h-2.5 w-2.5" /> {assignedAgent.label}
        </div>
      )}
      {l.status !== "done" && l.status !== "cancelled" && (
        <div className="flex gap-1 pt-2 border-t border-slate-100">
          {l.status === "pending" && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] flex-1 hover:bg-sky-50 text-sky-700"
              onClick={() => { const first = agents[0]; if (first) onAssigner({ id: l.id, agentId: first.id }); }}>
              <User className="h-3 w-3 mr-1" /> Assigner
            </Button>
          )}
          {l.status === "assigned" && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] flex-1 hover:bg-violet-50 text-violet-700"
              onClick={() => onStatuer({ id: l.id, statut: "planned" })}>
              <CalendarClock className="h-3 w-3 mr-1" /> Planifier
            </Button>
          )}
          {l.status === "planned" && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] flex-1 hover:bg-emerald-50 text-emerald-700"
              onClick={() => onStatuer({ id: l.id, statut: "done" })}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Terminer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================== CALENDRIER ============================== */

function CalendarView({ items, agents, onStatuer }: {
  items: any[]; agents: any[]; onStatuer: (v: { id: string; statut: string }) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstWeekday = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = last.getDate();

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const l of items) {
      const key = (l.created_at ?? "").slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(l);
    }
    return m;
  }, [items]);

  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const dayNames = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <Card className="border-slate-200">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalIcon className="h-4 w-4 text-orange-600" />
          <h3 className="font-semibold text-sm">{monthNames[month]} {year}</h3>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Aujourd'hui</Button>
          <Button size="sm" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200">
        {dayNames.map((d) => <div key={d} className="p-2 text-xs font-semibold text-slate-500 text-center bg-slate-50">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = d ? d.toISOString().slice(0, 10) : "";
          const items = d ? (grouped.get(key) ?? []) : [];
          const isToday = d && d.toDateString() === new Date().toDateString();
          return (
            <div key={i} className={cn(
              "min-h-[90px] p-1.5 border-r border-b border-slate-100 last-of-type:border-r-0",
              !d && "bg-slate-50/50",
              isToday && "bg-orange-50/50",
            )}>
              {d && (
                <>
                  <div className={cn("text-xs font-medium", isToday ? "text-orange-600 font-bold" : "text-slate-600")}>
                    {d.getDate()}
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.slice(0, 3).map((l: any) => {
                      const s = STATUTS.find((x) => x.valeur === l.status) ?? STATUTS[0];
                      return (
                        <div key={l.id} className={cn("text-[9px] px-1.5 py-0.5 rounded truncate", s.cls)}>
                          {l.public_number ?? l.client}
                        </div>
                      );
                    })}
                    {items.length > 3 && <div className="text-[9px] text-slate-500 px-1.5">+{items.length - 3}</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
