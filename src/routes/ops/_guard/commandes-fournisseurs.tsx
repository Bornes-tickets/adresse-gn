import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package, Plus, Search, RefreshCw, Sparkles, User, Zap, FileText, FileArchive,
  Info, AlertTriangle, TrendingUp, MapPin, Home, ShieldCheck, Building2, Briefcase,
  Wifi, Truck, Calculator, ArrowRight, Send, Factory, CheckCircle2, PackageCheck,
  Clock, Eye, MoreVertical, MessageSquare, Download, Filter, X, ArrowUp, ArrowDown,
  ArrowUpDown, Rows, Rows3, DollarSign, Timer, Copy, Printer, Ban, TrendingDown,
  MessageCircle, Phone, Mail, ClipboardCheck, PackageX, PackageMinus, History,
  ChevronDown, ChevronRight, Receipt,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeFr } from "@/lib/admin";
import {
  opsLots, opsGenerateLot, opsExportQrPdf, opsExportQrZip, opsRegions, opsFournisseurs,
  opsUpdateLotStatus, opsLotDetail,
  opsGeneratePO, opsPurchaseOrder, opsGeneratePOPdf,
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
  { code: "draft", label: "Brouillon", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: FileText, next: "sent", nextLabel: "Envoyer" },
  { code: "sent", label: "Envoyée", cls: "bg-sky-100 text-sky-700 border-sky-200", icon: Send, next: "in_production", nextLabel: "En production" },
  { code: "in_production", label: "En production", cls: "bg-violet-100 text-violet-700 border-violet-200", icon: Factory, next: "shipped", nextLabel: "Expédiée" },
  { code: "shipped", label: "Expédiée", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: Truck, next: "received", nextLabel: "Réceptionner" },
  { code: "received", label: "Reçue", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: PackageCheck, next: "distributed", nextLabel: "Distribuer" },
  { code: "distributed", label: "Distribuée", cls: "bg-teal-100 text-teal-700 border-teal-200", icon: Zap, next: null, nextLabel: null },
];

const PRESETS_QTE = [10, 25, 50, 100, 200, 500];
type SortKey = "code" | "quantity" | "supplier" | "received_at" | "status";
type SortDir = "asc" | "desc";

function formatMontant(m: number | null): string {
  if (m == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(m) + " GNF";
}

function statutInfo(code: string) {
  return PIPELINE.find((s) => s.code === code) ?? { code, label: code, cls: "bg-slate-100 text-slate-700 border-slate-200", icon: Package, next: null, nextLabel: null };
}

function ageDays(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
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
  const generatePoFn = useServerFn(opsGeneratePO);
  const loadPoFn = useServerFn(opsPurchaseOrder);
  const pdfPoFn = useServerFn(opsGeneratePOPdf);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [statutFilter, setStatutFilter] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d" | "late">("all");
  const [sortKey, setSortKey] = useState<SortKey>("received_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [density, setDensity] = useState<"compact" | "confortable">("confortable");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGen, setOpenGen] = useState(false);
  const [detailLotId, setDetailLotId] = useState<string | null>(null);
  const [receptionDialog, setReceptionDialog] = useState<any | null>(null);
  const [receptionForm, setReceptionForm] = useState({ quantity_received: 0, qc_passed: true, defects: "", notes: "" });
  const [confirmNext, setConfirmNext] = useState<{ id: string; from: string; to: string } | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [form, setForm] = useState({
    quantity: 50, regionId: "", category: "residential",
    supplier: "", unitPriceGnf: "",
    priority: "normal" as "normal" | "urgent",
    notes: "", expectedDelivery: "",
  });

  const lots = useQuery({ queryKey: ["ops", "lots"], queryFn: () => listerFn() });
  const regions = useQuery({ queryKey: ["ops", "regions"], queryFn: () => regionsFn(), enabled: openGen });
  const fournisseurs = useQuery({ queryKey: ["ops", "fournisseurs"], queryFn: () => fournisseursFn() });
  const detail = useQuery({
    queryKey: ["ops", "lot-detail", detailLotId],
    queryFn: () => detailFn({ data: { lotId: detailLotId! } }),
    enabled: !!detailLotId,
  });
  const poQuery = useQuery({
    queryKey: ["ops", "po", detailLotId],
    queryFn: () => loadPoFn({ data: { lotId: detailLotId! } }),
    enabled: !!detailLotId,
  });
  useRealtimeInvalidate({ table: "lots", invalidate: [["ops", "lots"]] });

  const generate = useMutation({
    mutationFn: (v: any) => generateFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Commande ${r.lotCode} créée : ${r.quantite} balises (${r.premier} → ${r.dernier}).`);
      qc.invalidateQueries({ queryKey: ["ops", "lots"] });
      setOpenGen(false);
      setForm({ quantity: 50, regionId: "", category: "residential", supplier: "", unitPriceGnf: "", priority: "normal", notes: "", expectedDelivery: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (v: { lotId: string; statut: string; notes?: string | null }) => updateStatusFn({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["ops", "lots"] });
      qc.invalidateQueries({ queryKey: ["ops", "lot-detail"] });
      setConfirmNext(null); setConfirmNotes("");
      setReceptionDialog(null);
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

  const generatePo = useMutation({
    mutationFn: (lotId: string) => generatePoFn({ data: { lotId } }),
    onSuccess: (r: any) => {
      toast.success(`Bon de commande ${r.po_number} généré.`);
      qc.invalidateQueries({ queryKey: ["ops", "po"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pdfPo = useMutation({
    mutationFn: (poId: string) => pdfPoFn({ data: { poId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${r.po_number}.pdf`; a.click();
      toast.success("PDF téléchargé.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (lots.data ?? []) as any[];

  function isRetard(l: any): boolean {
    if (!["sent", "in_production", "shipped"].includes(l.status)) return false;
    if (l.expected_delivery && new Date(l.expected_delivery).getTime() < Date.now()) return true;
    if (l.sent_at && ageDays(l.sent_at) > 14 && l.status !== "received") return true;
    return false;
  }

  const changerStatutDepuisDetail = (lot: any, toStatus: string) => {
    setDetailLotId(null);
    if (toStatus === "received") {
      setReceptionDialog(lot);
      setReceptionForm({ quantity_received: lot.quantity, qc_passed: true, defects: "", notes: "" });
    } else {
      setConfirmNext({ id: lot.id, from: lot.status, to: toStatus });
      setConfirmNotes("");
    }
  };

  const filtered = useMemo(() => {
    let r = rows;
    if (statutFilter) r = r.filter((l) => l.status === statutFilter);
    if (supplierFilter !== "all") r = r.filter((l) => l.supplier === supplierFilter);
    if (categoryFilter !== "all") r = r.filter((l) => l.category === categoryFilter);
    if (priorityFilter !== "all") r = r.filter((l) => (l.priority ?? "normal") === priorityFilter);
    if (dateRange === "late") r = r.filter(isRetard);
    else if (dateRange !== "all") {
      const now = Date.now();
      const cutoff = dateRange === "today" ? new Date(new Date().setHours(0,0,0,0)).getTime()
        : dateRange === "7d" ? now - 7 * 864e5 : now - 30 * 864e5;
      r = r.filter((l) => l.received_at && new Date(l.received_at).getTime() >= cutoff);
    }
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter((l) => (l.code ?? "").toLowerCase().includes(t) || (l.supplier ?? "").toLowerCase().includes(t));
    }
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? "";
      if (sortKey === "quantity") return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, statutFilter, supplierFilter, categoryFilter, priorityFilter, dateRange, q, sortKey, sortDir]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalValeur = 0, totalQuantite = 0, delaisSommes = 0, delaisCount = 0, retards = 0;
    for (const l of rows) {
      counts[l.status] = (counts[l.status] ?? 0) + 1;
      totalQuantite += Number(l.quantity ?? 0);
      if (l.sent_at && l.received_at) {
        const j = Math.floor((new Date(l.received_at).getTime() - new Date(l.sent_at).getTime()) / 864e5);
        if (j >= 0) { delaisSommes += j; delaisCount += 1; }
      }
      if (isRetard(l)) retards += 1;
    }
    const enCours = (counts.sent ?? 0) + (counts.in_production ?? 0) + (counts.shipped ?? 0);
    return {
      counts, totalValeur, totalQuantite, enCours, retards,
      delaiMoyen: delaisCount > 0 ? Math.round(delaisSommes / delaisCount) : null,
    };
  }, [rows]);

  const csvUrl = useMemo(() => {
    if (!filtered.length) return null;
    const header = "code,categorie,quantite,fournisseur,statut,priorite,envoyee,recue,notes\n";
    const lines = filtered.map((l: any) => [
      l.code, CATEGORIES.find((c) => c.code === l.category)?.label ?? l.category ?? "",
      l.quantity, l.supplier ?? "", l.status, l.priority ?? "normal",
      l.sent_at ?? "", l.received_at ?? "", l.notes ?? "",
    ].map((v) => { const s = String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
    return URL.createObjectURL(new Blob([header + lines], { type: "text/csv;charset=utf-8" }));
  }, [filtered]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const toggleAll = () => {
    const ids = filtered.map((l: any) => l.id);
    if (ids.every((id: string) => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(ids));
  };

  const activeFilters = [
    q.trim() && { key: "q", label: `"${q}"`, clear: () => setQ("") },
    statutFilter && { key: "s", label: `Statut : ${statutInfo(statutFilter).label}`, clear: () => setStatutFilter(null) },
    supplierFilter !== "all" && { key: "sup", label: `Fournisseur : ${supplierFilter}`, clear: () => setSupplierFilter("all") },
    categoryFilter !== "all" && { key: "cat", label: `Catégorie : ${CATEGORIES.find((c) => c.code === categoryFilter)?.label}`, clear: () => setCategoryFilter("all") },
    priorityFilter !== "all" && { key: "pri", label: `Priorité : ${priorityFilter}`, clear: () => setPriorityFilter("all") },
    dateRange !== "all" && { key: "dt", label: `Période : ${dateRange === "late" ? "Retards" : dateRange}`, clear: () => setDateRange("all") },
  ].filter(Boolean) as any[];

  const categorieChoisie = CATEGORIES.find((c) => c.code === form.category)!;
  const CatIcon = categorieChoisie.icon;
  const regionChoisie = regions.data?.find((r: any) => r.id === form.regionId);
  const prixUnitaire = form.unitPriceGnf ? Number(form.unitPriceGnf) : categorieChoisie.tarif;
  const total = prixUnitaire != null ? prixUnitaire * form.quantity : null;
  const prefixBalise = regionChoisie ? `GN-${regionChoisie.code.toUpperCase().slice(0, 3)}-` : "—";
  const delaiEstime = form.quantity <= 50 ? "24-48h" : form.quantity <= 200 ? "2-4 jours" : form.quantity <= 500 ? "5-7 jours" : "1-2 semaines";
  const peutGenerer = form.regionId && form.quantity >= 1 && form.quantity <= 1000 && !generate.isPending;
  const pad = density === "compact" ? "p-2" : "p-3";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
              <Package className="h-3.5 w-3.5" /> Achats · Approvisionnement
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-[10px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" /> LIVE
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-bold">Commandes fournisseurs</h1>
            <p className="mt-1 text-sm text-white/80">Pipeline complet : brouillon → envoyée → production → réception → distribution</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20" onClick={() => qc.invalidateQueries({ queryKey: ["ops", "lots"] })}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Rafraîchir
            </Button>
            {csvUrl && (
              <a href={csvUrl} download={`commandes_${new Date().toISOString().slice(0,10)}.csv`}>
                <Button variant="secondary" className="bg-white/15 hover:bg-white/25 text-white border-white/20">
                  <Download className="h-4 w-4 mr-1.5" />Export CSV
                </Button>
              </a>
            )}
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
                        const Ic = c.icon; const sel = form.category === c.code;
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
                    <Input type="number" min={1} max={1000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="h-11 font-mono text-lg text-center" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Prix unitaire (GNF)</Label>
                      <Input type="number" value={form.unitPriceGnf} onChange={(e) => setForm({ ...form, unitPriceGnf: e.target.value })}
                        placeholder={categorieChoisie.tarif != null ? String(categorieChoisie.tarif) : "0"} className="h-11 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Fournisseur</Label>
                      <Input list="fournisseurs-liste" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Nom du fournisseur" className="h-11" />
                      <datalist id="fournisseurs-liste">{(fournisseurs.data ?? []).map((f: string) => <option key={f} value={f} />)}</datalist>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 block">Priorité</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setForm({ ...form, priority: "normal" })}
                          className={cn("p-2 rounded-lg border-2 text-left text-xs",
                            form.priority === "normal" ? "border-slate-800 bg-slate-50 shadow" : "border-slate-200")}>
                          Standard
                        </button>
                        <button type="button" onClick={() => setForm({ ...form, priority: "urgent" })}
                          className={cn("p-2 rounded-lg border-2 text-left text-xs",
                            form.priority === "urgent" ? "border-rose-500 bg-rose-50 shadow text-rose-700 font-bold" : "border-slate-200")}>
                          <Zap className="h-3 w-3 inline mr-1" />Urgent
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Livraison prévue</Label>
                      <Input type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} className="h-11" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Notes pour le fournisseur</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Instructions particulières…" rows={2} className="rounded-xl" />
                  </div>
                  <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-orange-600" /><span className="text-xs font-bold uppercase tracking-wider text-orange-800">Récapitulatif</span></div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Catégorie</div><div className="flex items-center gap-1 mt-0.5 font-semibold"><CatIcon className="h-3.5 w-3.5 text-orange-600" />{categorieChoisie.label}</div></div>
                        <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Région</div><div className="font-semibold mt-0.5">{regionChoisie?.name ?? "—"}</div></div>
                        <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Quantité</div><div className="font-mono text-lg font-bold mt-0.5">{form.quantity}</div></div>
                        <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Délai estimé</div><div className="font-semibold mt-0.5">{delaiEstime}</div></div>
                      </div>
                      <div className="pt-3 border-t border-amber-300/50 space-y-2">
                        <div className="flex items-center justify-between"><span className="text-sm">Prix unitaire</span><span className="font-mono font-semibold">{formatMontant(prixUnitaire)}</span></div>
                        <div className="flex items-center justify-between text-lg"><span className="font-bold">Total estimé</span><span className="font-mono font-bold text-orange-700">{formatMontant(total)}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setOpenGen(false)}>Annuler</Button>
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md" disabled={!peutGenerer}
                    onClick={() => generate.mutate({ quantity: form.quantity, regionId: form.regionId, category: form.category, supplier: form.supplier || null, unitPriceGnf: form.unitPriceGnf ? Number(form.unitPriceGnf) : null })}>
                    <Zap className="h-4 w-4 mr-1.5" />Créer la commande<ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Total commandes" value={rows.length} icon={Package} tone="amber" />
        <Kpi label="En cours fournisseur" value={stats.enCours} icon={Factory} tone="violet" />
        <Kpi label="Quantité totale" value={stats.totalQuantite} icon={PackageCheck} tone="emerald" />
        <Kpi label="Délai moyen" value={stats.delaiMoyen ?? 0} suffix={stats.delaiMoyen != null ? " j" : ""} icon={Timer} tone="sky" />
        <button onClick={() => setDateRange(dateRange === "late" ? "all" : "late")} className="text-left">
          <Card className={cn("border transition hover:shadow-md", stats.retards > 0 ? "border-rose-300 bg-gradient-to-br from-rose-50 to-red-50" : "border-slate-200")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-rose-700">Livraisons en retard</div>
                <div className={cn("text-2xl font-bold mt-1", stats.retards > 0 ? "text-rose-700" : "text-slate-400")}>{stats.retards}</div>
              </div>
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow", stats.retards > 0 ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-400")}>
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {stats.retards > 0 && dateRange !== "late" && (
        <Card className="border-rose-300 bg-gradient-to-br from-rose-50 to-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow animate-pulse"><AlertTriangle className="h-5 w-5" /></div>
            <div className="flex-1">
              <div className="font-semibold text-rose-900">{stats.retards} livraison{stats.retards > 1 ? "s" : ""} en retard</div>
              <div className="text-xs text-rose-700 mt-0.5">Vérifiez les commandes envoyées ou expédiées &gt; 14 jours ou passées de la date prévue.</div>
            </div>
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setDateRange("late")}>
              <Eye className="h-4 w-4 mr-1" />Voir
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatutFilter(null)}
          className={cn("px-3 py-1.5 text-xs rounded-full border font-semibold transition",
            !statutFilter ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600")}>
          Toutes ({rows.length})
        </button>
        {PIPELINE.map((s) => {
          const Ic = s.icon; const n = stats.counts[s.code] ?? 0;
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
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Code ou fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="Fournisseur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous fournisseurs</SelectItem>
                {(fournisseurs.data ?? []).map((f: string) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full lg:w-36"><SelectValue placeholder="Priorité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="normal">Standard</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[10px] uppercase text-slate-500 font-semibold mr-1">Période :</span>
            {(["all", "today", "7d", "30d"] as const).map((p) => (
              <button key={p} onClick={() => setDateRange(p)}
                className={cn("px-2.5 py-1 text-[11px] rounded-full border font-medium transition",
                  dateRange === p ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400")}>
                {p === "all" ? "Toutes" : p === "today" ? "Aujourd'hui" : p === "7d" ? "7 jours" : "30 jours"}
              </button>
            ))}
          </div>
          {activeFilters.length > 0 && (
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Filtres actifs</span>
              {activeFilters.map((f: any) => (
                <button key={f.key} onClick={f.clear}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs text-orange-700 hover:bg-orange-100 transition">
                  {f.label} <X className="h-3 w-3" />
                </button>
              ))}
              <button onClick={() => { setQ(""); setStatutFilter(null); setSupplierFilter("all"); setCategoryFilter("all"); setPriorityFilter("all"); setDateRange("all"); }}
                className="text-xs text-slate-500 hover:text-slate-900 underline ml-2">Tout effacer</button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs">
        <div className="text-slate-500">
          {filtered.length} commande{filtered.length > 1 ? "s" : ""} · trié par <span className="font-semibold">{sortKey}</span> {sortDir === "asc" ? "↑" : "↓"}
          {selected.size > 0 && <span className="ml-3 font-semibold text-orange-700">· {selected.size} sélectionnée(s)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDensity("compact")} className={cn("p-1 rounded transition", density === "compact" ? "bg-orange-100 text-orange-700" : "text-slate-400 hover:bg-slate-100")}>
            <Rows className="h-4 w-4" />
          </button>
          <button onClick={() => setDensity("confortable")} className={cn("p-1 rounded transition", density === "confortable" ? "bg-orange-100 text-orange-700" : "text-slate-400 hover:bg-slate-100")}>
            <Rows3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {lots.isLoading ? <div className="p-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div>
          : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold">Aucune commande</h3>
              <p className="text-sm text-slate-600 mt-1">Aucune commande fournisseur ne correspond aux filtres.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b">
                  <tr>
                    <th className="w-10 p-2">
                      <Checkbox checked={filtered.every((l: any) => selected.has(l.id)) && filtered.length > 0} onCheckedChange={toggleAll} />
                    </th>
                    <SortTh label="Code" k="code" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="text-left p-3 font-semibold">Catégorie</th>
                    <SortTh label="Qté" k="quantity" cur={sortKey} dir={sortDir} onClick={toggleSort} className="text-right" />
                    <SortTh label="Fournisseur" k="supplier" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="text-left p-3 font-semibold">Pipeline</th>
                    <SortTh label="Reçu" k="received_at" cur={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="text-left p-3 font-semibold">Alertes</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l: any) => {
                    const st = statutInfo(l.status);
                    const StIcon = st.icon;
                    const stepIndex = PIPELINE.findIndex((s) => s.code === l.status);
                    const retard = isRetard(l);
                    const urgent = l.priority === "urgent";
                    return (
                      <tr key={l.id} className={cn("border-t border-slate-100 hover:bg-amber-50/30 transition group", selected.has(l.id) && "bg-amber-50")}>
                        <td className={pad}>
                          <Checkbox checked={selected.has(l.id)} onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(l.id); else next.delete(l.id);
                            setSelected(next);
                          }} />
                        </td>
                        <td className={pad}>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-orange-600" />
                            </div>
                            <span className="font-mono text-xs font-bold">{l.code}</span>
                          </div>
                        </td>
                        <td className={pad}><Badge variant="outline" className="text-[10px]">{CATEGORIES.find((c) => c.code === l.category)?.label ?? l.category ?? "—"}</Badge></td>
                        <td className={cn(pad, "text-right font-semibold")}>{l.quantity}</td>
                        <td className={pad}>
                          <div className="text-sm">{l.supplier ?? <span className="text-slate-400 italic">—</span>}</div>
                        </td>
                        <td className={pad}>
                          <div className="flex items-center gap-0.5 w-32">
                            {PIPELINE.map((s, i) => {
                              const done = i <= stepIndex;
                              const active = i === stepIndex;
                              return (
                                <div key={s.code} className="flex-1 flex items-center" title={s.label}>
                                  <div className={cn("h-1.5 w-full rounded-full",
                                    active ? "bg-orange-500" : done ? "bg-emerald-500" : "bg-slate-200")} />
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-1"><Badge className={cn("gap-1 text-[10px]", st.cls)}><StIcon className="h-2.5 w-2.5" />{st.label}</Badge></div>
                        </td>
                        <td className={cn(pad, "text-xs text-slate-500")}>{l.received_at ? formatDateTimeFr(l.received_at) : "—"}</td>
                        <td className={pad}>
                          <div className="flex gap-1 flex-wrap">
                            {urgent && <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-0.5 text-[10px]"><Zap className="h-2.5 w-2.5" />Urgent</Badge>}
                            {retard && <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-0.5 text-[10px]"><Timer className="h-2.5 w-2.5" />Retard</Badge>}
                          </div>
                        </td>
                        <td className={pad}>
                          <div className="flex gap-1 justify-end">
                            {st.next && (
                              <Button size="sm" className="h-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                                onClick={() => {
                                  if (st.next === "received") {
                                    setReceptionDialog(l);
                                    setReceptionForm({ quantity_received: l.quantity, qc_passed: true, defects: "", notes: "" });
                                  } else {
                                    setConfirmNext({ id: l.id, from: l.status, to: st.next! });
                                    setConfirmNotes("");
                                  }
                                }}>
                                <ArrowRight className="h-3.5 w-3.5 mr-1" />{st.nextLabel}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setDetailLotId(l.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Exports QR</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => exportPdf.mutate(l.id)}><FileText className="h-4 w-4 mr-2" />PDF QR (A4)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportZip.mutate(l.id)}><FileArchive className="h-4 w-4 mr-2" />ZIP PNG (600 DPI)</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Communication</DropdownMenuLabel>
                                {l.supplier && (
                                  <DropdownMenuItem onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Commande ${l.code}`)}`, "_blank")}>
                                    <Mail className="h-4 w-4 mr-2" />Contacter par email
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(l.code); toast.success("Code copié."); }}>
                                  <Copy className="h-4 w-4 mr-2" />Copier le code
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.print()}>
                                  <Printer className="h-4 w-4 mr-2" />Imprimer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDetailLotId(l.id)}>
                                  <History className="h-4 w-4 mr-2" />Voir la timeline
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setForm({ quantity: l.quantity, regionId: "", category: l.category ?? "residential", supplier: l.supplier ?? "", unitPriceGnf: "", priority: l.priority ?? "normal", notes: "", expectedDelivery: "" });
                                  setOpenGen(true);
                                }}>
                                  <Copy className="h-4 w-4 mr-2" />Dupliquer
                                </DropdownMenuItem>
                                {l.status !== "distributed" && l.status !== "draft" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-rose-600" onClick={() => { setConfirmNext({ id: l.id, from: l.status, to: "draft" }); setConfirmNotes("Annulation"); }}>
                                      <Ban className="h-4 w-4 mr-2" />Annuler la commande
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      <Dialog open={confirmNext !== null} onOpenChange={(o) => !o && setConfirmNext(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-emerald-600" />
              {statutInfo(confirmNext?.to ?? "").label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
              <strong>{statutInfo(confirmNext?.from ?? "").label}</strong> → <strong>{statutInfo(confirmNext?.to ?? "").label}</strong>
            </div>
            <div>
              <Label className="text-xs">Note (optionnelle)</Label>
              <Textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} rows={3} placeholder="Contexte, référence, motif…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNext(null)}>Annuler</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              onClick={() => confirmNext && updateStatus.mutate({ lotId: confirmNext.id, statut: confirmNext.to, notes: confirmNotes.trim() || null })}
              disabled={updateStatus.isPending}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receptionDialog !== null} onOpenChange={(o) => !o && setReceptionDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              Réception & contrôle qualité
            </DialogTitle>
          </DialogHeader>
          {receptionDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-mono font-bold">{receptionDialog.code}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Commande de <strong>{receptionDialog.quantity}</strong> balises · {receptionDialog.supplier ?? "Fournisseur inconnu"}
                </div>
              </div>
              <div>
                <Label className="text-xs">Quantité réellement reçue *</Label>
                <Input type="number" min={0} max={receptionDialog.quantity * 2}
                  value={receptionForm.quantity_received}
                  onChange={(e) => setReceptionForm({ ...receptionForm, quantity_received: Number(e.target.value) })}
                  className="h-11 font-mono text-lg text-center mt-1" />
                {receptionForm.quantity_received !== receptionDialog.quantity && (
                  <div className={cn("mt-1 text-xs font-semibold", receptionForm.quantity_received < receptionDialog.quantity ? "text-rose-600" : "text-amber-600")}>
                    {receptionForm.quantity_received < receptionDialog.quantity
                      ? `⚠️ Manque ${receptionDialog.quantity - receptionForm.quantity_received} balise(s)`
                      : `⚠️ Surplus de ${receptionForm.quantity_received - receptionDialog.quantity} balise(s)`}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs mb-2 block">Contrôle qualité *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setReceptionForm({ ...receptionForm, qc_passed: true })}
                    className={cn("p-3 rounded-xl border-2 text-left",
                      receptionForm.qc_passed ? "border-emerald-500 bg-emerald-50 shadow" : "border-slate-200")}>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
                    <div className="text-sm font-bold">Conforme</div>
                    <div className="text-[10px] text-slate-500">Aucun défaut majeur</div>
                  </button>
                  <button type="button" onClick={() => setReceptionForm({ ...receptionForm, qc_passed: false })}
                    className={cn("p-3 rounded-xl border-2 text-left",
                      !receptionForm.qc_passed ? "border-rose-500 bg-rose-50 shadow" : "border-slate-200")}>
                    <PackageX className="h-5 w-5 text-rose-600 mb-1" />
                    <div className="text-sm font-bold">Défauts</div>
                    <div className="text-[10px] text-slate-500">Retour ou signalement</div>
                  </button>
                </div>
              </div>
              {!receptionForm.qc_passed && (
                <div>
                  <Label className="text-xs">Description des défauts</Label>
                  <Textarea value={receptionForm.defects} onChange={(e) => setReceptionForm({ ...receptionForm, defects: e.target.value })}
                    placeholder="Ex : 5 plaques cassées, QR illisibles sur 3 pièces…" rows={3} />
                </div>
              )}
              <div>
                <Label className="text-xs">Notes de réception</Label>
                <Textarea value={receptionForm.notes} onChange={(e) => setReceptionForm({ ...receptionForm, notes: e.target.value })}
                  placeholder="Bordereau, livreur, conditions de livraison…" rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceptionDialog(null)}>Annuler</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              onClick={() => {
                if (!receptionDialog) return;
                const notes = [
                  `Reçu ${receptionForm.quantity_received}/${receptionDialog.quantity}`,
                  receptionForm.qc_passed ? "QC OK" : "QC : défauts signalés",
                  receptionForm.defects && `Défauts : ${receptionForm.defects}`,
                  receptionForm.notes,
                ].filter(Boolean).join(" · ");
                updateStatus.mutate({ lotId: receptionDialog.id, statut: "received", notes });
              }}
              disabled={updateStatus.isPending}>
              <PackageCheck className="h-4 w-4 mr-1.5" />Valider la réception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailLotId !== null} onOpenChange={(o) => !o && setDetailLotId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div className="font-mono text-lg font-bold">{detail.data?.lot.code ?? "…"}</div>
                {detail.data?.lot && (
                  <div className="text-xs font-normal text-slate-500 mt-0.5">
                    {detail.data.lot.quantity} balises · {CATEGORIES.find((c) => c.code === detail.data.lot.category)?.label ?? detail.data.lot.category}
                  </div>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="py-16 text-center"><div className="inline-block h-8 w-8 border-2 border-slate-300 border-t-amber-600 rounded-full animate-spin" /></div>
          ) : detail.data && (
            <Tabs defaultValue="general">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="livraison">Livraison</TabsTrigger>
                <TabsTrigger value="bc" className="gap-1"><Receipt className="h-3.5 w-3.5" />BC</TabsTrigger>
                <TabsTrigger value="historique">Historique</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 pt-4">
                <Card className="border-slate-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Statut actuel</div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn("gap-1", statutInfo(detail.data.lot.status).cls)}>
                        {(() => { const S = statutInfo(detail.data.lot.status).icon; return <S className="h-3 w-3" />; })()}
                        {statutInfo(detail.data.lot.status).label}
                      </Badge>
                      {detail.data.lot.priority === "urgent" && (
                        <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1">
                          <Zap className="h-3 w-3" />Urgent
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 gap-3">
                  <InfoBloc label="Quantité commandée" value={String(detail.data.lot.quantity)} icon={Package} />
                  <InfoBloc label="Catégorie" value={CATEGORIES.find((c) => c.code === detail.data.lot.category)?.label ?? "—"} icon={Sparkles} />
                  <InfoBloc label="Fournisseur" value={detail.data.lot.supplier ?? "—"} icon={Truck} />
                  <InfoBloc label="Prix unitaire" value="—" icon={DollarSign} />
                </div>
                {detail.data.lot.notes && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1">Notes</div>
                      <div className="text-sm italic">{detail.data.lot.notes}</div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="livraison" className="space-y-4 pt-4">
                {statutInfo(detail.data.lot.status).next && (
                  <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
                    <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
                          {(() => {
                            const nextInfo = statutInfo(statutInfo(detail.data.lot.status).next!);
                            const NextIcon = nextInfo.icon;
                            return <NextIcon className="h-5 w-5" />;
                          })()}
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Prochaine étape</div>
                          <div className="text-sm font-bold text-slate-900">
                            Passer à « {statutInfo(statutInfo(detail.data.lot.status).next!).label} »
                          </div>
                        </div>
                      </div>
                      <Button
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
                        onClick={() => changerStatutDepuisDetail(detail.data.lot, statutInfo(detail.data.lot.status).next!)}
                      >
                        <ArrowRight className="h-4 w-4 mr-1.5" />
                        {statutInfo(detail.data.lot.status).nextLabel}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <InfoBloc label="Envoyée au fournisseur" value={formatDateTimeFr(detail.data.lot.sent_at)} icon={Send} tone="sky" />
                  <InfoBloc label="Livraison prévue" value={detail.data.lot.expected_delivery ? new Date(detail.data.lot.expected_delivery).toLocaleDateString("fr-FR") : "—"} icon={Timer} tone="amber" />
                  <InfoBloc label="Reçue au stock" value={formatDateTimeFr(detail.data.lot.received_at)} icon={PackageCheck} tone="emerald" />
                  <InfoBloc label="QC" value={detail.data.lot.qc_passed === true ? "Conforme" : detail.data.lot.qc_passed === false ? "Défauts" : "En attente"} icon={ClipboardCheck} tone={detail.data.lot.qc_passed === false ? "rose" : "emerald"} />
                </div>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progression pipeline</div>
                      <div className="text-[10px] text-slate-400">Cliquez une étape pour y sauter</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {PIPELINE.map((s, i) => {
                        const idx = PIPELINE.findIndex((x) => x.code === detail.data.lot.status);
                        const done = i <= idx;
                        const active = i === idx;
                        const clickable = i !== idx;
                        const Ic = s.icon;
                        return (
                          <div key={s.code} className="flex-1 flex items-center">
                            <button
                              type="button"
                              disabled={!clickable}
                              onClick={() => clickable && changerStatutDepuisDetail(detail.data.lot, s.code)}
                              title={clickable ? `Passer à « ${s.label} »` : "Statut actuel"}
                              className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                                active ? cn(s.cls, "ring-2 ring-offset-1 shadow scale-110")
                                  : done ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-110"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600",
                                clickable && "cursor-pointer",
                                !clickable && "cursor-default",
                              )}
                            >
                              <Ic className="h-3.5 w-3.5" />
                            </button>
                            {i < PIPELINE.length - 1 && (
                              <div className={cn("flex-1 h-0.5 mx-0.5", done && i < idx ? "bg-emerald-500" : "bg-slate-200")} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 mt-1.5">
                      {PIPELINE.map((s) => <span key={s.code} className="flex-1 text-center truncate">{s.label}</span>)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Changer manuellement le statut</div>
                    <div className="flex gap-2 flex-wrap">
                      {PIPELINE.filter((s) => s.code !== detail.data.lot.status).map((s) => {
                        const Ic = s.icon;
                        return (
                          <button
                            key={s.code}
                            onClick={() => changerStatutDepuisDetail(detail.data.lot, s.code)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition hover:opacity-80 hover:shadow-sm",
                              s.cls,
                            )}
                          >
                            <Ic className="h-3 w-3" />
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ONGLET BC — Bon de commande */}
              <TabsContent value="bc" className="space-y-4 pt-4">
                {poQuery.isLoading ? (
                  <div className="py-8 text-center"><div className="inline-block h-6 w-6 border-2 border-slate-300 border-t-orange-600 rounded-full animate-spin" /></div>
                ) : !poQuery.data ? (
                  <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-amber-100">
                        <Receipt className="h-8 w-8 text-orange-600" />
                      </div>
                      <h3 className="text-lg font-semibold">Aucun bon de commande</h3>
                      <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto mb-4">
                        Générez un bon de commande officiel pour cette commande. Il sera envoyé au fournisseur au format PDF.
                      </p>
                      <Button
                        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md"
                        onClick={() => detail.data && generatePo.mutate(detail.data.lot.id)}
                        disabled={generatePo.isPending}
                      >
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        Générer le bon de commande
                      </Button>
                    </CardContent>
                  </Card>
                ) : (() => {
                  const poData: any = poQuery.data;
                  const po = poData.po ?? poData;
                  const lines = poData.lines ?? [];
                  const supplier = po.supplier_snapshot ?? { name: "Fournisseur inconnu" };
                  return (
                    <div className="space-y-4">
                      <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-600" />
                        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
                              <Receipt className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-widest text-orange-700 font-semibold">Numéro de bon de commande</div>
                              <div className="font-mono text-lg font-bold text-slate-900">{po.po_number}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={cn("gap-1",
                              po.status === "sent" ? "bg-sky-100 text-sky-700" :
                              po.status === "acknowledged" ? "bg-emerald-100 text-emerald-700" :
                              po.status === "cancelled" ? "bg-rose-100 text-rose-700" :
                              "bg-slate-100 text-slate-700")}>
                              {po.status === "draft" ? "Brouillon" :
                                po.status === "sent" ? "Envoyé" :
                                po.status === "acknowledged" ? "Accusé réception" : "Annulé"}
                            </Badge>
                            <Button
                              className="bg-orange-600 hover:bg-orange-700 text-white"
                              onClick={() => pdfPo.mutate(po.id)}
                              disabled={pdfPo.isPending}
                            >
                              <Download className="h-4 w-4 mr-1.5" />
                              Télécharger PDF
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Fournisseur</div>
                          <div className="space-y-1 text-sm">
                            <div className="font-bold">{supplier.name ?? "—"}</div>
                            {supplier.contact_name && <div className="text-slate-600">À l'attention de {supplier.contact_name}</div>}
                            {supplier.email && <div className="text-slate-600 flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</div>}
                            {supplier.phone && <div className="text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</div>}
                            {supplier.address && <div className="text-slate-500 text-xs mt-1">{supplier.address}</div>}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-0">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-white text-xs">
                              <tr>
                                <th className="text-left p-3 font-semibold">Désignation</th>
                                <th className="text-right p-3 font-semibold">Qté</th>
                                <th className="text-right p-3 font-semibold">PU HT</th>
                                <th className="text-right p-3 font-semibold">Total HT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((l: any) => (
                                <tr key={l.id} className="border-t border-slate-100">
                                  <td className="p-3">
                                    <div className="font-medium">{l.designation}</div>
                                    {l.category && <div className="text-[10px] text-slate-500">{l.category}</div>}
                                  </td>
                                  <td className="p-3 text-right font-semibold">{l.quantity}</td>
                                  <td className="p-3 text-right font-mono">{formatMontant(l.unit_price_ht)}</td>
                                  <td className="p-3 text-right font-mono font-semibold">{formatMontant(l.line_total_ht)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 text-sm">
                              <tr>
                                <td colSpan={3} className="p-3 text-right text-slate-600">Total HT</td>
                                <td className="p-3 text-right font-mono font-semibold">{formatMontant(po.amount_ht)}</td>
                              </tr>
                              <tr>
                                <td colSpan={3} className="p-3 text-right text-slate-600">TVA {po.tva_rate}%</td>
                                <td className="p-3 text-right font-mono">{formatMontant(po.tva_amount)}</td>
                              </tr>
                              <tr className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                                <td colSpan={3} className="p-3 text-right font-bold">TOTAL TTC</td>
                                <td className="p-3 text-right font-mono font-bold text-lg">{formatMontant(po.amount_ttc)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-2 gap-3">
                        <InfoBloc label="Émis le" value={formatDateTimeFr(po.issued_at)} icon={Clock} />
                        <InfoBloc label="Conditions paiement" value={po.payment_terms ?? "—"} icon={DollarSign} />
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="historique" className="pt-4">
                {detail.data.events.length === 0 ? (
                  <div className="py-16 text-center">
                    <History className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">Aucun événement enregistré.</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {detail.data.events.map((e: any, i: number) => (
                      <div key={e.id} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow z-10">
                            {(() => { const S = statutInfo(e.event_type).icon; return <S className="h-4 w-4" />; })()}
                          </div>
                          {i < detail.data.events.length - 1 && <div className="w-0.5 h-16 bg-slate-200" />}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold">{statutInfo(e.event_type).label}</div>
                            <div className="text-[10px] text-slate-500">{formatDateTimeFr(e.event_at)}</div>
                          </div>
                          {e.notes && <div className="text-xs text-slate-700 mt-1 p-2 bg-slate-50 rounded border border-slate-100">{e.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== Sous-composants ==================== */

function Kpi({ label, value, icon: Icon, tone, suffix }: { label: string; value: number; icon: any; tone: string; suffix?: string }) {
  const tones: Record<string, string> = {
    amber: "from-amber-500 to-orange-500", violet: "from-violet-500 to-fuchsia-600",
    sky: "from-sky-500 to-blue-600", emerald: "from-emerald-500 to-teal-600", rose: "from-rose-500 to-pink-600",
  };
  return (
    <Card><CardContent className="p-4 flex items-center justify-between">
      <div><div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div><div className="text-2xl font-bold mt-1">{value.toLocaleString("fr-FR")}{suffix ?? ""}</div></div>
      <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow", tones[tone])}><Icon className="h-5 w-5" /></div>
    </CardContent></Card>
  );
}

function SortTh({ label, k, cur, dir, onClick, className }: { label: string; k: SortKey; cur: SortKey; dir: SortDir; onClick: (k: SortKey) => void; className?: string }) {
  const active = cur === k;
  return (
    <th className={cn("text-left p-3 font-semibold", className)}>
      <button onClick={() => onClick(k)} className="inline-flex items-center gap-1 hover:text-orange-600 transition">
        {label}
        {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </button>
    </th>
  );
}

function InfoBloc({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: string }) {
  const tones: Record<string, string> = {
    sky: "text-sky-600 bg-sky-50 border-sky-200", amber: "text-amber-600 bg-amber-50 border-amber-200",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-200", rose: "text-rose-600 bg-rose-50 border-rose-200",
  };
  return (
    <Card className={cn("border", tone && tones[tone])}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Icon className={cn("h-3.5 w-3.5", tone ? tones[tone].split(" ")[0] : "text-slate-500")} />
          <span className="uppercase tracking-widest font-semibold">{label}</span>
        </div>
        <div className="text-sm font-semibold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}
