import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package, Plus, Search, RefreshCw, Download, Sparkles, User, Zap,
  FileText, FileArchive, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDateTimeFr } from "@/lib/admin";
import { opsLots, opsGenerateLot, opsExportQrPdf, opsExportQrZip, opsAssignLot } from "@/lib/ops.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops/_guard/lots")({ component: OpsLots });

const CATEGORIES = [
  { code: "digital_only", label: "Numérique" },
  { code: "residential", label: "Résidentiel" },
  { code: "residential_plus", label: "Résidentiel+" },
  { code: "professional", label: "Professionnel" },
  { code: "institutional", label: "Institutionnel" },
  { code: "custom", label: "Sur mesure" },
];

function OpsLots() {
  const listerFn = useServerFn(opsLots);
  const generateFn = useServerFn(opsGenerateLot);
  const exportPdfFn = useServerFn(opsExportQrPdf);
  const exportZipFn = useServerFn(opsExportQrZip);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [openGen, setOpenGen] = useState(false);
  const [form, setForm] = useState({ quantity: 50, regionId: "", category: "residential", supplier: "", unitPriceGnf: "" });

  const lots = useQuery({ queryKey: ["ops", "lots"], queryFn: () => listerFn() });
  useRealtimeInvalidate({ table: "lots", invalidate: [["ops", "lots"]] });

  const generate = useMutation({
    mutationFn: (v: any) => generateFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`Lot ${r.lotCode} créé : ${r.quantite} balises ${r.category}.`);
      qc.invalidateQueries({ queryKey: ["ops", "lots"] });
      setOpenGen(false);
      setForm({ quantity: 50, regionId: "", category: "residential", supplier: "", unitPriceGnf: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportPdf = useMutation({
    mutationFn: (lotId: string) => exportPdfFn({ data: { lotId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `QR_${r.lotCode}.pdf`; a.click();
      toast.success(`PDF ${r.pages} page(s) généré.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportZip = useMutation({
    mutationFn: (lotId: string) => exportZipFn({ data: { lotId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `QR_${r.lotCode}.zip`; a.click();
      toast.success(`ZIP ${r.fichiers} PNG généré.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (lots.data ?? []) as any[];
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter((l) => (l.code ?? "").toLowerCase().includes(t) || (l.supplier ?? "").toLowerCase().includes(t));
  }, [rows, q]);

  const stats = useMemo(() => ({
    total: rows.length,
    generes: rows.filter((l) => l.status === "generated").length,
    distribues: rows.filter((l) => l.status === "distributed").length,
    quantiteTotal: rows.reduce((s, l) => s + Number(l.quantity ?? 0), 0),
  }), [rows]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><Package className="h-3.5 w-3.5" /> Production</div>
            <h1 className="mt-1 text-3xl font-bold">Lots de balises</h1>
            <p className="mt-1 text-sm text-white/80">Génération, distribution et export QR.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => qc.invalidateQueries({ queryKey: ["ops", "lots"] })}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Rafraîchir
            </Button>
            <Dialog open={openGen} onOpenChange={setOpenGen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="bg-white text-orange-700 hover:bg-white/90"><Plus className="h-4 w-4 mr-1.5" />Nouveau lot</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />Générer un lot de balises</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Catégorie</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {CATEGORIES.map((c) => (
                        <button key={c.code} type="button" onClick={() => setForm({ ...form, category: c.code })}
                          className={cn("p-2 rounded-lg border text-xs transition",
                            form.category === c.code ? "border-amber-500 bg-amber-50 text-amber-700 font-semibold" : "border-slate-200 hover:border-slate-300")}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Zone (region UUID) *</Label>
                    <Input value={form.regionId} onChange={(e) => setForm({ ...form, regionId: e.target.value })} placeholder="UUID de la région" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Quantité *</Label>
                      <Input type="number" min={1} max={1000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Prix unitaire GNF</Label>
                      <Input type="number" value={form.unitPriceGnf} onChange={(e) => setForm({ ...form, unitPriceGnf: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Fournisseur</Label>
                    <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Nom du fournisseur" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenGen(false)}>Annuler</Button>
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600" disabled={!form.regionId || generate.isPending}
                    onClick={() => generate.mutate({
                      quantity: form.quantity, regionId: form.regionId, category: form.category,
                      supplier: form.supplier || null, unitPriceGnf: form.unitPriceGnf ? Number(form.unitPriceGnf) : null,
                    })}>
                    <Zap className="h-4 w-4 mr-1.5" />Générer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total lots" value={stats.total} icon={Package} tone="amber" />
        <Kpi label="Générés" value={stats.generes} icon={Sparkles} tone="orange" />
        <Kpi label="Distribués" value={stats.distribues} icon={User} tone="violet" />
        <Kpi label="Total balises" value={stats.quantiteTotal} icon={FileText} tone="emerald" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Code ou fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {lots.isLoading ? <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div>
          : filtered.length === 0 ? <div className="p-16 text-center text-slate-500">Aucun lot.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Code</th>
                    <th className="text-left p-3 font-semibold">Catégorie</th>
                    <th className="text-right p-3 font-semibold">Quantité</th>
                    <th className="text-left p-3 font-semibold">Fournisseur</th>
                    <th className="text-left p-3 font-semibold">Statut</th>
                    <th className="text-left p-3 font-semibold">Reçu le</th>
                    <th className="text-right p-3 font-semibold">Exports QR</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l: any) => (
                    <tr key={l.id} className="border-t border-slate-100 hover:bg-amber-50/30 transition">
                      <td className="p-3 font-mono text-xs font-medium">{l.code}</td>
                      <td className="p-3"><Badge variant="outline">{CATEGORIES.find((c) => c.code === l.category)?.label ?? l.category ?? "—"}</Badge></td>
                      <td className="p-3 text-right font-semibold">{l.quantity}</td>
                      <td className="p-3 text-sm">{l.supplier ?? "—"}</td>
                      <td className="p-3"><Badge className={cn(l.status === "distributed" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700")}>{l.status}</Badge></td>
                      <td className="p-3 text-xs text-slate-500">{formatDateTimeFr(l.received_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => exportPdf.mutate(l.id)} disabled={exportPdf.isPending}>
                            <FileText className="h-3.5 w-3.5 mr-1" />PDF
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => exportZip.mutate(l.id)} disabled={exportZip.isPending}>
                            <FileArchive className="h-3.5 w-3.5 mr-1" />ZIP
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    amber: "from-amber-500 to-orange-500", orange: "from-orange-500 to-rose-600",
    violet: "from-violet-500 to-fuchsia-600", emerald: "from-emerald-500 to-teal-600",
  };
  return (
    <Card><CardContent className="p-5 flex items-center justify-between">
      <div><div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div><div className="text-2xl font-bold mt-1">{value.toLocaleString("fr-FR")}</div></div>
      <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-lg", tones[tone])}><Icon className="h-5 w-5" /></div>
    </CardContent></Card>
  );
}
