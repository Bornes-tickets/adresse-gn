import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { salesDashboard } from "@/lib/sales.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, ShoppingCart, CreditCard, Repeat, Users,
  DollarSign, ArrowUpRight, ArrowDownRight, Wallet, Sparkles, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/_guard/")({
  component: SalesDashboard,
});

function formatMontant(m: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(m) + " GNF";
}

function SalesDashboard() {
  const fn = useServerFn(salesDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-16 text-center">
        <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin mb-3" />
        <div className="text-sm text-slate-500">Chargement…</div>
      </div>
    );
  }

  if (!data) return <div className="p-6 text-red-600">Erreur de chargement.</div>;

  const evolution = data.ventesMoisPrec > 0
    ? Math.round(((data.ventesMois - data.ventesMoisPrec) / data.ventesMoisPrec) * 100)
    : null;

  const maxRevenu = Math.max(...data.revenusParJour.map((r) => r.total), 1);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <Sparkles className="h-3.5 w-3.5" /> Pilotage commercial
            </div>
            <h1 className="mt-1 text-3xl font-bold">Tableau de bord</h1>
            <p className="mt-1 text-sm text-white/80">
              Ventes, commandes, paiements et abonnements en un coup d'œil.
            </p>
          </div>
          <div className="hidden md:block bg-white/10 backdrop-blur rounded-xl p-4 min-w-[240px]">
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">Ventes du mois</div>
            <div className="text-2xl font-bold mt-1">{formatMontant(data.ventesMois)}</div>
            {evolution !== null && (
              <div className={cn("mt-1 text-xs font-medium flex items-center gap-1", evolution >= 0 ? "text-emerald-200" : "text-rose-200")}>
                {evolution >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(evolution)}% vs mois précédent
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ventes du jour" value={formatMontant(data.ventesJour)} icon={DollarSign} tone="emerald" />
        <KpiCard label="Commandes en cours" value={data.commandesEnCours.toString()} icon={ShoppingCart} tone="sky" />
        <KpiCard label="Paiements en attente" value={data.paiementsEnAttente.toString()} icon={CreditCard} tone="amber" />
        <KpiCard label="Abonnements actifs" value={data.abonnementsActifs.toString()} icon={Repeat} tone="violet" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Nouveaux clients 7j" value={data.nouveauxClients7j.toString()} icon={Users} tone="rose" />
        <KpiCard label="Panier moyen" value={formatMontant(data.panierMoyen)} icon={Wallet} tone="indigo" />
        <KpiCard label="Ventes du mois" value={formatMontant(data.ventesMois)} icon={TrendingUp} tone="emerald" trend={evolution} />
        <KpiCard label="Mois précédent" value={formatMontant(data.ventesMoisPrec)} icon={Activity} tone="slate" />
      </div>

      {/* Graphique revenus + Top offres */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Revenus des 30 derniers jours
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Paiements confirmés uniquement</p>
            </div>
          </div>
          <CardContent className="p-5">
            <div className="flex items-end gap-1 h-48">
              {data.revenusParJour.map((r) => (
                <div key={r.jour} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t hover:from-emerald-600 hover:to-teal-500 transition-all cursor-pointer"
                    style={{ height: `${Math.max(2, (r.total / maxRevenu) * 100)}%` }} />
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-10">
                    {new Date(r.jour).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    <div className="font-semibold">{formatMontant(r.total)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-400">
              <span>{new Date(data.revenusParJour[0]?.jour ?? "").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
              <span>Aujourd'hui</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Top offres (mois)
            </h2>
          </div>
          <CardContent className="p-3">
            {data.topOffres.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucune vente ce mois.</p>
            ) : (
              <div className="space-y-2">
                {data.topOffres.map((o, i) => (
                  <div key={o.code} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow",
                      i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500"
                        : i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500"
                        : i === 2 ? "bg-gradient-to-br from-orange-600 to-amber-700"
                        : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600",
                    )}>#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{o.code}</div>
                      <div className="text-xs text-slate-500">{o.total} vente(s)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-700">{formatMontant(o.revenus)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activité récente */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-sky-600" />
              Commandes récentes
            </h2>
          </div>
          <CardContent className="p-0">
            {data.activite.commandes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucune commande récente.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.activite.commandes.map((c) => (
                  <div key={c.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="min-w-0">
                      <div className="font-mono text-xs">{c.ref}</div>
                      <div className="text-xs text-slate-500 truncate">{c.client ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatMontant(c.montant)}</div>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{c.statut}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Paiements récents
            </h2>
          </div>
          <CardContent className="p-0">
            {data.activite.paiements.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucun paiement récent.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.activite.paiements.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="min-w-0">
                      <Badge variant="outline" className="text-[10px]">{p.provider}</Badge>
                      <div className="text-xs text-slate-500 mt-0.5">{p.date ? new Date(p.date).toLocaleString("fr-FR") : "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-700">{formatMontant(p.montant)}</div>
                      <Badge className={cn("text-[10px] mt-0.5",
                        p.statut === "paid" ? "bg-emerald-100 text-emerald-700" :
                        p.statut === "pending" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700",
                      )}>{p.statut}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone, trend }: {
  label: string; value: string; icon: any; tone: string; trend?: number | null;
}) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    sky: "from-sky-500 to-blue-600",
    amber: "from-amber-500 to-orange-500",
    violet: "from-violet-500 to-fuchsia-600",
    rose: "from-rose-500 to-pink-600",
    indigo: "from-indigo-500 to-violet-600",
    slate: "from-slate-500 to-slate-600",
  };
  return (
    <Card className="relative overflow-hidden border-slate-200 hover:shadow-lg transition-shadow group">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition", tones[tone])} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
            <div className="text-xl font-bold mt-1 text-slate-900 truncate">{value}</div>
            {trend !== undefined && trend !== null && (
              <div className={cn("text-xs font-medium mt-1 flex items-center gap-1", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </div>
            )}
          </div>
          <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg shrink-0", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
