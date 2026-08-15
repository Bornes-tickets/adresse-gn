import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package, Plus, Search, RefreshCw, Sparkles, User, Zap, FileText, FileArchive,
  Info, AlertTriangle, TrendingUp, MapPin, Home, ShieldCheck, Building2, Briefcase,
  Wifi, Truck, Calculator, ArrowRight, Send, Factory, CheckCircle2, PackageCheck,
  Clock, Eye, MoreVertical, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTimeFr } from "@/lib/admin";
import {
  opsLots, opsGenerateLot, opsExportQrPdf, opsExportQrZip, opsRegions, opsFournisseurs,
  opsUpdateLotStatus, opsLotDetail,
} from "@/lib/ops.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops/_guard/commandes-fournisseurs")({ component: OpsCommandes });

const CATEGORIES = [
  { code: "digital_only", label: "Numérique", desc: "QR seul, sans plaque", tarif: 0, icon: Wifi },
  { code: "residential", label: "Résidentiel", desc: "Plaque standard", tarif: 25000, icon: Home },
  { code: "residential_plus", label: "Résidentiel+", desc: "Plaque premium", tarif: 45000, icon: ShieldCheck },
  { code: "professional", label: "Professionnel", desc: "Commerce, PME", tarif: 60000, icon: Briefcase },
  { code: "institutional", label: "Institutionnel", desc: "Administration, ONG", tarif: 80000, icon: Building2 },
  { code: "custom", label: "Sur mesure", desc: "Format spécifique", tarif: null, icon: Sparkles },
];

const PIPELINE = [
  { code: "draft", label: "Brouillon", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: FileText, next: "sent", nextLabel: "Envoyer au fournisseur" },
  { code: "sent", label: "Envoyée", cls: "bg-sky-100 text-sky-700 border-sky-200", icon: Send, next: "in_production", nextLabel: "En production" },
  { code: "in_production", label: "En production", cls: "bg-violet-100 text-violet-700 border-violet-200", icon: Factory, next: "shipped", nextLabel: "Marquer expédiée" },
  { code: "shipped", label: "Expédiée", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Truck, next: "received", nextLabel: "Réceptionner" },
  { code: "received", label: "Reçue au stock", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: PackageCheck, next: "distributed", nextLabel: "Distribuer aux agents" },
  { code: "distributed", label: "Distribuée", cls: "bg-teal-100 text-teal-700 border-teal-200", icon: Zap, next: null, nextLabel: null },
];

const PRESETS_QTE = [10, 25, 50, 100, 200, 500];

function formatMontant(m: number | null): string {
  if (m == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(m) + " GNF";
}

function statutInfo(code: string) {
  return PIPELINE.find((s) => s.code === code) ?? { code, label: code, cls: "bg-slate-100 text-slate-700 border-slate-200", icon: Package, next: null, nextLabel: null };
}

function OpsCommandes() {
  const listerFn = useServerFn(opsLots);
  const generateFn = useServerFn(opsGenerateLot);
  const exportPdfFn = useServerFn(opsExportQrPdf);
  const exportZipFn = useServerFn(opsExportQrZip);
  const regionsFn = useServerFn(opsRegions);
  const fournisseursFn = useServerFn(opsFournisseurs);
  const updateStatusFn = useServerFn(opsUpdateLotStatus);
  const detailFn = useServerFn(opsLotDetail);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState<string | null>(null);
  const [openGen, setOpenGen] = useState(false);
  const [detailLotId, setDetailLotId] = useState<string | null>(null);
  const [confirmNext, setConfirmNext] = useState<{ id: string; from: string; to: string } | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [form, setForm] = useState({
    quantity: 50,
    regionId: "",
    category: "residential",
    supplier: "",
    unitPriceGnf: "",
    priority: "normal" as "normal" | "urgent",
    notes: "",
  });

  const lots = useQuery({ queryKey: ["ops", "lots"], queryFn: () => listerFn() });
  const regions = useQuery({ queryKey: ["ops", "regions"], queryFn: () => regionsFn(), enabled: openGen });
  const fournisseurs = useQuery({ queryKey: ["ops", "fournisseurs"], queryFn: () => fournisseursFn(), enabled: openGen });
  const detail = useQuery({
    queryKey: ["ops", "lot-detail", detailLotId],
    queryFn: () => detailFn({ data: { lotId: detailLotId! } }),
    enabled: !!detailLotId,
  });
  useRealtimeInvalidate({ table: "lots", invalidate: [["ops", "lots"]] });

  const generate = useMutation({
    mutationFn: (v: any) => generateFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Commande ${r.lotCode} créée : ${r.quantite} balises (${r.premier} → ${r.dernier}).`);
      qc.invalidateQueries({ queryKey: ["ops", "lots"] });
      setOpenGen(false);
      setForm({ quantity: 50, regionId: "", category: "residential", supplier: "", unitPriceGnf: "", priority: "normal", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (v: { lotId: string; statut: string; notes?: string | null }) => updateStatusFn({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["ops", "lots"] });
      qc.invalidateQueries({ queryKey: ["ops", "lot-detail"] });
      setConfirmNext(null);
      setConfirmNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportPdf = useMutation({
    mutationFn: (lotId: string) => exportPdfFn({ data: { lotId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `QR_${r.lotCode}.pdf`; a.click();
      toast.success(`PDF ${r.pages} page(s) généré.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportZip = useMutation({
    mutationFn: (lotId: string) => exportZipFn({ data: { lotId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/zip" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `QR_${r.lotCode}.zip`; a.click();
      toast.success(`ZIP ${r.fichiers} PNG généré.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (lots.data ?? []) as any[];
  const filtered = useMemo(() => {
    let r = rows;
    if (statutFilter) r = r.filter((l) => l.status === statutFilter);
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((l) => (l.code ?? "").toLowerCase().includes(t) || (l.supplier ?? "").toLowerCase().includes(t));
    }
    return r;
  }, [rows, q, statutFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of rows) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  // Live calcs form
  const categorieChoisie = CATEGORIES.find((c) => c.code === form.category)!;
  const CatIcon = categorieChoisie.icon;
  const regionChoisie = regions.data?.find((r: any) => r.id === form.regionId);
  const prixUnitaire = form.unitPriceGnf ? Number(form.unitPriceGnf) : categorieChoisie.tarif;
  const total = prixUnitaire != null ? prixUnitaire * form.quantity : null;
  const prefixBalise = regionChoisie ? `GN-${regionChoisie.code.toUpperCase().slice(0, 3)}-` : "—";
  const delaiEstime = form.quantity <= 50 ? "24-48h" : form.quantity <= 200 ? "2-4 jours" : form.quantity <= 500 ? "5-7 jours" : "1-2 semaines";
  const peutGenerer = form.regionId && form.quantity >= 1 && form.quantity <= 1000 && !generate.isPending;

  return (
    <div className="space-y-6">
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><Package className="h-3.5 w-3.5" /> Approvisionnement</div>
            <h1 className="mt-1 text-3xl font-bold">Commandes fournisseurs</h1>
            <p className="mt-1 text-sm text-white/80">Cycle complet : brouillon → envoyée → production → réception → distribution.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => qc.invalidateQueries({ queryKey: ["ops", "lots"] })}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Rafraîchir
            </Button>
            <Dialog open={openGen} onOpenChange={setOpenGen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="bg-white text-orange-700 hover:bg-white/90 shadow-md">
                  <Plus className="h-4 w-4 mr-1.5" />Nouvelle commande
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    Nouvelle commande fournisseur
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 block">Catégorie *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {CATEGORIES.map((c) => {
                        const Ic = c.icon;
                        const sel = form.category === c.code;
                        return (
                          <button key={c.code} type="button" onClick={() => setForm({ ...form, category: c.code })}
                            className={cn("text-left p-3 rounded-xl border-2 transition-all",
                              sel ? "border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white")}>
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2",
                              sel ? "bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow" : "bg-slate-100 text-slate-500")}>
                              <Ic className="h-4 w-4" />
                            </div>
                            <div className={cn("text-sm font-bold", sel ? "text-orange-700" : "text-slate-900")}>{c.label}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{c.desc}</div>
                            {c.tarif != null && <div className={cn("text-[10px] font-semibold mt-1", sel ? "text-orange-600" : "text-slate-400")}>Prix : {formatMontant(c.tarif)}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> Zone (région) *
                    </Label>
                    <Select value={form.regionId} onValueChange={(v) => setForm({ ...form, regionId: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder={regions.isLoading ? "Chargement…" : "Sélectionner une région"} /></SelectTrigger>
                      <SelectContent>
                        {(regions.data ?? []).map((r: any) => (
                          <SelectItem key={r.id} value={r.id}><span className="font-mono text-xs mr-2 opacity-70">{r.code}</span>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {regionChoisie && <div className="mt-2 text-[10px] text-slate-500 font-mono">Préfixe : <span className="font-semibold text-slate-700">{prefixBalise}NNNNNN</span></div>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Quantité *</Label>
                      <span className="text-xs text-slate-500">Max 1000</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {PRESETS_QTE.map((p) => (
                        <button key={p} type="button" onClick={() => setForm({ ...form, quantity: p })}
                          className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition",
                            form.quantity === p ? "bg-orange-600 text-white border-orange-600 shadow" : "bg-white border-slate-200 text-slate-600 hover:border-orange-300")}>
                          {p}
                        </button>
                      ))}
                    </div>
                    <Input type="number" min={1} max={1000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                      className="h-11 font-mono text-lg text-center" />
                    {form.quantity > 500 && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Gros lot ({form.quantity}) — vérifiez le stock du fournisseur.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Prix unitaire (GNF)</Label>
                      <Input type="number" value={form.unitPriceGnf} onChange={(e) => setForm({ ...form, unitPriceGnf: e.target.value })}
                        placeholder={categorieChoisie.tarif != null ? String(categorieChoisie.tarif) : "0"} className="h-11 font-mono" />
                      <div className="text-[10px] text-slate-500 mt-1">
                        {categorieChoisie.tarif != null ? `Par défaut : ${formatMontant(categorieChoisie.tarif)}` : "Sur devis"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                        <Truck className="h-3 w-3" /> Fournisseur
                      </Label>
                      <Input list="fournisseurs-liste" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                        placeholder="Nom du fournisseur" className="h-11" />
                      <datalist id="fournisseurs-liste">
                        {(fournisseurs.data ?? []).map((f: string) => <option key={f} value={f} />)}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 block">Priorité</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setForm({ ...form, priority: "normal" })}
                        className={cn("p-3 rounded-xl border-2 text-left",
                          form.priority === "normal" ? "border-slate-800 bg-slate-50 shadow" : "border-slate-200 hover:border-slate-300")}>
                        <div className="text-sm font-bold text-slate-900">Standard</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Délai normal</div>
                      </button>
                      <button type="button" onClick={() => setForm({ ...form, priority: "urgent" })}
                        className={cn("p-3 rounded-xl border-2 text-left",
                          form.priority === "urgent" ? "border-rose-500 bg-rose-50 shadow" : "border-slate-200 hover:border-slate-300")}>
                        <div className="text-sm font-bold text-rose-700 flex items-center gap-1"><Zap className="h-3 w-3" />Urgent</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Prioritaire</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Notes pour le fournisseur</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Instructions particulières…" rows={2} className="rounded-xl" />
                  </div>

                  <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-orange-600" />
                        <span className="text-xs font-bold uppercase tracking-wider text-orange-800">Récapitulatif</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Catégorie</div>
                          <div className="flex items-center gap-1 mt-0.5 font-semibold text-slate-900">
                            <CatIcon className="h-3.5 w-3.5 text-orange-600" />{categorieChoisie.label}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Région</div>
                          <div className="font-semibold text-slate-900 mt-0.5">{regionChoisie?.name ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Quantité</div>
                          <div className="font-mono text-lg font-bold text-slate-900 mt-0.5">{form.quantity} balises</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Délai estimé</div>
                          <div className="font-semibold text-slate-900 mt-0.5">{delaiEstime}</div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-amber-300/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">Prix unitaire</span>
                          <span className="font-mono font-semibold">{formatMontant(prixUnitaire)}</span>
                        </div>
                        <div className="flex items-center justify-between text-lg">
                          <span className="font-bold text-slate-900">Total estimé</span>
                          <span className="font-mono font-bold text-orange-700">{formatMontant(total)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setOpenGen(false)}>Annuler</Button>
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md"
                    disabled={!peutGenerer}
                    onClick={() => generate.mutate({
                      quantity: form.quantity, regionId: form.regionId, category: form.category,
                      supplier: form.supplier || null, unitPriceGnf: form.unitPriceGnf ? Number(form.unitPriceGnf) : null,
                    })}>
                    <Zap className="h-4 w-4 mr-1.5" />Créer la commande<ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Pipeline visuel — pills par statut */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatutFilter(null)}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition",
            !statutFilter ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600")}>
          Toutes ({rows.length})
        </button>
        {PIPELINE.map((s) => {
          const Ic = s.icon;
          const n = stats[s.code] ?? 0;
          return (
            <button key={s.code} onClick={() => setStatutFilter(statutFilter === s.code ? null : s.code)}
              className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition inline-flex items-center gap-1.5",
                statutFilter === s.code ? "bg-slate-900 text-white border-slate-900" : `${s.cls} hover:opacity-80`)}>
              <Ic className="h-3 w-3" /> {s.label} ({n})
            </button>
          );
        })}
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
          : filtered.length === 0 ? <div className="p-16 text-center text-slate-500">Aucune commande.</div>
          : (
            <div className="divide-y divide-slate-100">
              {filtered.map((l: any) => {
                const st = statutInfo(l.status);
                const StIcon = st.icon;
                const stepIndex = PIPELINE.findIndex((s) => s.code === l.status);
                return (
                  <div key={l.id} className="p-4 hover:bg-amber-50/30 transition">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <div className="font-mono text-sm font-bold">{l.code}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {l.quantity} balises · {CATEGORIES.find((c) => c.code === l.category)?.label ?? l.category ?? "—"}
                              {l.supplier && <span> · {l.supplier}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Mini timeline */}
                        <div className="flex items-center gap-1 mt-3 mb-2">
                          {PIPELINE.map((s, i) => {
                            const done = i <= stepIndex;
                            const active = i === stepIndex;
                            const Ic = s.icon;
                            return (
                              <div key={s.code} className="flex-1 flex items-center">
                                <div className={cn(
                                  "h-6 w-6 rounded-full flex items-center justify-center transition",
                                  active ? cn(s.cls, "border-2 scale-110 shadow-sm") :
                                  done ? "bg-emerald-500 text-white" :
                                  "bg-slate-100 text-slate-400",
                                )}>
                                  <Ic className="h-3 w-3" />
                                </div>
                                {i < PIPELINE.length - 1 && (
                                  <div className={cn("flex-1 h-0.5 mx-0.5", done && i < stepIndex ? "bg-emerald-500" : "bg-slate-200")} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={cn("font-semibold px-2 py-0.5 rounded", st.cls)}>{st.label}</span>
                          <span className="text-slate-500">Reçu le {formatDateTimeFr(l.received_at)}</span>
                        </div>
                      </div>

                      <div className="flex gap-1 items-start">
                        {st.next && (
                          <Button
                            size="sm"
                            className="h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                            onClick={() => { setConfirmNext({ id: l.id, from: l.status, to: st.next! }); setConfirmNotes(""); }}
                          >
                            <ArrowRight className="h-3.5 w-3.5 mr-1" />
                            {st.nextLabel}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-9" onClick={() => setDetailLotId(l.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-9 w-9 p-0"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportPdf.mutate(l.id)}>
                              <FileText className="h-4 w-4 mr-2" /> Exporter PDF QR
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportZip.mutate(l.id)}>
                              <FileArchive className="h-4 w-4 mr-2" /> Exporter ZIP PNG
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDetailLotId(l.id)}>
                              <MessageSquare className="h-4 w-4 mr-2" /> Voir la timeline
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </Card>

      {/* Dialog confirmation changement de statut */}
      <Dialog open={confirmNext !== null} onOpenChange={(o) => !o && setConfirmNext(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statutInfo(confirmNext?.to ?? "").label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-600">
              Passer de <strong>{statutInfo(confirmNext?.from ?? "").label}</strong> à <strong>{statutInfo(confirmNext?.to ?? "").label}</strong> ?
            </div>
            <div>
              <Label className="text-xs">Note (optionnelle)</Label>
              <Textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} rows={3} placeholder="Ex : Colis reçu en bon état, 500 pièces conformes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNext(null)}>Annuler</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              onClick={() => confirmNext && updateStatus.mutate({ lotId: confirmNext.id, statut: confirmNext.to, notes: confirmNotes.trim() || null })}
              disabled={updateStatus.isPending}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog détail + timeline complète */}
      <Dialog open={detailLotId !== null} onOpenChange={(o) => !o && setDetailLotId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              {detail.data?.lot.code}
            </DialogTitle>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="py-8 text-center"><div className="inline-block h-6 w-6 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div>
          ) : detail.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm p-3 rounded-xl bg-slate-50">
                <div><span className="text-slate-500">Quantité :</span> <strong>{detail.data.lot.quantity}</strong></div>
                <div><span className="text-slate-500">Fournisseur :</span> {detail.data.lot.supplier ?? "—"}</div>
                <div><span className="text-slate-500">Envoyée :</span> {formatDateTimeFr(detail.data.lot.sent_at)}</div>
                <div><span className="text-slate-500">Reçue :</span> {formatDateTimeFr(detail.data.lot.received_at)}</div>
                {detail.data.lot.notes && (
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">Notes :</div>
                    <div className="text-xs italic">{detail.data.lot.notes}</div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />Historique du cycle
                </h3>
                <div className="space-y-2">
                  {detail.data.events.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">Aucun événement.</p>
                  ) : detail.data.events.map((e: any, i: number) => (
                    <div key={e.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-[10px] shadow">
                          {i + 1}
                        </div>
                        {i < detail.data.events.length - 1 && <div className="w-0.5 h-8 bg-slate-200" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="text-sm font-semibold">{statutInfo(e.event_type).label}</div>
                        <div className="text-[10px] text-slate-500">{formatDateTimeFr(e.event_at)}</div>
                        {e.notes && <div className="text-xs text-slate-700 mt-1 italic p-2 bg-slate-50 rounded">{e.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
