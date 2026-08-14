import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supportDashboard } from "@/lib/support.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Headphones, AlertTriangle, MessageSquareWarning, CheckCircle2, Clock,
  TrendingUp, Timer, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support/_guard/")({ component: SupportDashboard });

function SupportDashboard() {
  const fn = useServerFn(supportDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["support-dashboard"], queryFn: () => fn(), refetchInterval: 60_000 });

  if (isLoading) return <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin" /></div>;
  if (!data) return <div className="p-6 text-red-600">Erreur.</div>;

  const maxRaison = Math.max(...data.parRaison.map((r) => r.total), 1);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <Headphones className="h-3.5 w-3.5" /> Service client
            </div>
            <h1 className="mt-1 text-3xl font-bold">Tableau de bord Support</h1>
            <p className="mt-1 text-sm text-white/80">Signalements citoyens, réclamations, temps de résolution.</p>
          </div>
          <div className="hidden md:block bg-white/10 backdrop-blur rounded-xl p-3 min-w-[180px]">
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">Âge moyen</div>
            <div className="text-2xl font-bold mt-0.5">{data.ageSignalementMoyen ?? "—"} j</div>
            <div className="text-[10px] text-white/70 mt-0.5">Signalements ouverts</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Signalements ouverts" value={data.signalementsOuverts} icon={Inbox} tone="sky" />
        <Kpi label="Nouveaux" value={data.signalementsNouveaux} icon={AlertTriangle} tone={data.signalementsNouveaux > 0 ? "amber" : "slate"} />
        <Kpi label="En cours" value={data.signalementsEnCours} icon={Clock} tone="violet" />
        <Kpi label="Résolus 7j" value={data.signalementsResolus7j} icon={CheckCircle2} tone="emerald" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Réclamations en attente" value={data.reclamationsEnAttente} icon={MessageSquareWarning} tone="sky" />
        <Kpi label="Approuvées 7j" value={data.reclamationsApprouvees7j} icon={CheckCircle2} tone="emerald" />
        <Kpi label="Rejetées 7j" value={data.reclamationsRejetees7j} icon={AlertTriangle} tone="rose" />
        <Kpi label="Âge moyen" value={data.ageSignalementMoyen ?? 0} suffix=" j" icon={Timer} tone={data.ageSignalementMoyen != null && data.ageSignalementMoyen > 7 ? "rose" : "sky"} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Signalements récents</h2>
          </div>
          <CardContent className="p-0">
            {data.signalementsRecents.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Aucun signalement ouvert.</div> : (
              <div className="divide-y divide-slate-100">
                {data.signalementsRecents.map((r) => (
                  <div key={r.id} className="p-3 flex items-center justify-between hover:bg-sky-50/30 transition">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.reason}</div>
                      <div className="text-xs text-slate-500">{r.beacon_number ?? "—"} · {new Date(r.created_at).toLocaleString("fr-FR")}</div>
                    </div>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-sky-600" />Top raisons</h2>
          </div>
          <CardContent className="p-5 space-y-3">
            {data.parRaison.length === 0 ? <p className="text-sm text-slate-500">Aucune donnée.</p> : data.parRaison.map((r) => (
              <div key={r.raison}>
                <div className="flex justify-between text-sm mb-1"><span>{r.raison}</span><span className="font-semibold">{r.total}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-blue-600" style={{ width: `${(r.total / maxRaison) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, suffix }: { label: string; value: number; icon: any; tone: string; suffix?: string }) {
  const tones: Record<string, string> = {
    sky: "from-sky-500 to-blue-600", amber: "from-amber-500 to-orange-500",
    violet: "from-violet-500 to-fuchsia-600", emerald: "from-emerald-500 to-teal-600",
    rose: "from-rose-500 to-pink-600", slate: "from-slate-400 to-slate-500",
  };
  return (
    <Card className="border-slate-200 hover:shadow-lg transition">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
          <div className="text-2xl font-bold mt-1">{value.toLocaleString("fr-FR")}{suffix ?? ""}</div>
        </div>
        <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
