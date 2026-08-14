import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package, Plus, Search, RefreshCw, Sparkles, User, Zap, FileText,
  FileArchive, Info, AlertTriangle, TrendingUp, MapPin, Home, ShieldCheck,
  Building2, Briefcase, Wifi, Wrench, Truck, Calculator, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDateTimeFr } from "@/lib/admin";
import { opsLots, opsGenerateLot, opsExportQrPdf, opsExportQrZip, opsRegions, opsFournisseurs } from "@/lib/ops.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ops/_guard/lots")({ component: OpsLots });

const CATEGORIES = [
  { code: "digital_only", label: "Numérique", desc: "QR seul, sans plaque physique", tarif: 0, icon: Wifi, color: "slate" },
  { code: "residential", label: "Résidentiel", desc: "Plaque standard pour habitation", tarif: 25000, icon: Home, color: "sky" },
  { code: "residential_plus", label: "Résidentiel+", desc: "Plaque premium résidence", tarif: 45000, icon: ShieldCheck, color: "violet" },
  { code: "professional", label: "Professionnel", desc: "Commerce, artisans, PME", tarif: 60000, icon: Briefcase, color: "emerald" },
  { code: "institutional", label: "Institutionnel", desc: "Administration, ONG, écoles", tarif: 80000, icon: Building2, color: "indigo" },
  { code: "custom", label: "Sur mesure", desc: "Format et matériau spécifiques", tarif: null, icon: Sparkles, color: "amber" },
];

const PRESETS_QTE = [10, 25, 50, 100, 200, 500];

function formatMontant(m: number | null): string {
  if (m == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(m) + " GNF";
}

function OpsLots() {
  const listerFn = useServerFn(opsLots);
  const generateFn = useServerFn(opsGenerateLot);
  const exportPdfFn = useServerFn(opsExportQrPdf);
  const exportZipFn = useServerFn(opsExportQrZip);
  const regionsFn = useServerFn(opsRegions);
  const fournisseursFn = useServerFn(opsFournisseurs);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [openGen, setOpenGen] = useState(false);
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
  useRealtimeInvalidate({ table: "lots", invalidate: [["ops", "lots"]] });

  const generate = useMutation({
    mutationFn: (v: any) => generateFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Lot ${r.lotCode} créé : ${r.quantite} balises (${r.premier} → ${r.dernier}).`);
      qc.invalidateQueries({ queryKey: ["ops", "lots"] });
      setOpenGen(false);
      setForm({ quantity: 50, regionId: "", category: "residential", supplier: "", unitPriceGnf: "", priority: "normal", notes: "" });
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

  // Live calcs form
  const categorieChoisie = CATEGORIES.find((c) => c.code === form.category)!;
  const CatIcon = categorieChoisie.icon;
  const regionChoisie = regions.data?.find((r: any) => r.id === form.regionId);
  const prixUnitaire = form.unitPriceGnf ? Number(form.unitPriceGnf) : categorieChoisie.tarif;
  const total = prixUnitaire != null ? prixUnitaire * form.quantity : null;
  const codePreview = regionChoisie
    ? `LOT-${regionChoisie.code.toUpperCase()}-${Date.now().toString().slice(-8)}`
    : "—";
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
                <Button variant="secondary" className="bg-white text-orange-700 hover:bg-white/90 shadow-md"><Plus className="h-4 w-4 mr-1.5" />Nouveau lot</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    Générer un lot de balises
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                  {/* Catégorie — cards visuelles enrichies */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 block">Catégorie *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {CATEGORIES.map((c) => {
                        const Ic = c.icon;
                        const sel = form.category === c.code;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => setForm({ ...form, category: c.code })}
                            className={cn(
                              "text-left p-3 rounded-xl border-2 transition-all",
                              sel
                                ? "border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md"
                                : "border-slate-200 hover:border-slate-300 bg-white",
                            )}
                          >
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center mb-2 transition",
                              sel ? "bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow" : "bg-slate-100 text-slate-500",
                            )}>
                              <Ic className="h-4 w-4" />
                            </div>
                            <div className={cn("text-sm font-bold", sel ? "text-orange-700" : "text-slate-900")}>{c.label}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{c.desc}</div>
                            {c.tarif != null && (
                              <div className={cn("text-[10px] font-semibold mt-1", sel ? "text-orange-600" : "text-slate-400")}>
                                Prix indicatif : {formatMontant(c.tarif)}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Zone — dropdown réel */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> Zone (région) *
                    </Label>
                    <Select value={form.regionId} onValueChange={(v) => setForm({ ...form, regionId: v })}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={regions.isLoading ? "Chargement…" : "Sélectionner une région"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(regions.data ?? []).map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>
                            <span className="font-mono text-xs mr-2 opacity-70">{r.code}</span>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {regionChoisie && (
                      <div className="mt-2 text-[10px] text-slate-500 font-mono">
                        Préfixe des balises : <span className="font-semibold text-slate-700">{prefixBalise}NNNNNN</span>
                      </div>
                    )}
                  </div>

                  {/* Quantité avec presets */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Quantité *</Label>
                      <span className="text-xs text-slate-500">Max 1000</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {PRESETS_QTE.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setForm({ ...form, quantity: p })}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-full border font-semibold transition",
                            form.quantity === p
                              ? "bg-orange-600 text-white border-orange-600 shadow"
                              : "bg-white border-slate-200 text-slate-600 hover:border-orange-300",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                      className="h-11 font-mono text-lg text-center"
                    />
                    {form.quantity > 500 && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Gros lot ({form.quantity} balises) — vérifiez le stock papier chez le fournisseur.
                      </div>
                    )}
                  </div>

                  {/* Prix + Fournisseur */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Prix unitaire (GNF)</Label>
                      <Input
                        type="number"
                        value={form.unitPriceGnf}
                        onChange={(e) => setForm({ ...form, unitPriceGnf: e.target.value })}
                        placeholder={categorieChoisie.tarif != null ? String(categorieChoisie.tarif) : "0"}
                        className="h-11 font-mono"
                      />
                      <div className="text-[10px] text-slate-500 mt-1">
                        {categorieChoisie.tarif != null ? `Par défaut : ${formatMontant(categorieChoisie.tarif)}` : "Sur devis"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block flex items-center gap-1.5">
                        <Truck className="h-3 w-3" /> Fournisseur
                      </Label>
                      <Input
                        list="fournisseurs-liste"
                        value={form.supplier}
                        onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                        placeholder="Nom du fournisseur"
                        className="h-11"
                      />
                      <datalist id="fournisseurs-liste">
                        {(fournisseurs.data ?? []).map((f: string) => <option key={f} value={f} />)}
                      </datalist>
                    </div>
                  </div>

                  {/* Priorité */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 block">Priorité de production</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, priority: "normal" })}
                        className={cn("p-3 rounded-xl border-2 transition text-left",
                          form.priority === "normal" ? "border-slate-800 bg-slate-50 shadow" : "border-slate-200 hover:border-slate-300")}
                      >
                        <div className="text-sm font-bold text-slate-900">Standard</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Délai normal</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, priority: "urgent" })}
                        className={cn("p-3 rounded-xl border-2 transition text-left",
                          form.priority === "urgent" ? "border-rose-500 bg-rose-50 shadow" : "border-slate-200 hover:border-slate-300")}
                      >
                        <div className="text-sm font-bold text-rose-700 flex items-center gap-1"><Zap className="h-3 w-3" />Urgent</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Prioritaire · surcoût possible</div>
                      </button>
                    </div>
                  </div>

                  {/* Notes internes */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Notes internes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Instructions particulières pour le fournisseur…"
                      rows={2}
                      className="rounded-xl"
                    />
                  </div>

                  {/* RÉCAPITULATIF LIVE */}
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
                            <CatIcon className="h-3.5 w-3.5 text-orange-600" />
                            {categorieChoisie.label}
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
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Code lot prévu</div>
                          <div className="font-mono text-xs font-semibold text-slate-700 mt-0.5 truncate">{codePreview}</div>
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

                      <div className="pt-2 border-t border-amber-300/50 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Truck className="h-3 w-3" />
                          Délai estimé : <span className="font-semibold text-slate-900 ml-1">{delaiEstime}</span>
                        </div>
                        {form.priority === "urgent" && (
                          <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1 text-[10px]">
                            <Zap className="h-3 w-3" /> Urgent
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setOpenGen(false)}>Annuler</Button>
                  <Button
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md"
                    disabled={!peutGenerer}
                    onClick={() => generate.mutate({
                      quantity: form.quantity,
                      regionId: form.regionId,
                      category: form.category,
                      supplier: form.supplier || null,
                      unitPriceGnf: form.unitPriceGnf ? Number(form.unitPriceGnf) : null,
                    })}
                  >
                    <Zap className="h-4 w-4 mr-1.5" />
                    Générer {form.quantity} balise{form.quantity > 1 ? "s" : ""}
                    <ArrowRight className="h-4 w-4 ml-1.5" />
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
