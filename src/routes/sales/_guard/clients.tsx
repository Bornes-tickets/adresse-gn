import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users, Search, RefreshCw, Download, Mail, Phone, MessageCircle,
  ShoppingCart, Repeat, TrendingUp, Copy, Crown, Star, User as UserIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeFr } from "@/lib/admin";
import { salesClients } from "@/lib/sales.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/_guard/clients")({
  component: SalesClients,
});

function formatMontant(m: number) { return new Intl.NumberFormat("fr-FR").format(m) + " GNF"; }

function agentColor(seed: string): string {
  const palettes = [
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-blue-600",
    "from-violet-500 to-fuchsia-600",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-600",
    "from-indigo-500 to-violet-600",
  ];
  const h = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palettes[h % palettes.length]!;
}

function tierClient(total: number, nb: number): { label: string; cls: string; icon: any } {
  if (total >= 1_000_000 || nb >= 10) return { label: "Premium", cls: "bg-gradient-to-r from-amber-400 to-orange-500 text-white", icon: Crown };
  if (total >= 200_000 || nb >= 3) return { label: "Fidèle", cls: "bg-gradient-to-r from-violet-400 to-fuchsia-500 text-white", icon: Star };
  return { label: "Nouveau", cls: "bg-slate-100 text-slate-700", icon: UserIcon };
}

function SalesClients() {
  const fn = useServerFn(salesClients);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<"all" | "premium" | "fidele" | "nouveau">("all");

  const clients = useQuery({
    queryKey: ["sales", "clients", { q, page }],
    queryFn: () => fn({ data: { q, page, pageSize: 25 } }),
  });

  const rafraichir = () => { void qc.invalidateQueries({ queryKey: ["sales", "clients"] }); toast.success("Actualisé."); };

  const lignes = clients.data?.lignes ?? [];
  const filtered = useMemo(() => {
    if (tierFilter === "all") return lignes;
    return lignes.filter((c: any) => {
      const t = tierClient(c.total_depense, c.nb_commandes).label.toLowerCase();
      return t === tierFilter;
    });
  }, [lignes, tierFilter]);

  const stats = useMemo(() => {
    const premium = lignes.filter((c: any) => tierClient(c.total_depense, c.nb_commandes).label === "Premium").length;
    const fideles = lignes.filter((c: any) => tierClient(c.total_depense, c.nb_commandes).label === "Fidèle").length;
    const totalRevenus = lignes.reduce((s: number, c: any) => s + Number(c.total_depense ?? 0), 0);
    const avecAbo = lignes.filter((c: any) => c.abonnements_actifs > 0).length;
    return { premium, fideles, totalRevenus, avecAbo, count: clients.data?.total ?? 0 };
  }, [lignes, clients.data]);

  const csvUrl = useMemo(() => {
    if (!lignes.length) return null;
    const header = "nom,email,telephone,role,nb_commandes,total_depense,derniere_commande,abonnements_actifs\n";
    const rows = lignes.map((c: any) => [
      c.full_name ?? "", c.email ?? "", c.phone ?? "", c.role,
      c.nb_commandes, c.total_depense, c.derniere_commande ?? "", c.abonnements_actifs,
    ].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + rows], { type: "text/csv;charset=utf-8" }));
  }, [lignes]);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <Users className="h-3.5 w-3.5" /> CRM
            </div>
            <h1 className="mt-1 text-3xl font-bold">Clients</h1>
            <p className="mt-1 text-sm text-white/80">Base clients avec segmentation Premium / Fidèle / Nouveau.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={rafraichir}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
            </Button>
            {csvUrl && <a href={csvUrl} download={`clients_${new Date().toISOString().slice(0,10)}.csv`}>
              <Button variant="secondary" className="bg-white text-sky-700 hover:bg-white/90"><Download className="h-4 w-4 mr-1.5" />Export</Button>
            </a>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total clients" value={stats.count.toString()} icon={Users} tone="sky" />
        <KpiCard label="Premium" value={stats.premium.toString()} icon={Crown} tone="amber" />
        <KpiCard label="Fidèles" value={stats.fideles.toString()} icon={Star} tone="violet" />
        <KpiCard label="Avec abonnement" value={stats.avecAbo.toString()} icon={Repeat} tone="emerald" />
      </div>

      {/* Filtres tier */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: "all" as const, l: "Tous", i: Users },
          { v: "premium" as const, l: "Premium", i: Crown },
          { v: "fidele" as const, l: "Fidèles", i: Star },
          { v: "nouveau" as const, l: "Nouveaux", i: UserIcon },
        ].map((f) => (
          <button key={f.v} onClick={() => setTierFilter(f.v)}
            className={cn("px-3 py-1.5 text-xs rounded-full border font-medium transition inline-flex items-center gap-1.5",
              tierFilter === f.v ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400")}>
            <f.i className="h-3 w-3" /> {f.l}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Nom ou téléphone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="border-slate-200 overflow-hidden">
        {clients.isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-sky-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <div className="text-sm text-slate-500">Aucun client trouvé.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold">Client</th>
                  <th className="text-left p-3 font-semibold">Contact</th>
                  <th className="text-left p-3 font-semibold">Tier</th>
                  <th className="text-right p-3 font-semibold">Commandes</th>
                  <th className="text-right p-3 font-semibold">Total dépensé</th>
                  <th className="text-left p-3 font-semibold">Abonnements</th>
                  <th className="text-left p-3 font-semibold">Dernière commande</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => {
                  const tier = tierClient(c.total_depense, c.nb_commandes);
                  const TierIcon = tier.icon;
                  const initiales = (c.full_name ?? c.email ?? "?").slice(0, 2).toUpperCase();
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50/30 transition group">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shadow", agentColor(c.id))}>
                            {initiales}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.full_name ?? <span className="text-slate-400 italic">Sans nom</span>}</div>
                            <Badge variant="outline" className="text-[10px] mt-0.5">{c.role}</Badge>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5 text-xs">
                          {c.email && <div className="flex items-center gap-1 text-slate-600"><Mail className="h-3 w-3" />{c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1 text-slate-600"><Phone className="h-3 w-3" />{c.phone}</div>}
                        </div>
                      </td>
                      <td className="p-3"><Badge className={cn("gap-1", tier.cls)}><TierIcon className="h-3 w-3" />{tier.label}</Badge></td>
                      <td className="p-3 text-right font-semibold">{c.nb_commandes}</td>
                      <td className="p-3 text-right font-semibold text-emerald-700">{formatMontant(c.total_depense)}</td>
                      <td className="p-3">
                        {c.abonnements_actifs > 0
                          ? <Badge className="bg-violet-100 text-violet-700 border-violet-200 gap-1"><Repeat className="h-3 w-3" />{c.abonnements_actifs}</Badge>
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="p-3 text-xs text-slate-500">{c.derniere_commande ? formatDateTimeFr(c.derniere_commande) : "—"}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end opacity-70 group-hover:opacity-100 transition">
                          {c.phone && (
                            <>
                              <a href={`tel:${c.phone}`} title="Appeler"><Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Phone className="h-3.5 w-3.5" /></Button></a>
                              <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp"><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600"><MessageCircle className="h-3.5 w-3.5" /></Button></a>
                            </>
                          )}
                          {c.email && <a href={`mailto:${c.email}`} title="Email"><Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Mail className="h-3.5 w-3.5" /></Button></a>}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Copier ID"
                            onClick={() => { navigator.clipboard.writeText(c.id); toast.success("ID copié."); }}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {clients.data && clients.data.total > 25 && (
        <div className="flex justify-between text-sm text-slate-600">
          <span>Page {page} · {clients.data.total} clients</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button size="sm" variant="outline" disabled={page * 25 >= clients.data.total} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    sky: "from-sky-500 to-blue-600",
    amber: "from-amber-400 to-orange-500",
    violet: "from-violet-500 to-fuchsia-600",
    emerald: "from-emerald-500 to-teal-600",
  };
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
