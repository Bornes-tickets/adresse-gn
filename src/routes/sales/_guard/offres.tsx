import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Tag, Search, Copy, DollarSign, Zap, Info, Package, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salesOffres } from "@/lib/sales.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/_guard/offres")({
  component: SalesOffres,
});

function formatMontant(m: number | null | undefined): string {
  if (m == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(m) + " GNF";
}

function SalesOffres() {
  const fn = useServerFn(salesOffres);
  const [q, setQ] = useState("");
  const offres = useQuery({ queryKey: ["sales", "offres"], queryFn: () => fn() });

  const filtered = useMemo(() => {
    const list = (offres.data ?? []) as any[];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter((o) =>
      (o.code ?? "").toLowerCase().includes(t) ||
      (o.label ?? "").toLowerCase().includes(t) ||
      (o.description ?? "").toLowerCase().includes(t),
    );
  }, [offres.data, q]);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <Tag className="h-3.5 w-3.5" /> Catalogue
            </div>
            <h1 className="mt-1 text-3xl font-bold">Offres & tarifs</h1>
            <p className="mt-1 text-sm text-white/80">Consulter le catalogue commercial et copier les codes offres.</p>
          </div>
        </div>
      </div>

      {/* Recherche */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Code, libellé, description…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {offres.isLoading ? (
        <div className="p-16 text-center">
          <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-orange-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
          <CardContent className="p-16 text-center">
            <Tag className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">Aucune offre</h3>
            <p className="text-sm text-slate-600 mt-1">
              Le catalogue est vide ou les offres ne sont pas encore chargées.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((o: any) => (
            <Card key={o.code} className="border-slate-200 hover:shadow-lg transition-all overflow-hidden group">
              <div className={cn(
                "h-2 bg-gradient-to-r",
                o.quoteOnly ? "from-slate-400 to-slate-500"
                  : o.recurring ? "from-violet-500 to-fuchsia-500"
                  : "from-emerald-500 to-teal-500",
              )} />
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-lg font-bold">{o.label ?? o.name ?? o.code}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => { navigator.clipboard.writeText(o.code); toast.success(`Code ${o.code} copié.`); }}
                        className="font-mono text-xs bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition inline-flex items-center gap-1"
                      >
                        {o.code} <Copy className="h-2.5 w-2.5" />
                      </button>
                      {o.recurring && <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">Récurrent</Badge>}
                      {o.quoteOnly && <Badge className="bg-slate-200 text-slate-700 text-[10px]">Sur devis</Badge>}
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-orange-600" />
                  </div>
                </div>

                {o.description && (
                  <p className="text-sm text-slate-600 line-clamp-3">{o.description}</p>
                )}

                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  {o.setup_gnf != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1"><Zap className="h-3 w-3" />Frais d'activation</span>
                      <span className="font-semibold">{formatMontant(o.setup_gnf)}</span>
                    </div>
                  )}
                  {o.monthly_gnf != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1"><Sparkles className="h-3 w-3" />Mensuel</span>
                      <span className="font-semibold">{formatMontant(o.monthly_gnf)}<span className="text-xs text-slate-400"> /mois</span></span>
                    </div>
                  )}
                  {o.price_gnf != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1"><DollarSign className="h-3 w-3" />Prix</span>
                      <span className="font-semibold text-emerald-700">{formatMontant(o.price_gnf)}</span>
                    </div>
                  )}
                  {o.quoteOnly && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded p-2">
                      <Info className="h-3 w-3" /> Tarif sur demande — contactez le commercial
                    </div>
                  )}
                </div>

                {o.features && Array.isArray(o.features) && o.features.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Inclus</div>
                    <ul className="space-y-1">
                      {o.features.slice(0, 5).map((f: any, i: number) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-0.5">✓</span>
                          <span>{typeof f === "string" ? f : f.label ?? JSON.stringify(f)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
