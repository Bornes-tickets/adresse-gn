import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardCheck, Search, Download, Zap, MapPin, Camera, User, Filter,
  CheckCircle2, XCircle, Clock, TrendingUp, AlertTriangle, Award, Target,
  Sparkles, ArrowUpRight, RefreshCw, Eye, Edit3, Radio, Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const filtres = {
    page, pageSize: 20,
    agentId: agentId === "tous" ? null : agentId,
    validation: validation === "tous" ? null : validation,
    accuracyMax: precisionMax ? Number(precisionMax) : null,
  };

  const installations = useQuery({
    queryKey: ["admin", "installations", filtres],
    queryFn: () => lister({ data: filtres }),
  });
  const agents = useQuery({ queryKey: ["admin", "agents"], queryFn: () => listerAgents() });
  const fileQc = useQuery({ queryKey: ["admin", "qc-queue"], queryFn: () => file() });
  const perfs = useQuery({ queryKey: ["admin", "agent-metrics"], queryFn: () => metriques() });

  // Auto-refresh temps réel
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
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter((r: any) =>
      (r.beacon_number ?? "").toLowerCase().includes(t) ||
      (r.agent_badge ?? "").toLowerCase().includes(t),
    );
  }, [rows, q]);

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

  const csvUrl = useMemo(() => {
    if (!rows.length) return null;
    const header = "balise,agent,latitude,longitude,precision_m,posee_le,validee_le\n";
    const lines = rows.map((r: any) => [
      r.beacon_number ?? "",
      r.agent_badge ?? "",
      r.gps_lat ?? "",
      r.gps_lng ?? "",
      r.accuracy_m ?? "",
      r.installed_at ?? "",
      r.validated_at ?? "",
    ].map((v) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header hero avec gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <ClipboardCheck className="h-3.5 w-3.5" /> Administration
            </div>
            <h1 className="mt-1 text-3xl font-bold">Installations & Contrôle qualité</h1>
            <p className="mt-1 text-sm text-white/80">
              Suivi terrain temps réel, validation QC, performances agents.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="secondary"
              className="bg-white/15 hover:bg-white/25 text-white border-white/20"
              onClick={() => { void qc.invalidateQueries({ queryKey: ["admin", "installations"] }); toast.success("Actualisé."); }}
            >
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

              {/* Bloc tirage QC */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-end gap-3">
                <div className="flex-1">
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

            {/* Tableau */}
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
                      <th className="text-left p-3 font-semibold">Balise</th>
                      <th className="text-left p-3 font-semibold">Agent</th>
                      <th className="text-left p-3 font-semibold">GPS</th>
                      <th className="text-left p-3 font-semibold">Précision</th>
                      <th className="text-left p-3 font-semibold">Posée le</th>
                      <th className="text-left p-3 font-semibold">État</th>
                      <th className="text-right p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r: any) => (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-indigo-50/30 transition group">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                              <Radio className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="font-mono text-xs font-medium">{r.beacon_number ?? "—"}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-mono text-xs">{r.agent_badge ?? "—"}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-600">
                          {r.gps_lat && r.gps_lng ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-emerald-500" />
                              {Number(r.gps_lat).toFixed(5)}, {Number(r.gps_lng).toFixed(5)}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          {r.accuracy_m != null ? (
                            <PrecisionBadge acc={Number(r.accuracy_m)} />
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(r.installed_at)}</td>
                        <td className="p-3">
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
                        <td className="p-3">
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
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50" title="Valider"
                                  onClick={() => muterDecision.mutate({ installationId: r.id, reportId: null, decision: "valider" })}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50" title="Rejeter"
                                  onClick={() => setRejectFor({ installationId: r.id, reportId: null })}>
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pagination */}
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
                  Aucune installation à revérifier. Lancez un tirage QC depuis l'onglet Installations pour alimenter la file.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {(fileQc.data ?? []).map((item: any) => (
                <QcCard
                  key={item.report_id}
                  item={item}
                  onValider={() => muterDecision.mutate({ installationId: item.installation_id, reportId: item.report_id, decision: "valider" })}
                  onRejeter={() => setRejectFor({ installationId: item.installation_id, reportId: item.report_id })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== ONGLET PERFS ==================== */}
        <TabsContent value="perfs" className="space-y-4">
          <PerfsTable data={perfs.data ?? []} loading={perfs.isLoading} />
        </TabsContent>
      </Tabs>

      {/* Dialog de rejet */}
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

/* ============================== SOUS-COMPOSANTS ============================== */

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
  const coh = coherenceMap[item.coherence] ?? coherenceMap.indetermine;
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
            <span>
              {item.accuracy_m != null ? `±${Math.round(Number(item.accuracy_m))}m` : "—"} · {item.nb_mesures} mesure(s)
            </span>
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

  if (loading) {
    return (
      <div className="p-16 text-center">
        <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (!data.length) {
    return (
      <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
        <CardContent className="p-16 text-center">
          <Award className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <div className="text-sm text-slate-500">Aucun agent avec des installations.</div>
        </CardContent>
      </Card>
    );
  }

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
                {/* Rang */}
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold shadow-md",
                  i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                  i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" :
                  i === 2 ? "bg-gradient-to-br from-orange-600 to-amber-700" :
                  "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600",
                )}>
                  {i < 3 ? <Award className="h-5 w-5" /> : `#${i + 1}`}
                </div>
                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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
                      <span className="font-semibold">
                        {a.precision_moyenne != null ? `±${a.precision_moyenne}m` : "—"}
                      </span>
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
