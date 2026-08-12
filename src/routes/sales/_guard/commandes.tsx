import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ShoppingCart, Search, RefreshCw, Download, Mail, Phone, FileText,
  Package, User, Clock, CheckCircle2, XCircle, Ban, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTimeFr } from "@/lib/admin";
import { salesCommandes } from "@/lib/sales.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/_guard/commandes")({
  component: SalesCommandes,
});

const STATUTS = [
  { valeur: "pending", label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  { valeur: "paid", label: "Payée", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  { valeur: "cancelled", label: "Annulée", cls: "bg-slate-200 text-slate-700 border-slate-300", icon: Ban },
  { valeur: "refunded", label: "Remboursée", cls: "bg-violet-100 text-violet-700 border-violet-200", icon: XCircle },
];

function formatMontant(m: number): string {
  return new Intl.NumberFormat("fr-FR").format(m) + " GNF";
}

function SalesCommandes() {
  const fn = useServerFn(salesCommandes);
  const qc = useQueryClient();

  const [statut, setStatut] = useState("all");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const commandes = useQuery({
    queryKey: ["sales", "orders", { statut, q, page }],
    queryFn: () => fn({ data: { statut, q, page, pageSize: 25 } }),
  });

  useRealtimeInvalidate({
    table: "orders",
    invalidate: [["sales", "orders"]],
  });

  const rafraichir = () => { void qc.invalidateQueries({ queryKey: ["sales", "orders"] }); toast.success("Actualisé."); };

  const lignes = commandes.data?.lignes ?? [];
  const stats = useMemo(() => {
    const total = lignes.reduce((s: number, c: any) => s + Number(c.amount_gnf ?? 0), 0);
    const payees = lignes.filter((c: any) => c.status === "paid").length;
    const attente = lignes.filter((c: any) => c.status === "pending").length;
    return { total, payees, attente, count: commandes.data?.total ?? 0 };
  }, [lignes, commandes.data]);

  const csvUrl = useMemo(() => {
    if (!lignes.length) return null;
    const header = "reference,offre,client,email,telephone,montant,statut,facture,cree_le\n";
    const rows = lignes.map((c: any) => [
      c.order_ref, c.offer_code, c.client_name, c.client_email ?? "", c.client_phone ?? "",
      c.amount_gnf, c.status, c.invoice_number ?? "", c.created_at,
    ].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8" }));
  }, [lignes]);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <ShoppingCart className="h-3.5 w-3.5" /> Vente
            </div>
            <h1 className="mt-1 text-3xl font-bold">Commandes</h1>
            <p className="mt-1 text-sm text-white/80">Historique complet des commandes clients.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={rafraichir}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
            </Button>
            {csvUrl && <a href={csvUrl} download={`commandes_${new Date().toISOString().slice(0,10)}.csv`}>
              <Button variant="secondary" className="bg-white text-emerald-700 hover:bg-white/90"><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
            </a>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total (page)" value={formatMontant(stats.total)} icon={ShoppingCart} tone="emerald" />
        <KpiCard label="Payées" value={stats.payees.toString()} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="En attente" value={stats.attente.toString()} icon={Clock} tone="amber" />
        <KpiCard label="Total résultats" value={stats.count.toString()} icon={Package} tone="sky" />
      </div>

      {/* Filtres statuts en pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setStatut("all"); setPage(1); }}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-medium transition",
            statut === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400")}>
          Toutes
        </button>
        {STATUTS.map((s) => (
          <button key={s.valeur} onClick={() => { setStatut(s.valeur); setPage(1); }}
            className={cn("px-3 py-1.5 text-xs rounded-full border font-medium transition inline-flex items-center gap-1.5",
              statut === s.valeur ? "bg-slate-900 text-white border-slate-900" : `${s.cls} hover:opacity-80`)}>
            <s.icon className="h-3 w-3" /> {s.label}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="N° de commande…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="border-slate-200 overflow-hidden">
        {commandes.isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : lignes.length === 0 ? (
          <div className="p-16 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <div className="text-sm text-slate-500">Aucune commande.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold">Référence</th>
                  <th className="text-left p-3 font-semibold">Offre</th>
                  <th className="text-left p-3 font-semibold">Client</th>
                  <th className="text-right p-3 font-semibold">Montant</th>
                  <th className="text-left p-3 font-semibold">Facture</th>
                  <th className="text-left p-3 font-semibold">Statut</th>
                  <th className="text-left p-3 font-semibold">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((c: any) => {
                  const st = STATUTS.find((s) => s.valeur === c.status);
                  const StIcon = st?.icon ?? Clock;
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-emerald-50/30 transition">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                            <ShoppingCart className="h-4 w-4 text-emerald-600" />
                          </div>
                          <span className="font-mono text-xs font-medium">{c.order_ref}</span>
                        </div>
                      </td>
                      <td className="p-3"><Badge variant="outline">{c.offer_code}</Badge></td>
                      <td className="p-3">
                        <div className="text-sm font-medium truncate flex items-center gap-1"><User className="h-3 w-3 text-slate-400" />{c.client_name}</div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          {c.client_email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.client_email}</div>}
                          {c.client_phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.client_phone}</div>}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold">{formatMontant(c.amount_gnf)}</td>
                      <td className="p-3">
                        {c.invoice_number ? (
                          <Badge className="bg-sky-100 text-sky-700 border-sky-200 gap-1"><FileText className="h-3 w-3" />{c.invoice_number}</Badge>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Aucune</span>
                        )}
                      </td>
                      <td className="p-3"><Badge className={cn("gap-1", st?.cls)}><StIcon className="h-3 w-3" />{st?.label ?? c.status}</Badge></td>
                      <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {commandes.data && commandes.data.total > 25 && (
        <div className="flex justify-between text-sm text-slate-600">
          <span>Page {page} · {commandes.data.total} résultats</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button size="sm" variant="outline" disabled={page * 25 >= commandes.data.total} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-500",
    sky: "from-sky-500 to-blue-600",
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
