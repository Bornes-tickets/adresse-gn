import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes, Package, Search, RefreshCw, Download, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Layers, ArrowRight, Radio, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeFr } from "@/lib/admin";
import { opsStock } from "@/lib/ops.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops/_guard/stock")({ component: OpsStock });

const CATEGORIES: Record<string, { label: string; color: string }> = {
  digital_only: { label: "Numérique", color: "slate" },
  residential: { label: "Résidentiel", color: "sky" },
  residential_plus: { label: "Résidentiel+", color: "violet" },
  professional: { label: "Professionnel", color: "emerald" },
  institutional: { label: "Institutionnel", color: "indigo" },
  custom: { label: "Sur mesure", color: "amber" },
};

const SEUIL_ALERTE = 20; // stock ≤ 20 = alerte
const SEUIL_CRITIQUE = 5;

function niveauStock(stock: number, ordered: number): { label: string; cls: string; icon: any } {
  const pct = ordered > 0 ? (stock / ordered) * 100 : 0;
  if (stock === 0) return { label: "Épuisé", cls: "bg-slate-200 text-slate-700 border-slate-300", icon: TrendingDown };
  if (stock <= SEUIL_CRITIQUE) return { label: "Critique", cls: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertTriangle };
  if (stock <= SEUIL_ALERTE) return { label: "Faible", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: TrendingDown };
  if (pct >= 80) return { label: "Plein", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 };
  return { label: "OK", cls: "bg-sky-100 text-sky-700 border-sky-200", icon: Package };
}

function OpsStock() {
  const fn = useServerFn(opsStock);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<"all" | "critique" | "faible" | "plein">("all");

  const stock = useQuery({ queryKey: ["ops", "stock"], queryFn: () => fn(), refetchInterval: 60_000 });
  useRealtimeInvalidate({ table: "beacons", invalidate: [["ops", "stock"]] });
  useRealtimeInvalidate({ table: "lots", invalidate: [["ops", "stock"]] });

  const data = stock.data;
  const lots = data?.lots ?? [];

  const filtered = useMemo(() => {
    let r = lots;
    if (filtre === "critique") r = r.filter((l) => l.quantity_stock <= SEUIL_CRITIQUE && l.quantity_ordered > 0);
    else if (filtre === "faible") r = r.filter((l) => l.quantity_stock > SEUIL_CRITIQUE && l.quantity_stock <= SEUIL_ALERTE);
    else if (filtre === "plein") r = r.filter((l) => l.quantity_stock > SEUIL_ALERTE);
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((l) => l.code.toLowerCase().includes(t) || (l.supplier ?? "").toLowerCase().includes(t));
    }
    return r;
  }, [lots, filtre, q]);

  const csvUrl = useMemo(() => {
    if (!lots.length) return null;
    const header = "code,categorie,fournisseur,commandee,en_stock,assignees,installees,taux_consommation\n";
    const rows = lots.map((l) => [
      l.code, CATEGORIES[l.category ?? ""]?.label ?? l.category ?? "", l.supplier ?? "",
      l.quantity_ordered, l.quantity_stock, l.quantity_assigned, l.quantity_active, l.taux_consommation,
    ].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8" }));
  }, [lots]);

  if (stock.isLoading) return <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div>;
  if (!data) return <div className="p-6 text-red-600">Erreur.</div>;

  const alertes = lots.filter((l) => l.quantity_stock <= SEUIL_ALERTE && l.quantity_stock > 0).length;
  const critiques = lots.filter((l) => l.quantity_stock <= SEUIL_CRITIQUE && l.quantity_stock > 0).length;
  const epuises = lots.filter((l) => l.quantity_stock === 0 && l.quantity_ordered > 0).length;
  const maxCat = Math.max(...data.parCategorie.map((c) => c.total), 1);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><Boxes className="h-3.5 w-3.5" /> Inventaire</div>
            <h1 className="mt-1 text-3xl font-bold">Stock de balises</h1>
            <p className="mt-1 text-sm text-white/80">Consommation en temps réel par commande fournisseur.</p>
          </div>
          <div className="hidden md:block bg-white/10 backdrop-blur rounded-xl p-3 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">Taux de consommation</div>
            <div className="text-2xl font-bold mt-0.5">{data.global.tauxConsommation}%</div>
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${data.global.tauxConsommation}%` }} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => { qc.invalidateQueries({ queryKey: ["ops", "stock"] }); toast.success("Actualisé."); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Rafraîchir
            </Button>
            {csvUrl && (
              <a href={csvUrl} download={`stock_${new Date().toISOString().slice(0,10)}.csv`}>
                <Button variant="secondary" className="bg-white text-orange-700 hover:bg-white/90"><Download className="h-4 w-4 mr-1.5" />Export</Button>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Alertes stock */}
      {(critiques > 0 || epuises > 0) && (
        <Card className="border-rose-300 bg-gradient-to-br from-rose-50 to-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow animate-pulse">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-rose-900">Attention : niveau de stock bas</div>
              <div className="text-xs text-rose-700 mt-0.5">
                {critiques > 0 && <span>{critiques} commande{critiques > 1 ? "s" : ""} en critique</span>}
                {critiques > 0 && epuises > 0 && " · "}
                {epuises > 0 && <span>{epuises} épuisée{epuises > 1 ? "s" : ""}</span>}
                {" · pensez à réapprovisionner"}
              </div>
            </div>
            <Link to="/ops/commandes-fournisseurs">
              <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">
                <ArrowRight className="h-4 w-4 mr-1" />Nouvelle commande
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total commandé" value={data.global.ordered} icon={Package} tone="slate" />
        <Kpi label="En stock" value={data.global.stock} icon={Boxes} tone="amber" highlight />
        <Kpi label="Assignées agents" value={data.global.assigned} icon={Layers} tone="sky" />
        <Kpi label="Installées" value={data.global.active} icon={CheckCircle2} tone="emerald" />
        <Kpi label="Épuisées / annulées" value={data.global.cancelled + epuises} icon={AlertTriangle} tone={epuises > 0 ? "rose" : "slate"} />
      </div>

      {/* Répartition par catégorie */}
      <Card>
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-600" />Répartition par catégorie</h2>
        </div>
        <CardContent className="p-4 space-y-3">
          {data.parCategorie.length === 0 ? <p className="text-sm text-slate-500 text-center">Aucune donnée.</p>
            : data.parCategorie.map((c) => {
              const label = CATEGORIES[c.categorie]?.label ?? c.categorie;
              const pctStock = c.total > 0 ? (c.stock / c.total) * 100 : 0;
              return (
                <div key={c.categorie}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{label}</span>
                    <span><strong>{c.stock}</strong> <span className="text-slate-500">/ {c.total} en stock</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", pctStock < 20 ? "bg-gradient-to-r from-rose-500 to-red-600" : pctStock < 50 ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-emerald-500 to-teal-600")}
                      style={{ width: `${pctStock}%` }} />
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {/* Filtres pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltre("all")}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition",
            filtre === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600")}>
          Toutes ({lots.length})
        </button>
        <button onClick={() => setFiltre("critique")}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition inline-flex items-center gap-1.5",
            filtre === "critique" ? "bg-slate-900 text-white border-slate-900" : "bg-rose-100 text-rose-700 border-rose-200 hover:opacity-80")}>
          <AlertTriangle className="h-3 w-3" /> Critique ({critiques})
        </button>
        <button onClick={() => setFiltre("faible")}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition inline-flex items-center gap-1.5",
            filtre === "faible" ? "bg-slate-900 text-white border-slate-900" : "bg-amber-100 text-amber-700 border-amber-200 hover:opacity-80")}>
          <TrendingDown className="h-3 w-3" /> Faible ({alertes - critiques})
        </button>
        <button onClick={() => setFiltre("plein")}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition inline-flex items-center gap-1.5",
            filtre === "plein" ? "bg-slate-900 text-white border-slate-900" : "bg-emerald-100 text-emerald-700 border-emerald-200 hover:opacity-80")}>
          <CheckCircle2 className="h-3 w-3" /> Bien fourni
        </button>
      </div>

      {/* Recherche */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Code commande ou fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* Tableau détaillé par commande */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Boxes className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <div className="text-sm text-slate-500">Aucune commande dans ce filtre.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((l) => {
              const niveau = niveauStock(l.quantity_stock, l.quantity_ordered);
              const NivIcon = niveau.icon;
              const cat = CATEGORIES[l.category ?? ""];
              return (
                <div key={l.lot_id} className="p-4 hover:bg-amber-50/30 transition">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-orange-600" />
                        <span className="font-mono text-sm font-bold">{l.code}</span>
                        <Badge variant="outline">{cat?.label ?? l.category ?? "—"}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {l.supplier ?? "Fournisseur inconnu"} · Reçue le {formatDateTimeFr(l.received_at)}
                      </div>
                    </div>
                    <Badge className={cn("gap-1 shrink-0", niveau.cls)}>
                      <NivIcon className="h-3 w-3" /> {niveau.label}
                    </Badge>
                  </div>

                  {/* Barre de progression segmentée */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        <strong className="text-slate-900">{l.quantity_stock}</strong> en stock <span className="text-slate-400">sur {l.quantity_ordered}</span>
                      </span>
                      <span className="text-slate-500">{l.taux_consommation}% consommé</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                      {l.quantity_active > 0 && (
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full" title={`${l.quantity_active} installées`}
                          style={{ width: `${(l.quantity_active / l.quantity_ordered) * 100}%` }} />
                      )}
                      {l.quantity_assigned > 0 && (
                        <div className="bg-gradient-to-r from-sky-500 to-blue-600 h-full" title={`${l.quantity_assigned} assignées`}
                          style={{ width: `${(l.quantity_assigned / l.quantity_ordered) * 100}%` }} />
                      )}
                      {l.quantity_stock > 0 && (
                        <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full" title={`${l.quantity_stock} en stock`}
                          style={{ width: `${(l.quantity_stock / l.quantity_ordered) * 100}%` }} />
                      )}
                      {l.quantity_suspended > 0 && (
                        <div className="bg-slate-400 h-full" title={`${l.quantity_suspended} suspendues`}
                          style={{ width: `${(l.quantity_suspended / l.quantity_ordered) * 100}%` }} />
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-[10px]">
                      <StockCell label="Installées" value={l.quantity_active} color="emerald" />
                      <StockCell label="Assignées" value={l.quantity_assigned} color="sky" />
                      <StockCell label="En stock" value={l.quantity_stock} color="amber" />
                      <StockCell label="Suspendues" value={l.quantity_suspended} color="slate" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StockCell({ label, value, color }: { label: string; value: number; color: string }) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <div className={cn("rounded-lg border p-1.5 text-center", bg[color])}>
      <div className="uppercase tracking-widest font-semibold opacity-70">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, highlight }: { label: string; value: number; icon: any; tone: string; highlight?: boolean }) {
  const tones: Record<string, string> = {
    amber: "from-amber-500 to-orange-500",
    sky: "from-sky-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    rose: "from-rose-500 to-pink-600",
    slate: "from-slate-400 to-slate-500",
  };
  return (
    <Card className={cn("border-slate-200 hover:shadow-lg transition", highlight && "border-amber-300 shadow-md")}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
          <div className="text-2xl font-bold mt-1">{value.toLocaleString("fr-FR")}</div>
        </div>
        <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
