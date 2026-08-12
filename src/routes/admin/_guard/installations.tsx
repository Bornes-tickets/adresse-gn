import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardCheck, Search, Download, Zap, MapPin, Camera, User, Filter,
  CheckCircle2, XCircle, Clock, TrendingUp, AlertTriangle, Award, Target,
  Sparkles, ArrowUpRight, RefreshCw, Eye, Edit3, Radio, Building2,
  ArrowUpDown, ArrowUp, ArrowDown, Rows3, Rows, ChevronDown, ChevronRight,
  Wifi, X, Calendar, Activity, ImageOff, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeFr } from "@/lib/admin";
import {
  adminAgentMetrics, adminAgents, adminDrawQc, adminInstallations,
  adminQcQueue, adminReviewInstallation,
} from "@/lib/admin.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/installations")({
  head: () => ({
    meta: [
      { title: "Installations & contrôle qualité — Administration Adresse GN" },
      { name: "description", content: "Suivi des installations terrain et file de contrôle qualité." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminInstallations,
});

type SortKey = "installed_at" | "accuracy_m" | "beacon_number" | "agent_badge";
type SortDir = "asc" | "desc";

function AdminInstallations() {
  const lister = useServerFn(adminInstallations);
  const tirer = useServerFn(adminDrawQc);
  const file = useServerFn(adminQcQueue);
  const statuer = useServerFn(adminReviewInstallation);
  const listerAgents = useServerFn(adminAgents);
  const metriques = useServerFn(adminAgentMetrics);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [agentId, setAgentId] = useState("tous");
  const [validation, setValidation] = useState("tous");
  const [precisionMax, setPrecisionMax] = useState("");
  const [q, setQ] = useState("");
  const [pourcentage, setPourcentage] = useState("10");
  const [rejectFor, setRejectFor] = useState<{ installationId: string | null; reportId: string | null } | null>(null);
  const [motif, setMotif] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("installed_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [density, setDensity] = useState<"compact" | "confortable">("confortable");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "7d" | "30d">("all");

  const now = Date.now();
  const dateFrom = datePreset === "today" ? new Date(new Date().setHours(0,0,0,0)).toISOString()
    : datePreset === "7d" ? new Date(now - 7 * 864e5).toISOString()
    : datePreset === "30d" ? new Date(now - 30 * 864e5).toISOString()
    : null;

  const filtres = {
    page, pageSize: 20,
    agentId: agentId === "tous" ? null : agentId,
    validation: validation === "tous" ? null : validation,
    accuracyMax: precisionMax ? Number(precisionMax) : null,
    from: dateFrom,
  };

  const installations = useQuery({
    queryKey: ["admin", "installations", filtres],
    queryFn: () => lister({ data: filtres }),
  });
  const agents = useQuery({ queryKey: ["admin", "agents"], queryFn: () => listerAgents() });
  const fileQc = useQuery({ queryKey: ["admin", "qc-queue"], queryFn: () => file() });
  const perfs = useQuery({ queryKey: ["admin", "agent-metrics"], queryFn: () => metriques() });

  useRealtimeInvalidate({
    table: "installations",
    invalidate: [["admin", "installations"], ["admin", "qc-queue"], ["admin", "agent-metrics"]],
  });
  useRealtimeInvalidate({
    table: "reports",
    filter: "reason=eq.qc_recheck",
    invalidate: [["admin", "qc-queue"]],
  });

  const muterTirage = useMutation({
    mutationFn: () => tirer({ data: { percent: Number(pourcentage) } }),
    onSuccess: (r) => {
      toast.success(`${r.tirees} installation(s) versée(s) dans la file de contrôle.`);
      void qc.invalidateQueries({ queryKey: ["admin", "qc-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterDecision = useMutation({
    mutationFn: (v: { installationId: string | null; reportId: string | null; decision: "valider" | "rejeter"; motif?: string | null }) =>
      statuer({ data: { ...v, motif: v.motif ?? null } }),
    onSuccess: (_, v) => {
      toast.success(v.decision === "valider" ? "Installation validée." : "Installation rejetée.");
      setRejectFor(null);
      setMotif("");
      void qc.invalidateQueries({ queryKey: ["admin", "qc-queue"] });
      void qc.invalidateQueries({ queryKey: ["admin", "installations"] });
      void qc.invalidateQueries({ queryKey: ["admin", "agent-metrics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = installations.data?.rows ?? [];

  const filteredRows = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((row: any) =>
        (row.beacon_number ?? "").toLowerCase().includes(t) ||
        (row.agent_badge ?? "").toLowerCase().includes(t),
      );
    }
    r = [...r].sort((a: any, b: any) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (sortKey === "accuracy_m") return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, q, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = installations.data?.total ?? 0;
    const validees = rows.filter((r: any) => r.validated_at).length;
    const enAttente = rows.filter((r: any) => !r.validated_at).length;
    const precisionMoy = (() => {
      const p = rows.filter((r: any) => r.accuracy_m != null);
      if (!p.length) return null;
      return Math.round(p.reduce((s: number, r: any) => s + Number(r.accuracy_m), 0) / p.length);
    })();
    return { total, validees, enAttente, precisionMoy };
  }, [rows, installations.data]);

  // Sparkline : installations par jour sur 7 derniers jours
  const sparkline = useMemo(() => {
    const counts = new Array(7).fill(0);
    const start = new Date(now - 6 * 864e5).setHours(0,0,0,0);
    for (const r of rows) {
      if (!r.installed_at) continue;
      const d = new Date(r.installed_at).setHours(0,0,0,0);
      const idx = Math.round((d - start) / 864e5);
      if (idx >= 0 && idx < 7) counts[idx] += 1;
    }
    return counts;
  }, [rows, now]);

  const csvUrl = useMemo(() => {
    if (!rows.length) return null;
    const header = "balise,agent,latitude,longitude,precision_m,posee_le,validee_le\n";
    const lines = rows.map((r: any) => [
      r.beacon_number ?? "", r.agent_badge ?? "", r.gps_lat ?? "", r.gps_lng ?? "",
      r.accuracy_m ?? "", r.installed_at ?? "", r.validated_at ?? "",
    ].map((v) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [rows]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const toggleAll = () => {
    const pending = filteredRows.filter((r: any) => !r.validated_at).map((r: any) => r.id);
    if (pending.every((id: string) => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(pending));
  };

  const bulkValidate = async () => {
    for (const id of selected) {
      await muterDecision.mutateAsync({ installationId: id, reportId: null, decision: "valider" });
    }
    setSelected(new Set());
    toast.success(`${selected.size} installation(s) validée(s) en lot.`);
  };

  const activeFilters = [
    q.trim() && { key: "q", label: `Recherche : "${q}"`, clear: () => setQ("") },
    agentId !== "tous" && { key: "agent", label: `Agent : ${(agents.data ?? []).find((a: any) => a.id === agentId)?.badge_number ?? "?"}`, clear: () => setAgentId("tous") },
    validation !== "tous" && { key: "val", label: `État : ${validation === "validated" ? "Validées" : "En attente"}`, clear: () => setValidation("tous") },
    precisionMax && { key: "prec", label: `Précision ≤ ${precisionMax}m`, clear: () => setPrecisionMax("") },
    datePreset !== "all" && { key: "date", label: `Période : ${datePreset === "today" ? "aujourd'hui" : datePreset}`, clear: () => setDatePreset("all") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const rowPadding = density === "compact" ? "p-2" : "p-3";

  return (
    <div className="space-y-6">
      {/* HEADER HERO avec indicateur temps réel + sparkline */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <ClipboardCheck className="h-3.5 w-3.5" /> Administration
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-[10px] font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" /> LIVE
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-bold">Installations & Contrôle qualité</h1>
            <p className="mt-1 text-sm text-white/80">Suivi terrain temps réel, validation QC, performances agents.</p>
          </div>
          {/* Mini sparkline 7 jours */}
          <div className="hidden lg:flex flex-col items-end gap-2">
            <div className="text-xs text-white/70 uppercase tracking-wider font-semibold">7 derniers jours</div>
            <Sparkline data={sparkline} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20"
              onClick={() => { void qc.invalidateQueries({ queryKey: ["admin", "installations"] }); toast.success("Actualisé."); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Actualiser
            </Button>
            {csvUrl && (
              <a href={csvUrl} download={`installations_${new Date().toISOString().slice(0,10)}.csv`}>
                <Button variant="secondary" className="bg-white text-indigo-700 hover:bg-white/90">
                  <Download className="h-4 w-4 mr-1.5" /> Export CSV
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total installations" value={stats.total} icon={ClipboardCheck} tone="indigo" trend={null} />
        <KpiCard label="Validées" value={stats.validees} icon={CheckCircle2} tone="emerald" trend={stats.total > 0 ? `${Math.round((stats.validees / stats.total) * 100)}%` : null} />
        <KpiCard label="En attente" value={stats.enAttente} icon={Clock} tone="amber" trend={null} />
        <KpiCard label="Précision moy." value={stats.precisionMoy ?? "—"} suffix={stats.precisionMoy != null ? " m" : ""} icon={Target} tone={stats.precisionMoy != null && stats.precisionMoy > 15 ? "rose" : "sky"} trend={null} />
      </div>

      <Tabs defaultValue="liste" className="space-y-4">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="liste" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ClipboardCheck className="h-4 w-4" /> Installations
            <Badge variant="secondary" className="ml-1 bg-indigo-100 text-indigo-700">{stats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="qc" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <AlertTriangle className="h-4 w-4" /> File QC
            {fileQc.data && fileQc.data.length > 0 && (
              <Badge className="ml-1 bg-amber-100 text-amber-700 border-amber-200">{fileQc.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="perfs" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Award className="h-4 w-4" /> Performance agents
          </TabsTrigger>
        </TabsList>

        {/* ==================== ONGLET LISTE ==================== */}
        <TabsContent value="liste" className="space-y-4">

          {/* Presets date rapide */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Période
            </span>
            {(["all", "today", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setDatePreset(p); setPage(1); }}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition font-medium",
                  datePreset === p
                    ? "bg-indigo-600 text-white border-indigo-600 shadow"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300",
                )}
              >
                {p === "all" ? "Tout" : p === "today" ? "Aujourd'hui" : p === "7d" ? "7 jours" : "30 jours"}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden border-slate-200">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 p-4 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-end">
                <div className="flex-1 min-w-0">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="N° de balise ou badge agent…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 bg-white" />
                  </div>
                </div>
                <div className="w-full lg:w-48">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Agent</Label>
                  <Select value={agentId} onValueChange={(v) => { setAgentId(v); setPage(1); }}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Tous les agents</SelectItem>
                      {(agents.data ?? []).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.badge_number} — {a.full_name ?? "?"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full lg:w-36">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">État</Label>
                  <Select value={validation} onValueChange={(v) => { setValidation(v); setPage(1); }}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Toutes</SelectItem>
                      <SelectItem value="validated">Validées</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full lg:w-36">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Précision max (m)</Label>
                  <Input type="number" value={precisionMax} onChange={(e) => { setPrecisionMax(e.target.value); setPage(1); }} className="bg-white" placeholder="Ex : 15" />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-violet-500" /> Contrôle qualité aléatoire
                  </Label>
                  <p className="text-xs text-slate-600">Verser un échantillon des installations non validées dans la file de contrôle.</p>
                </div>
                <div className="w-24">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">%</Label>
                  <Input type="number" min={1} max={100} value={pourcentage} onChange={(e) => setPourcentage(e.target.value)} className="bg-white" />
                </div>
                <Button onClick={() => muterTirage.mutate()} disabled={muterTirage.isPending} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-md">
                  <Zap className="h-4 w-4 mr-1.5" /> Lancer le tirage
                </Button>
              </div>
            </div>

            {/* Chips filtres actifs + toolbar densité + bulk */}
            {(activeFilters.length > 0 || selected.size > 0) && (
              <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap items-center gap-2">
                {activeFilters.map((f) => (
                  <button key={f.key} onClick={f.clear}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-indigo-200 text-xs text-indigo-700 hover:bg-indigo-100 transition">
                    {f.label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                {selected.size > 0 && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-medium text-indigo-700">{selected.size} sélectionnée(s)</span>
                    <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={bulkValidate} disabled={muterDecision.isPending}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Valider en lot
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Toolbar densité + tri actuel */}
            <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                {filteredRows.length} ligne(s) · trié par <span className="font-semibold">{sortKey}</span> {sortDir === "asc" ? "↑" : "↓"}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Densité :</span>
                <button onClick={() => setDensity("compact")}
                  className={cn("p-1 rounded transition", density === "compact" ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:bg-slate-100")}>
                  <Rows className="h-4 w-4" />
                </button>
                <button onClick={() => setDensity("confortable")}
                  className={cn("p-1 rounded transition", density === "confortable" ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:bg-slate-100")}>
                  <Rows3 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {installations.isLoading ? (
              <div className="p-16 text-center">
                <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-3" />
                <div className="text-sm text-slate-500">Chargement…</div>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="p-16 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <div className="text-sm text-slate-500">Aucune installation ne correspond aux filtres.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="w-10 p-2">
                        <Checkbox
                          checked={filteredRows.filter((r: any) => !r.validated_at).every((r: any) => selected.has(r.id)) && filteredRows.some((r: any) => !r.validated_at)}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="w-8 p-2" />
                      <SortableTh label="Balise" k="beacon_number" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Agent" k="agent_badge" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                      <th className="text-left p-3 font-semibold">GPS</th>
                      <SortableTh label="Précision" k="accuracy_m" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                      <SortableTh label="Posée le" k="installed_at" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                      <th className="text-left p-3 font-semibold">Photo</th>
                      <th className="text-left p-3 font-semibold">État</th>
                      <th className="text-right p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r: any) => (
                      <RowInstall
                        key={r.id}
                        r={r}
                        padding={rowPadding}
                        selected={selected.has(r.id)}
                        expanded={expanded === r.id}
                        onSelect={(v) => {
                          const next = new Set(selected);
                          if (v) next.add(r.id); else next.delete(r.id);
                          setSelected(next);
                        }}
                        onToggleExpand={() => setExpanded(expanded === r.id ? null : r.id)}
                        onValider={() => muterDecision.mutate({ installationId: r.id, reportId: null, decision: "valider" })}
                        onRejeter={() => setRejectFor({ installationId: r.id, reportId: null })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {installations.data && installations.data.total > 20 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Page {page} · {installations.data.total} résultats</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Précédent</Button>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= installations.data.total}>Suivant</Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==================== ONGLET FILE QC ==================== */}
        <TabsContent value="qc" className="space-y-4">
          {(fileQc.data ?? []).length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
              <CardContent className="p-16 text-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">File de contrôle vide</h3>
                <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                  Aucune installation à revérifier. Lancez un tirage QC pour alimenter la file.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {(fileQc.data ?? []).map((item: any) => (
                <QcCard key={item.report_id} item={item}
                  onValider={() => muterDecision.mutate({ installationId: item.installation_id, reportId: item.report_id, decision: "valider" })}
                  onRejeter={() => setRejectFor({ installationId: item.installation_id, reportId: item.report_id })} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="perfs" className="space-y-4">
          <PerfsTable data={perfs.data ?? []} loading={perfs.isLoading} />
        </TabsContent>
      </Tabs>

      <Dialog open={rejectFor !== null} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-500" /> Rejeter cette installation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Précisez le motif du rejet. L'agent sera notifié.</p>
            <Textarea placeholder="Ex : GPS hors zone, photo illisible, balise mal fixée…"
              value={motif} onChange={(e) => setMotif(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Annuler</Button>
            <Button className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700"
              disabled={!motif.trim() || muterDecision.isPending}
              onClick={() => rejectFor && muterDecision.mutate({ ...rejectFor, decision: "rejeter", motif: motif.trim() })}>
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================== SPARKLINE ================== */

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const W = 140, H = 40, gap = 4;
  const barW = (W - gap * (data.length - 1)) / data.length;
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5" title={`Jour ${i + 1} : ${v}`}>
          <div
            className="w-3 rounded-t bg-white/60 hover:bg-white transition"
            style={{ height: `${Math.max(2, (v / max) * H)}px` }}
          />
          <span className="text-[8px] text-white/60 leading-none">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ================== SORTABLE HEADER ================== */

function SortableTh({ label, k, cur, dir, onClick }: {
  label: string; k: SortKey; cur: SortKey; dir: SortDir; onClick: (k: SortKey) => void;
}) {
  const active = cur === k;
  return (
    <th className="text-left p-3 font-semibold">
      <button onClick={() => onClick(k)} className="inline-flex items-center gap-1 hover:text-indigo-600 transition">
        {label}
        {active
          ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </button>
    </th>
  );
}

/* ================== ROW ================== */

function agentColor(badge: string | null | undefined): string {
  if (!badge) return "from-slate-400 to-slate-500";
  const palettes = [
    "from-indigo-500 to-violet-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-600",
    "from-sky-500 to-blue-600",
    "from-fuchsia-500 to-purple-600",
  ];
  const h = badge.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[h % palettes.length] ?? palettes[0]!;
}

function RowInstall({ r, padding, selected, expanded, onSelect, onToggleExpand, onValider, onRejeter }: {
  r: any; padding: string; selected: boolean; expanded: boolean;
  onSelect: (v: boolean) => void; onToggleExpand: () => void; onValider: () => void; onRejeter: () => void;
}) {
  return (
    <>
      <tr className={cn("border-t border-slate-100 hover:bg-indigo-50/30 transition group", selected && "bg-indigo-50")}>
        <td className={padding}>
          {!r.validated_at && <Checkbox checked={selected} onCheckedChange={onSelect} />}
        </td>
        <td className={padding}>
          <button onClick={onToggleExpand} className="text-slate-400 hover:text-indigo-600 transition p-1">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className={padding}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
              <Radio className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="font-mono text-xs font-medium">{r.beacon_number ?? "—"}</span>
          </div>
        </td>
        <td className={padding}>
          <div className="flex items-center gap-2">
            <div className={cn("h-7 w-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold shadow", agentColor(r.agent_badge))}>
              {(r.agent_badge ?? "??").slice(-2)}
            </div>
            <span className="font-mono text-xs">{r.agent_badge ?? "—"}</span>
          </div>
        </td>
        <td className={cn(padding, "text-xs text-slate-600")}>
          {r.gps_lat && r.gps_lng ? (
            <a href={`https://www.google.com/maps?q=${r.gps_lat},${r.gps_lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-emerald-600 transition group/gps">
              <MapPin className="h-3 w-3 text-emerald-500" />
              <span className="group-hover/gps:underline">{Number(r.gps_lat).toFixed(5)}, {Number(r.gps_lng).toFixed(5)}</span>
            </a>
          ) : "—"}
        </td>
        <td className={padding}>
          {r.accuracy_m != null ? <PrecisionBadge acc={Number(r.accuracy_m)} /> : <span className="text-slate-400">—</span>}
        </td>
        <td className={cn(padding, "text-xs text-slate-500")}>{formatDateTimeFr(r.installed_at)}</td>
        <td className={padding}>
          {r.photo_url ? (
            <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300">
              <Camera className="h-3 w-3" /> OK
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-slate-400 border-slate-300">
              <ImageOff className="h-3 w-3" /> Absente
            </Badge>
          )}
        </td>
        <td className={padding}>
          {r.validated_at ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Validée
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1">
              <Clock className="h-3 w-3" /> En attente
            </Badge>
          )}
        </td>
        <td className={padding}>
          <div className="flex gap-1 justify-end opacity-70 group-hover:opacity-100 transition">
            {r.photo_url && (
              <a href={r.photo_url} target="_blank" rel="noreferrer" title="Voir la photo">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Camera className="h-4 w-4 text-sky-600" />
                </Button>
              </a>
            )}
            {!r.validated_at && (
              <>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50" title="Valider" onClick={onValider}>
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50" title="Rejeter" onClick={onRejeter}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            <Link to="/admin/installations/$id" params={{ id: r.id }} title="Modifier">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <Edit3 className="h-4 w-4 text-slate-500" />
              </Button>
            </Link>
          </div>
        </td>
      </tr>
      {/* Ligne étendue */}
      {expanded && (
        <tr className="bg-slate-50/50 border-t border-slate-100">
          <td colSpan={10} className="p-4">
            <div className="grid md:grid-cols-3 gap-4">
              {r.photo_url ? (
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                  <img src={r.photo_url} alt="Installation" className="w-full h-40 object-cover" />
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-slate-200 h-40 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <ImageOff className="h-8 w-8 mx-auto mb-1" />
                    <div className="text-xs">Aucune photo</div>
                  </div>
                </div>
              )}
              <div className="space-y-2 text-sm md:col-span-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">ID interne</div>
                    <div className="font-mono text-xs mt-0.5">{r.id}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Validée le</div>
                    <div className="text-xs mt-0.5">{r.validated_at ? formatDateTimeFr(r.validated_at) : "—"}</div>
                  </div>
                  {r.gps_lat && r.gps_lng && (
                    <div className="col-span-2">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Coordonnées</div>
                      <div className="flex gap-2">
                        <a href={`https://www.google.com/maps?q=${r.gps_lat},${r.gps_lng}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            <MapPin className="h-3 w-3 mr-1" /> Google Maps
                          </Button>
                        </a>
                        <a href={`https://www.openstreetmap.org/?mlat=${r.gps_lat}&mlon=${r.gps_lng}#map=18/${r.gps_lat}/${r.gps_lng}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            <MapPin className="h-3 w-3 mr-1" /> OpenStreetMap
                          </Button>
                        </a>
                      </div>
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

/* ================== KPI, PrecisionBadge, QcCard, PerfsTable (inchangés) ================== */

function KpiCard({ label, value, icon: Icon, tone, trend, suffix }: {
  label: string; value: number | string; icon: any; tone: string; trend: string | null; suffix?: string;
}) {
  const tones: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-500",
    sky: "from-sky-500 to-blue-600",
    rose: "from-rose-500 to-pink-600",
  };
  return (
    <Card className="relative overflow-hidden border-slate-200 hover:shadow-lg transition-shadow group">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition", tones[tone])} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">
              {typeof value === "number" ? value.toLocaleString("fr-FR") : value}{suffix ?? ""}
            </div>
            {trend && (
              <div className="text-xs font-medium text-slate-600 mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> {trend} du total
              </div>
            )}
          </div>
          <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PrecisionBadge({ acc }: { acc: number }) {
  if (acc <= 5) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">±{Math.round(acc)}m · Excellent</Badge>;
  if (acc <= 15) return <Badge className="bg-sky-100 text-sky-700 border-sky-200">±{Math.round(acc)}m · Bon</Badge>;
  if (acc <= 30) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">±{Math.round(acc)}m · Moyen</Badge>;
  return <Badge className="bg-rose-100 text-rose-700 border-rose-200">±{Math.round(acc)}m · Faible</Badge>;
}

function QcCard({ item, onValider, onRejeter }: { item: any; onValider: () => void; onRejeter: () => void }) {
  const coherenceMap: Record<string, { label: string; cls: string; icon: any }> = {
    ok: { label: "Cohérence géo OK", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    hors_zone: { label: "Hors zone", cls: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertTriangle },
    indetermine: { label: "Indéterminée", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: Eye },
  };
  const coh = coherenceMap[item.coherence] ?? coherenceMap['indetermine']!;
  const CohIcon = coh.icon;
  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all border-slate-200 group">
      {item.photo_url ? (
        <div className="relative h-40 bg-slate-100 overflow-hidden">
          <img src={item.photo_url} alt={`Photo balise ${item.beacon_number}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute top-2 right-2">
            <Badge className={cn("gap-1 shadow-md", coh.cls)}>
              <CohIcon className="h-3 w-3" /> {coh.label}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <Camera className="h-8 w-8 text-slate-400" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-indigo-600" />
            <span className="font-mono font-semibold text-sm">{item.beacon_number ?? "—"}</span>
          </div>
          {!item.photo_url && (
            <Badge className={cn("gap-1", coh.cls)}>
              <CohIcon className="h-3 w-3" /> {coh.label}
            </Badge>
          )}
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Building2 className="h-3 w-3 text-slate-400" />
            <span>{item.commune_name ?? "Commune inconnue"}</span>
          </div>
          {item.gps_lat != null && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="h-3 w-3 text-emerald-500" />
              <span className="font-mono">{Number(item.gps_lat).toFixed(5)}, {Number(item.gps_lng).toFixed(5)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-600">
            <Target className="h-3 w-3 text-slate-400" />
            <span>{item.accuracy_m != null ? `±${Math.round(Number(item.accuracy_m))}m` : "—"} · {item.nb_mesures} mesure(s)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="h-3 w-3" />
            <span>{formatDateTimeFr(item.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onValider}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Valider
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-rose-600 border-rose-300 hover:bg-rose-50" onClick={onRejeter}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PerfsTable({ data, loading }: { data: any[]; loading: boolean }) {
  const [sortBy, setSortBy] = useState<"total" | "taux_validation" | "precision">("total");
  const sorted = useMemo(() => {
    const arr = [...data];
    if (sortBy === "total") arr.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    if (sortBy === "taux_validation") arr.sort((a, b) => (b.taux_validation ?? 0) - (a.taux_validation ?? 0));
    if (sortBy === "precision") arr.sort((a, b) => (a.precision_moyenne ?? 999) - (b.precision_moyenne ?? 999));
    return arr;
  }, [data, sortBy]);
  const maxTotal = Math.max(...data.map((a) => a.total || 0), 1);
  if (loading) return <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" /></div>;
  if (!data.length) return (
    <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
      <CardContent className="p-16 text-center">
        <Award className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <div className="text-sm text-slate-500">Aucun agent avec des installations.</div>
      </CardContent>
    </Card>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-slate-600">Trier par :</Label>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="total">Nb installations</SelectItem>
            <SelectItem value="taux_validation">Taux de validation</SelectItem>
            <SelectItem value="precision">Précision moyenne</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        {sorted.map((a: any, i: number) => (
          <Card key={a.agent_id} className="hover:shadow-md transition-all border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md",
                  i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                  i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" :
                  i === 2 ? "bg-gradient-to-br from-orange-600 to-amber-700" :
                  "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600",
                )}>
                  {i < 3 ? <Award className="h-5 w-5" /> : `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-6 w-6 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold", agentColor(a.badge_number))}>
                      {(a.badge_number ?? "??").slice(-2)}
                    </div>
                    <span className="font-mono font-semibold">{a.badge_number}</span>
                    {a.active
                      ? <Badge className="bg-emerald-100 text-emerald-700">Actif</Badge>
                      : <Badge variant="outline" className="border-slate-300 text-slate-500">Inactif</Badge>}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-slate-500">Installations</span>
                      <span className="font-semibold w-10">{a.total}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-600" style={{ width: `${(a.total / maxTotal) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-slate-500">Validation</span>
                      <span className="font-semibold w-10">{a.taux_validation}%</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn("h-full", a.taux_validation >= 80 ? "bg-gradient-to-r from-emerald-500 to-teal-600" : a.taux_validation >= 50 ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-rose-500 to-red-600")} style={{ width: `${a.taux_validation}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-slate-500">Précision moy.</span>
                      <span className="font-semibold">{a.precision_moyenne != null ? `±${a.precision_moyenne}m` : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
