import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard, Search, RefreshCw, CheckCircle2, XCircle, Clock, DollarSign,
  Wallet, TrendingUp, Download, User, Phone, FileText, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTimeFr } from "@/lib/admin";
import { salesPaiements, salesConfirmerPaiement, salesRejeterPaiement } from "@/lib/sales.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/payments")({
  component: SalesPaiements,
});

const STATUTS = [
  { valeur: "pending", label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  { valeur: "success", label: "Réussis", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  { valeur: "failed", label: "Échoués", cls: "bg-rose-100 text-rose-700 border-rose-200", icon: XCircle },
];

function formatMontant(m: number): string {
  return new Intl.NumberFormat("fr-FR").format(m) + " GNF";
}

function SalesPaiements() {
  const listerFn = useServerFn(salesPaiements);
  const confirmerFn = useServerFn(salesConfirmerPaiement);
  const rejeterFn = useServerFn(salesRejeterPaiement);
  const qc = useQueryClient();

  const [statut, setStatut] = useState<string>("pending");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [confirmerId, setConfirmerId] = useState<string | null>(null);
  const [rejeterId, setRejeterId] = useState<string | null>(null);
  const [externalRef, setExternalRef] = useState("");
  const [note, setNote] = useState("");
  const [motif, setMotif] = useState("");

  const paiements = useQuery({
    queryKey: ["sales", "payments", { statut, page }],
    queryFn: () => listerFn({ data: { statut, page, pageSize: 25 } }),
  });

  useRealtimeInvalidate({
    table: "payments",
    invalidate: [["sales", "payments"]],
  });

  const rafraichir = () => { void qc.invalidateQueries({ queryKey: ["sales", "payments"] }); toast.success("Actualisé."); };

  const confirmer = useMutation({
    mutationFn: (v: { paymentId: string; externalRef: string; note?: string | null }) => confirmerFn({ data: v }),
    onSuccess: () => {
      toast.success("Paiement confirmé, facture émise.");
      setConfirmerId(null); setExternalRef(""); setNote("");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejeter = useMutation({
    mutationFn: (v: { paymentId: string; motif: string }) => rejeterFn({ data: v }),
    onSuccess: () => {
      toast.success("Paiement rejeté, client notifié.");
      setRejeterId(null); setMotif("");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lignes = paiements.data?.lignes ?? [];
  const filtered = useMemo(() => {
    if (!q.trim()) return lignes;
    const t = q.toLowerCase();
    return lignes.filter((p: any) =>
      (p.order_ref ?? "").toLowerCase().includes(t) ||
      (p.client ?? "").toLowerCase().includes(t) ||
      (p.external_ref ?? "").toLowerCase().includes(t),
    );
  }, [lignes, q]);

  const stats = useMemo(() => {
    const total = lignes.reduce((s: number, p: any) => s + Number(p.amount_gnf ?? 0), 0);
    const enAttente = lignes.filter((p: any) => p.status === "pending").length;
    return { total, enAttente, count: paiements.data?.total ?? 0 };
  }, [lignes, paiements.data]);

  const csvUrl = useMemo(() => {
    if (!filtered.length) return null;
    const header = "commande,client,montant,provider,statut,reference,date\n";
    const lines = filtered.map((p: any) => [
      p.order_ref, p.client, p.amount_gnf, p.provider ?? "", p.status,
      p.external_ref ?? "", p.paid_at ?? "",
    ].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <CreditCard className="h-3.5 w-3.5" /> Encaissements
            </div>
            <h1 className="mt-1 text-3xl font-bold">Paiements</h1>
            <p className="mt-1 text-sm text-white/80">Confirmer les paiements manuels et rejeter les paiements invalides.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={rafraichir}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
            </Button>
            {csvUrl && <a href={csvUrl} download={`paiements_${new Date().toISOString().slice(0,10)}.csv`}>
              <Button variant="secondary" className="bg-white text-emerald-700 hover:bg-white/90"><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
            </a>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total (page)" value={formatMontant(stats.total)} icon={DollarSign} tone="emerald" />
        <KpiCard label="En attente" value={stats.enAttente.toString()} icon={Clock} tone="amber" />
        <KpiCard label="Total résultats" value={stats.count.toString()} icon={Wallet} tone="sky" />
      </div>

      {/* Filtres */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-end">
            <div className="flex-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="N° commande, client, référence…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="w-full lg:w-52">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Statut</Label>
              <Select value={statut} onValueChange={(v) => { setStatut(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {STATUTS.map((s) => <SelectItem key={s.valeur} value={s.valeur}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="border-slate-200 overflow-hidden">
        {paiements.isLoading ? (
          <div className="p-16 text-center">
            <div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin mb-3" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-slate-400" />
            </div>
            <div className="text-slate-500">Aucun paiement.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left p-3 font-semibold">Commande</th>
                  <th className="text-left p-3 font-semibold">Client</th>
                  <th className="text-left p-3 font-semibold">Provider</th>
                  <th className="text-right p-3 font-semibold">Montant</th>
                  <th className="text-left p-3 font-semibold">Référence</th>
                  <th className="text-left p-3 font-semibold">Statut</th>
                  <th className="text-left p-3 font-semibold">Payé le</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => {
                  const st = STATUTS.find((s) => s.valeur === p.status);
                  const StIcon = st?.icon ?? Clock;
                  return (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-emerald-50/30 transition group">
                      <td className="p-3">
                        <div className="font-mono text-xs">{p.order_ref}</div>
                        <Badge variant="outline" className="text-[10px] mt-0.5">{p.offer_code}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium truncate">{p.client}</div>
                        {p.client_phone && <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{p.client_phone}</div>}
                      </td>
                      <td className="p-3"><Badge variant="outline">{p.provider ?? "—"}</Badge></td>
                      <td className="p-3 text-right font-semibold">{formatMontant(p.amount_gnf)}</td>
                      <td className="p-3 font-mono text-xs">{p.external_ref ?? <span className="text-slate-400 italic">—</span>}</td>
                      <td className="p-3">
                        <Badge className={cn("gap-1", st?.cls)}><StIcon className="h-3 w-3" />{st?.label ?? p.status}</Badge>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(p.paid_at)}</td>
                      <td className="p-3">
                        {p.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setConfirmerId(p.id); setExternalRef(""); setNote(""); }}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirmer
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-rose-600 border-rose-300 hover:bg-rose-50" onClick={() => { setRejeterId(p.id); setMotif(""); }}>
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {paiements.data && paiements.data.total > 25 && (
        <div className="flex justify-between text-sm text-slate-600">
          <span>Page {page} · {paiements.data.total} résultats</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button size="sm" variant="outline" disabled={page * 25 >= paiements.data.total} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}

      {/* Dialog confirmer */}
      <Dialog open={confirmerId !== null} onOpenChange={(o) => !o && setConfirmerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Confirmer le paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Référence externe du reçu *</Label>
              <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="Ex : Orange Money OM12345…" />
            </div>
            <div>
              <Label className="text-xs">Note interne (optionnelle)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmerId(null)}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={externalRef.trim().length < 3 || confirmer.isPending}
              onClick={() => confirmerId && confirmer.mutate({ paymentId: confirmerId, externalRef: externalRef.trim(), note: note.trim() || null })}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog rejeter */}
      <Dialog open={rejeterId !== null} onOpenChange={(o) => !o && setRejeterId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-rose-500" />Rejeter le paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Motif du rejet * (envoyé au client)</Label>
            <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={4} placeholder="Ex : Référence introuvable dans notre système…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeterId(null)}>Annuler</Button>
            <Button className="bg-rose-600 hover:bg-rose-700" disabled={motif.trim().length < 3 || rejeter.isPending}
              onClick={() => rejeterId && rejeter.mutate({ paymentId: rejeterId, motif: motif.trim() })}>
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
