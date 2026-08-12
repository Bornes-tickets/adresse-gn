import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Repeat, Search, RefreshCw, Download, Calendar, DollarSign, User,
  CheckCircle2, PauseCircle, XCircle, Clock, TrendingUp, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salesAbonnements } from "@/lib/sales.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/_guard/abonnements")({
  component: SalesAbonnements,
});

const STATUTS = [
  { valeur: "active", label: "Actifs", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  { valeur: "suspended", label: "Suspendus", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: PauseCircle },
  { valeur: "cancelled", label: "Annulés", cls: "bg-slate-200 text-slate-700 border-slate-300", icon: XCircle },
];

function formatMontant(m: number) { return new Intl.NumberFormat("fr-FR").format(m) + " GNF"; }
function daysToExpiry(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);
}

function SalesAbonnements() {
  const fn = useServerFn(salesAbonnements);
  const qc = useQueryClient();
  const [statut, setStatut] = useState("all");
  const [q, setQ] = useState("");

  const abos = useQuery({ queryKey: ["sales", "subscriptions"], queryFn: () => fn() });
  useRealtimeInvalidate({ table: "subscriptions", invalidate: [["sales", "subscriptions"]] });

  const rafraichir = () => { void qc.invalidateQueries({ queryKey: ["sales", "subscriptions"] }); toast.success("Actualisé."); };

  const lignes = (abos.data ?? []) as any[];
  const filtered = useMemo(() => {
    let r = lignes;
    if (statut !== "all") r = r.filter((a) => a.status === statut);
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((a) => (a.client ?? "").toLowerCase().includes(t) || (a.plan_code ?? "").toLowerCase().includes(t));
    }
    return r;
  }, [lignes, statut, q]);

  const stats = useMemo(() => {
    const actifs = lignes.filter((a) => a.status === "active").length;
    const mrr = lignes.filter((a) => a.status === "active").reduce((s, a) => s + Number(a.price_gnf ?? 0), 0);
    const bientot = lignes.filter((a) => {
      const d = daysToExpiry(a.end_date);
      return a.status === "active" && d != null && d <= 7 && d >= 0;
    }).length;
    const expires = lignes.filter((a) => {
      const d = daysToExpiry(a.end_date);
      return a.status === "active" && d != null && d < 0;
    }).length;
    return { actifs, mrr, bientot, expires, total: lignes.length };
  }, [lignes]);

  const csvUrl = useMemo(() => {
    if (!filtered.length) return null;
    const header = "client,plan,prix,statut,debut,fin,prochain_prelevement,auto_renouvellement\n";
    const rows = filtered.map((a: any) => [
      a.client, a.plan_code, a.price_gnf, a.status, a.start_date, a.end_date,
      a.next_billing_date ?? "", a.auto_renew ? "oui" : "non",
    ].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8" }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <Repeat className="h-3.5 w-3.5" /> Revenus récurrents
            </div>
            <h1 className="mt-1 text-3xl font-bold">Abonnements</h1>
            <p className="mt-1 text-sm text-white/80">Suivi des abonnements pros, MRR, renouvellements à venir.</p>
          </div>
          <div className="hidden md:block bg-white/10 backdrop-blur rounded-xl p-3 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">MRR</div>
            <div className="text-2xl font-bold mt-0.5">{formatMontant(stats.mrr)}</div>
            <div className="text-[10px] text-white/70 mt-0.5">Mensuel récurrent</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={rafraichir}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
            </Button>
            {csvUrl && <a href={csvUrl} download={`abonnements_${new Date().toISOString().slice(0,10)}.csv`}>
              <Button variant="secondary" className="bg-white text-violet-700 hover:bg-white/90"><Download className="h-4 w-4 mr-1.5" />Export</Button>
            </a>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Actifs" value={stats.actifs.toString()} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="MRR" value={formatMontant(stats.mrr)} icon={TrendingUp} tone="violet" />
        <KpiCard label="Expirent sous 7j" value={stats.bientot.toString()} icon={Clock} tone={stats.bientot > 0 ? "amber" : "slate"} />
        <KpiCard label="Expirés" value={stats.expires.toString()} icon={AlertTriangle} tone={stats.expires > 0 ? "rose" : "slate"} />
      </div>

      {/* Filtres pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatut("all")}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-medium transition",
            statut === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400")}>
          Tous ({lignes.length})
        </button>
        {STATUTS.map((s) => {
          const n = lignes.filter((a) => a.status === s.valeur).length;
          return (
            <button key={s.valeur} onClick={() => setStatut(s.valeur)}
              className={cn("px-3 py-1.5 text-xs rounded-full border font-medium transition inline-flex items-center gap-1.5",
                statut === s.valeur ? "bg-slate-900 text-white border-slate-900" : `${s.cls} hover:opacity-80`)}>
              <s.icon className="h-3 w-3" /> {s.label} ({n})
            </button>
          );
        })}
      </div>

      {/* Recherche */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Client ou plan…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="border-slate-200 overflow-hidden">
        {abos.isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Repeat className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <div className="text-sm text-slate-500">Aucun abonnement.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold">Client</th>
                  <th className="text-left p-3 font-semibold">Plan</th>
                  <th className="text-right p-3 font-semibold">Prix</th>
                  <th className="text-left p-3 font-semibold">Début</th>
                  <th className="text-left p-3 font-semibold">Fin</th>
                  <th className="text-left p-3 font-semibold">Prochaine facturation</th>
                  <th className="text-left p-3 font-semibold">Auto</th>
                  <th className="text-left p-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a: any) => {
                  const st = STATUTS.find((s) => s.valeur === a.status);
                  const StIcon = st?.icon ?? Clock;
                  const jours = daysToExpiry(a.end_date);
                  return (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-violet-50/30 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-violet-600" />
                          </div>
                          <span className="text-sm font-medium">{a.client}</span>
                        </div>
                      </td>
                      <td className="p-3"><Badge variant="outline" className="font-mono">{a.plan_code}</Badge></td>
                      <td className="p-3 text-right font-semibold">{formatMontant(a.price_gnf ?? 0)}</td>
                      <td className="p-3 text-xs text-slate-500">{new Date(a.start_date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3">
                        <div className="text-xs">{new Date(a.end_date).toLocaleDateString("fr-FR")}</div>
                        {jours != null && a.status === "active" && (
                          <div className={cn("text-[10px] font-medium mt-0.5",
                            jours < 0 ? "text-rose-600" : jours <= 7 ? "text-amber-600" : "text-slate-500")}>
                            {jours < 0 ? `${Math.abs(jours)}j de retard` : jours === 0 ? "expire aujourd'hui" : `dans ${jours}j`}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-500">{a.next_billing_date ? new Date(a.next_billing_date).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="p-3">
                        {a.auto_renew
                          ? <Badge className="bg-sky-100 text-sky-700 border-sky-200 gap-1"><Repeat className="h-3 w-3" />Auto</Badge>
                          : <Badge variant="outline">Manuel</Badge>}
                      </td>
                      <td className="p-3"><Badge className={cn("gap-1", st?.cls)}><StIcon className="h-3 w-3" />{st?.label ?? a.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    violet: "from-violet-500 to-fuchsia-600",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-600",
    slate: "from-slate-400 to-slate-500",
  };
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
          <div className="text-xl font-bold mt-1 truncate">{value}</div>
        </div>
        <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
