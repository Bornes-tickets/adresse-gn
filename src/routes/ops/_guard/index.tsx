import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { opsDashboard } from "@/lib/ops.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Radio, QrCode, Wrench, TrendingUp, CheckCircle2, AlertCircle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops/_guard/")({ component: OpsDashboard });

function OpsDashboard() {
  const fn = useServerFn(opsDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["ops-dashboard"], queryFn: () => fn(), refetchInterval: 60_000 });

  if (isLoading) return <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div>;
  if (!data) return <div className="p-6 text-red-600">Erreur.</div>;

  const maxCat = Math.max(...data.stockParCategorie.map((c) => c.total), 1);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <Wrench className="h-3.5 w-3.5" /> Production & logistique
            </div>
            <h1 className="mt-1 text-3xl font-bold">Tableau de bord Ops</h1>
            <p className="mt-1 text-sm text-white/80">Stock balises, lots, exports QR et distribution terrain.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total balises" value={data.balisesTotal} icon={Radio} tone="amber" />
        <Kpi label="Générées (stock)" value={data.balisesGenerees} icon={Package} tone="orange" />
        <Kpi label="Assignées" value={data.balisesAssignees} icon={Layers} tone="sky" />
        <Kpi label="Actives (terrain)" value={data.balisesActives} icon={CheckCircle2} tone="emerald" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total lots" value={data.lotsTotal} icon={Package} tone="amber" />
        <Kpi label="Lots générés" value={data.lotsGeneres} icon={QrCode} tone="orange" />
        <Kpi label="Lots distribués" value={data.lotsDistribues} icon={TrendingUp} tone="violet" />
        <Kpi label="Installations mois" value={data.installationsMois} icon={CheckCircle2} tone="emerald" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-amber-600" />Lots récents</h2>
          </div>
          <CardContent className="p-0">
            {data.lotsRecents.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Aucun lot.</div> : (
              <div className="divide-y divide-slate-100">
                {data.lotsRecents.map((l) => (
                  <div key={l.id} className="p-3 flex items-center justify-between hover:bg-amber-50/30 transition">
                    <div>
                      <div className="font-mono text-xs">{l.code}</div>
                      <div className="text-xs text-slate-500">{l.quantity} balises · {l.category ?? "—"}</div>
                    </div>
                    <Badge variant="outline">{l.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4 text-orange-600" />Stock par catégorie</h2>
          </div>
          <CardContent className="p-5 space-y-3">
            {data.stockParCategorie.length === 0 ? <p className="text-sm text-slate-500">Aucune donnée.</p> : data.stockParCategorie.map((c) => (
              <div key={c.categorie}>
                <div className="flex justify-between text-sm mb-1"><span>{c.categorie}</span><span className="font-semibold">{c.total}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    amber: "from-amber-500 to-orange-500", orange: "from-orange-500 to-rose-600",
    sky: "from-sky-500 to-blue-600", emerald: "from-emerald-500 to-teal-600", violet: "from-violet-500 to-fuchsia-600",
  };
  return (
    <Card className="border-slate-200 hover:shadow-lg transition">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
          <div className="text-2xl font-bold mt-1">{value.toLocaleString("fr-FR")}</div>
        </div>
        <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
