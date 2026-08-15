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
  ChevronDown, ChevronRight, Receipt, PackagePlus, ClipboardList,
  Wallet, CreditCard, Banknote, Smartphone, FileCheck, XCircle,
  PlusCircle, GitCompare, ScrollText, Upload,
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
  opsGenerateDN, opsDeliveryNote, opsGenerateDNPdf,
  opsCreateInvoice, opsInvoice, opsRecordPayment, opsDeletePayment,
  opsMarkDispute, opsResolveDispute, opsReconciliation,
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

const RECEPTION_INIT = {
  quantity_received: 0, quantity_shipped: 0, qc_passed: true, defects: "", notes: "",
  carrier: "", tracking_number: "", shipped_at: "", receiver_name: "",
};

const INVOICE_INIT = {
  invoice_number: "", issued_at: new Date().toISOString().slice(0, 10),
  due_date: "", amount_ht: 0, tva_rate: 18, notes: "", pdf_base64: "", pdf_filename: "",
};

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
  const generateDnFn = useServerFn(opsGenerateDN);
  const loadDnFn = useServerFn(opsDeliveryNote);
  const pdfDnFn = useServerFn(opsGenerateDNPdf);
  const createInvoiceFn = useServerFn(opsCreateInvoice);
  const loadInvoiceFn = useServerFn(opsInvoice);
  const recordPaymentFn = useServerFn(opsRecordPayment);
  const deletePaymentFn = useServerFn(opsDeletePayment);
  const markDisputeFn = useServerFn(opsMarkDispute);
  const resolveDisputeFn = useServerFn(opsResolveDispute);
  const reconciliationFn = useServerFn(opsReconciliation);
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
  const [receptionForm, setReceptionForm] = useState(RECEPTION_INIT);
  const [confirmNext, setConfirmNext] = useState<{ id: string; from: string; to: string } | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(INVOICE_INIT);
  const [paymentDialog, setPaymentDialog] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0, method: "bank_transfer", paid_at: new Date().toISOString().slice(0, 10),
    reference: "", notes: "",
  });
  const [disputeDialog, setDisputeDialog] = useState<any>(null);
  const [disputeNotes, setDisputeNotes] = useState("");
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
  const dnQuery = useQuery({
    queryKey: ["ops", "dn", detailLotId],
    queryFn: () => loadDnFn({ data: { lotId: detailLotId! } }),
    enabled: !!detailLotId,
  });
  const invoiceQuery = useQuery({
    queryKey: ["ops", "invoice", detailLotId],
    queryFn: () => loadInvoiceFn({ data: { lotId: detailLotId! } }),
    enabled: !!detailLotId,
  });
  const reconQuery = useQuery({
    queryKey: ["ops", "recon", detailLotId],
    queryFn: () => reconciliationFn({ data: { lotId: detailLotId! } }),
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
      qc.invalidateQueries({ queryKey: ["ops", "recon"] });
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

  const generateDn = useMutation({
    mutationFn: (v: any) => generateDnFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`Bon de livraison ${r.dn_number} généré.`);
      qc.invalidateQueries({ queryKey: ["ops", "dn"] });
      qc.invalidateQueries({ queryKey: ["ops", "lots"] });
      qc.invalidateQueries({ queryKey: ["ops", "lot-detail"] });
      qc.invalidateQueries({ queryKey: ["ops", "recon"] });
      setReceptionDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pdfDn = useMutation({
    mutationFn: (dnId: string) => pdfDnFn({ data: { dnId } }),
    onSuccess: (r: any) => {
      const blob = new Blob([Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${r.dn_number}.pdf`; a.click();
      toast.success("BL téléchargé.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createInvoice = useMutation({
    mutationFn: (v: any) => createInvoiceFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`Facture ${r.internal_ref} enregistrée.`);
      qc.invalidateQueries({ queryKey: ["ops", "invoice"] });
      qc.invalidateQueries({ queryKey: ["ops", "recon"] });
      setInvoiceDialog(false);
      setInvoiceForm(INVOICE_INIT);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordPayment = useMutation({
    mutationFn: (v: any) => recordPaymentFn({ data: v }),
    onSuccess: () => {
      toast.success("Paiement enregistré.");
      qc.invalidateQueries({ queryKey: ["ops", "invoice"] });
      qc.invalidateQueries({ queryKey: ["ops", "recon"] });
      setPaymentDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePayment = useMutation({
    mutationFn: (paymentId: string) => deletePaymentFn({ data: { paymentId } }),
    onSuccess: () => {
      toast.success("Paiement supprimé.");
      qc.invalidateQueries({ queryKey: ["ops", "invoice"] });
      qc.invalidateQueries({ queryKey: ["ops", "recon"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markDispute = useMutation({
    mutationFn: (v: { invoiceId: string; notes: string }) => markDisputeFn({ data: v }),
    onSuccess: () => {
      toast.success("Litige signalé.");
      qc.invalidateQueries({ queryKey: ["ops", "invoice"] });
      setDisputeDialog(null); setDisputeNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveDispute = useMutation({
    mutationFn: (invoiceId: string) => resolveDisputeFn({ data: { invoiceId } }),
    onSuccess: () => {
      toast.success("Litige levé.");
      qc.invalidateQueries({ queryKey: ["ops", "invoice"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("PDF max 5 Mo."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      setInvoiceForm({ ...invoiceForm, pdf_base64: base64, pdf_filename: file.name });
    };
    reader.readAsDataURL(file);
  };

  const rows = (lots.data ?? []) as any[];

  function isRetard(l: any): boolean {
    if (!["sent", "in_production", "shipped"].includes(l.status)) return false;
    if (l.expected_delivery && new Date(l.expected_delivery).getTime() < Date.now()) return true;
    if (l.sent_at && ageDays(l.sent_at) > 14 && l.status !== "received") return true;
    return false;
  }

  const ouvrirReception = (lot: any) => {
    setReceptionDialog(lot);
    setReceptionForm({ ...RECEPTION_INIT, quantity_received: lot.quantity, quantity_shipped: lot.quantity });
  };

  const changerStatutDepuisDetail = (lot: any, toStatus: string) => {
    setDetailLotId(null);
    if (toStatus === "received") ouvrirReception(lot);
    else { setConfirmNext({ id: lot.id, from: lot.status, to: toStatus }); setConfirmNotes(""); }
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
                                  if (st.next === "received") ouvrirReception(l);
                                  else { setConfirmNext({ id: l.id, from: l.status, to: st.next! }); setConfirmNotes(""); }
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

      {/* DIALOG RÉCEPTION ENRICHI + création BL automatique */}
      <Dialog open={receptionDialog !== null} onOpenChange={(o) => !o && setReceptionDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
                <PackageCheck className="h-5 w-5" />
              </div>
              Réception & bon de livraison
            </DialogTitle>
          </DialogHeader>
          {receptionDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gradient-to-br from-slate-50 to-emerald-50 border border-emerald-200 p-3 text-sm">
                <div className="font-mono font-bold text-slate-900">{receptionDialog.code}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Commande de <strong>{receptionDialog.quantity}</strong> balises · {receptionDialog.supplier ?? "Fournisseur inconnu"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Transport
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Transporteur</Label>
                    <Input value={receptionForm.carrier} onChange={(e) => setReceptionForm({ ...receptionForm, carrier: e.target.value })}
                      placeholder="DHL, Chronopost, livreur…" className="h-10" />
                  </div>
                  <div>
                    <Label className="text-xs">N° de suivi</Label>
                    <Input value={receptionForm.tracking_number} onChange={(e) => setReceptionForm({ ...receptionForm, tracking_number: e.target.value })}
                      placeholder="Ex : 1Z999AA..." className="h-10 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs">Date d'expédition</Label>
                    <Input type="date" value={receptionForm.shipped_at} onChange={(e) => setReceptionForm({ ...receptionForm, shipped_at: e.target.value })} className="h-10" />
                  </div>
                  <div>
                    <Label className="text-xs">Reçu par</Label>
                    <Input value={receptionForm.receiver_name} onChange={(e) => setReceptionForm({ ...receptionForm, receiver_name: e.target.value })}
                      placeholder="Nom du réceptionnaire" className="h-10" />
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <PackagePlus className="h-3.5 w-3.5" /> Quantités
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500">Commandée</Label>
                    <div className="h-11 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center font-mono text-lg font-bold text-slate-500">
                      {receptionDialog.quantity}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500">Expédiée</Label>
                    <Input type="number" min={0} value={receptionForm.quantity_shipped}
                      onChange={(e) => setReceptionForm({ ...receptionForm, quantity_shipped: Number(e.target.value) })}
                      className="h-11 font-mono text-lg text-center" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-slate-500">Reçue *</Label>
                    <Input type="number" min={0} value={receptionForm.quantity_received}
                      onChange={(e) => setReceptionForm({ ...receptionForm, quantity_received: Number(e.target.value) })}
                      className="h-11 font-mono text-lg text-center border-emerald-300" />
                  </div>
                </div>
                {receptionForm.quantity_received !== receptionDialog.quantity && (
                  <div className={cn("mt-2 flex items-center gap-2 rounded-lg border p-2 text-xs font-semibold",
                    receptionForm.quantity_received < receptionDialog.quantity
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-200 bg-amber-50 text-amber-700")}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {receptionForm.quantity_received < receptionDialog.quantity
                      ? `Écart : manque ${receptionDialog.quantity - receptionForm.quantity_received} balise(s)`
                      : `Écart : surplus de ${receptionForm.quantity_received - receptionDialog.quantity} balise(s)`}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Contrôle qualité *
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setReceptionForm({ ...receptionForm, qc_passed: true })}
                    className={cn("p-3 rounded-xl border-2 text-left transition",
                      receptionForm.qc_passed ? "border-emerald-500 bg-emerald-50 shadow" : "border-slate-200 hover:border-slate-300")}>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
                    <div className="text-sm font-bold">Conforme</div>
                    <div className="text-[10px] text-slate-500">Aucun défaut majeur</div>
                  </button>
                  <button type="button" onClick={() => setReceptionForm({ ...receptionForm, qc_passed: false })}
                    className={cn("p-3 rounded-xl border-2 text-left transition",
                      !receptionForm.qc_passed ? "border-rose-500 bg-rose-50 shadow" : "border-slate-200 hover:border-slate-300")}>
                    <PackageX className="h-5 w-5 text-rose-600 mb-1" />
                    <div className="text-sm font-bold">Défauts signalés</div>
                    <div className="text-[10px] text-slate-500">Retour ou refus partiel</div>
                  </button>
                </div>
              </div>
              {!receptionForm.qc_passed && (
                <div>
                  <Label className="text-xs">Description des défauts *</Label>
                  <Textarea value={receptionForm.defects} onChange={(e) => setReceptionForm({ ...receptionForm, defects: e.target.value })}
                    placeholder="Ex : 5 plaques cassées, QR illisibles sur 3 pièces…" rows={3} />
                </div>
              )}
              <div>
                <Label className="text-xs">Notes complémentaires</Label>
                <Textarea value={receptionForm.notes} onChange={(e) => setReceptionForm({ ...receptionForm, notes: e.target.value })}
                  placeholder="Bordereau, conditions de livraison, autres remarques…" rows={2} />
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2 text-xs text-emerald-800">
                <ClipboardList className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  La validation créera automatiquement un <strong>bon de livraison numéroté</strong> lié au bon de commande, avec téléchargement PDF possible depuis l'onglet BL.
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceptionDialog(null)}>Annuler</Button>
            <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              onClick={() => {
                if (!receptionDialog) return;
                generateDn.mutate({
                  lotId: receptionDialog.id,
                  quantity_received: receptionForm.quantity_received,
                  quantity_shipped: receptionForm.quantity_shipped || null,
                  qc_passed: receptionForm.qc_passed,
                  defects: receptionForm.defects.trim() || null,
                  notes: receptionForm.notes.trim() || null,
                  carrier: receptionForm.carrier.trim() || null,
                  tracking_number: receptionForm.tracking_number.trim() || null,
                  shipped_at: receptionForm.shipped_at || null,
                  receiver_name: receptionForm.receiver_name.trim() || null,
                });
              }}
              disabled={generateDn.isPending}>
              <PackageCheck className="h-4 w-4 mr-1.5" />Valider la réception & créer le BL
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
              <TabsList className="w-full grid grid-cols-6">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="livraison">Livraison</TabsTrigger>
                <TabsTrigger value="bc" className="gap-1"><Receipt className="h-3.5 w-3.5" />BC</TabsTrigger>
                <TabsTrigger value="bl" className="gap-1"><Truck className="h-3.5 w-3.5" />BL</TabsTrigger>
                <TabsTrigger value="fa" className="gap-1"><ScrollText className="h-3.5 w-3.5" />FA</TabsTrigger>
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
                            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => pdfPo.mutate(po.id)} disabled={pdfPo.isPending}>
                              <Download className="h-4 w-4 mr-1.5" />Télécharger PDF
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

              {/* ONGLET BL — Bon de livraison */}
              <TabsContent value="bl" className="space-y-4 pt-4">
                {dnQuery.isLoading ? (
                  <div className="py-8 text-center"><div className="inline-block h-6 w-6 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" /></div>
                ) : !dnQuery.data ? (
                  <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100">
                        <Truck className="h-8 w-8 text-emerald-600" />
                      </div>
                      <h3 className="text-lg font-semibold">Aucun bon de livraison</h3>
                      <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                        Le bon de livraison sera créé automatiquement au moment de la réception physique de la commande.
                      </p>
                    </CardContent>
                  </Card>
                ) : (() => {
                  const dn: any = dnQuery.data;
                  const ecart = dn.quantity_received - dn.quantity_ordered;
                  return (
                    <div className="space-y-4">
                      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
                        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
                              <Truck className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Numéro de bon de livraison</div>
                              <div className="font-mono text-lg font-bold text-slate-900">{dn.dn_number}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {dn.qc_passed === true && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" />QC OK</Badge>}
                            {dn.qc_passed === false && <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1"><PackageX className="h-3 w-3" />QC défauts</Badge>}
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => pdfDn.mutate(dn.id)} disabled={pdfDn.isPending}>
                              <Download className="h-4 w-4 mr-1.5" />Télécharger PDF
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Quantités</div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-3 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="text-[10px] uppercase text-slate-500 font-semibold">Commandée</div>
                              <div className="font-mono text-2xl font-bold text-slate-700 mt-1">{dn.quantity_ordered}</div>
                            </div>
                            <div className="text-center p-3 rounded-lg border border-sky-200 bg-sky-50">
                              <div className="text-[10px] uppercase text-sky-600 font-semibold">Expédiée</div>
                              <div className="font-mono text-2xl font-bold text-sky-700 mt-1">{dn.quantity_shipped ?? "—"}</div>
                            </div>
                            <div className="text-center p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                              <div className="text-[10px] uppercase text-emerald-600 font-semibold">Reçue</div>
                              <div className="font-mono text-2xl font-bold text-emerald-700 mt-1">{dn.quantity_received}</div>
                            </div>
                            <div className={cn("text-center p-3 rounded-lg border",
                              ecart === 0 ? "border-slate-200 bg-slate-50" :
                              ecart < 0 ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50")}>
                              <div className="text-[10px] uppercase font-semibold">Écart</div>
                              <div className={cn("font-mono text-2xl font-bold mt-1",
                                ecart === 0 ? "text-slate-500" : ecart < 0 ? "text-rose-700" : "text-amber-700")}>
                                {ecart > 0 ? `+${ecart}` : ecart}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5" /> Transport
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-slate-500">Transporteur :</span> <strong>{dn.carrier ?? "—"}</strong></div>
                            <div><span className="text-slate-500">N° suivi :</span> <span className="font-mono">{dn.tracking_number ?? "—"}</span></div>
                            <div><span className="text-slate-500">Expédié le :</span> {dn.shipped_at ? new Date(dn.shipped_at).toLocaleDateString("fr-FR") : "—"}</div>
                            <div><span className="text-slate-500">Reçu le :</span> {formatDateTimeFr(dn.received_at)}</div>
                            {dn.receiver_name && <div className="col-span-2"><span className="text-slate-500">Reçu par :</span> <strong>{dn.receiver_name}</strong></div>}
                          </div>
                        </CardContent>
                      </Card>
                      {dn.defects && (
                        <Card className="border-rose-200 bg-rose-50">
                          <CardContent className="p-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-rose-800 mb-1 flex items-center gap-1"><PackageX className="h-3 w-3" />Défauts signalés</div>
                            <div className="text-sm italic">{dn.defects}</div>
                          </CardContent>
                        </Card>
                      )}
                      {dn.notes && (
                        <Card>
                          <CardContent className="p-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Notes de réception</div>
                            <div className="text-sm italic">{dn.notes}</div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              {/* ONGLET FA — Facture d'achat */}
              <TabsContent value="fa" className="space-y-4 pt-4">
                {invoiceQuery.isLoading ? (
                  <div className="py-8 text-center"><div className="inline-block h-6 w-6 border-2 border-slate-300 border-t-violet-600 rounded-full animate-spin" /></div>
                ) : !invoiceQuery.data ? (
                  <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100">
                        <ScrollText className="h-8 w-8 text-violet-600" />
                      </div>
                      <h3 className="text-lg font-semibold">Aucune facture d'achat</h3>
                      <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto mb-4">
                        Enregistrez la facture reçue du fournisseur avec le PDF et suivez son paiement.
                      </p>
                      <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-md" onClick={() => setInvoiceDialog(true)}>
                        <PlusCircle className="h-4 w-4 mr-1.5" />Enregistrer une facture
                      </Button>
                    </CardContent>
                  </Card>
                ) : (() => {
                  const invData: any = invoiceQuery.data;
                  const inv = invData.invoice;
                  const payments = invData.payments;
                  const resteAPayer = Number(inv.amount_ttc) - Number(inv.amount_paid);
                  const pctPaye = inv.amount_ttc > 0 ? Math.min(100, Math.round((inv.amount_paid / inv.amount_ttc) * 100)) : 0;
                  const enRetard = inv.due_date && new Date(inv.due_date).getTime() < Date.now() && inv.payment_status !== "paid";

                  return (
                    <div className="space-y-4">
                      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-600" />
                        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white shadow-md">
                              <ScrollText className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-widest text-violet-700 font-semibold">Facture d'achat</div>
                              <div className="font-mono text-lg font-bold text-slate-900">{inv.internal_ref}</div>
                              <div className="text-xs text-slate-600">N° fournisseur : <span className="font-mono">{inv.invoice_number}</span></div>
                            </div>
                          </div>
                          <div className="flex gap-2 items-center">
                            <Badge className={cn("gap-1 text-xs",
                              inv.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" :
                              inv.payment_status === "partial" ? "bg-amber-100 text-amber-700" :
                              inv.payment_status === "disputed" ? "bg-rose-100 text-rose-700" :
                              inv.payment_status === "cancelled" ? "bg-slate-200 text-slate-700" :
                              "bg-sky-100 text-sky-700")}>
                              {inv.payment_status === "paid" ? "Payée" :
                                inv.payment_status === "partial" ? "Partiellement payée" :
                                inv.payment_status === "disputed" ? "En litige" :
                                inv.payment_status === "cancelled" ? "Annulée" : "À payer"}
                            </Badge>
                            {inv.pdf_url && (
                              <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />PDF</Button>
                              </a>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {enRetard && (
                        <Card className="border-rose-300 bg-rose-50">
                          <CardContent className="p-3 flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                            <div className="flex-1 text-sm text-rose-800">
                              <strong>Facture en retard</strong> — échéance dépassée le {new Date(inv.due_date).toLocaleDateString("fr-FR")}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {inv.dispute_notes && (
                        <Card className="border-rose-300 bg-rose-50">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1">
                                <XCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-wider text-rose-800 mb-1">Litige</div>
                                  <div className="text-sm text-slate-800">{inv.dispute_notes}</div>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => resolveDispute.mutate(inv.id)} disabled={resolveDispute.isPending}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Lever le litige
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-3 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="text-[10px] uppercase text-slate-500 font-semibold">Total TTC</div>
                              <div className="font-mono text-lg font-bold text-slate-900 mt-1">{formatMontant(inv.amount_ttc)}</div>
                            </div>
                            <div className="text-center p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                              <div className="text-[10px] uppercase text-emerald-600 font-semibold">Payé</div>
                              <div className="font-mono text-lg font-bold text-emerald-700 mt-1">{formatMontant(inv.amount_paid)}</div>
                            </div>
                            <div className={cn("text-center p-3 rounded-lg border",
                              resteAPayer <= 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
                              <div className="text-[10px] uppercase font-semibold">Reste</div>
                              <div className={cn("font-mono text-lg font-bold mt-1",
                                resteAPayer <= 0 ? "text-emerald-700" : "text-amber-700")}>
                                {formatMontant(Math.max(0, resteAPayer))}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-500">Progression paiement</span>
                              <span className="font-semibold">{pctPaye}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full",
                                pctPaye === 100 ? "bg-gradient-to-r from-emerald-500 to-teal-600" :
                                pctPaye > 0 ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-slate-300")}
                                style={{ width: `${pctPaye}%` }} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-2 gap-3">
                        <InfoBloc label="Date facture" value={new Date(inv.issued_at).toLocaleDateString("fr-FR")} icon={ScrollText} />
                        <InfoBloc label="Échéance" value={inv.due_date ? new Date(inv.due_date).toLocaleDateString("fr-FR") : "—"} icon={Clock} tone={enRetard ? "rose" : undefined} />
                        <InfoBloc label="Reçue le" value={formatDateTimeFr(inv.received_at)} icon={FileCheck} />
                        <InfoBloc label="TVA" value={`${inv.tva_rate}% (${formatMontant(inv.tva_amount)})`} icon={Calculator} />
                      </div>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <Wallet className="h-3.5 w-3.5" /> Paiements ({payments.length})
                            </div>
                            {inv.payment_status !== "paid" && inv.payment_status !== "cancelled" && (
                              <div className="flex gap-1">
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8" onClick={() => {
                                  setPaymentDialog(inv);
                                  setPaymentForm({ amount: resteAPayer, method: "bank_transfer", paid_at: new Date().toISOString().slice(0, 10), reference: "", notes: "" });
                                }}>
                                  <PlusCircle className="h-3.5 w-3.5 mr-1" />Ajouter
                                </Button>
                                {inv.payment_status !== "disputed" && (
                                  <Button size="sm" variant="outline" className="h-8 text-rose-600 border-rose-300" onClick={() => { setDisputeDialog(inv); setDisputeNotes(""); }}>
                                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />Litige
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          {payments.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4 italic">Aucun paiement enregistré.</p>
                          ) : (
                            <div className="space-y-2">
                              {payments.map((p: any) => {
                                const methodMap: Record<string, { label: string; icon: any; cls: string }> = {
                                  bank_transfer: { label: "Virement", icon: CreditCard, cls: "bg-sky-100 text-sky-700" },
                                  cash: { label: "Espèces", icon: Banknote, cls: "bg-emerald-100 text-emerald-700" },
                                  check: { label: "Chèque", icon: ScrollText, cls: "bg-violet-100 text-violet-700" },
                                  mobile_money: { label: "Mobile money", icon: Smartphone, cls: "bg-orange-100 text-orange-700" },
                                  other: { label: "Autre", icon: Wallet, cls: "bg-slate-100 text-slate-700" },
                                };
                                const m = methodMap[p.method] ?? methodMap.other;
                                const MIcon = m.icon;
                                return (
                                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition group">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", m.cls)}>
                                        <MIcon className="h-4 w-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-semibold text-sm">{formatMontant(p.amount)}</div>
                                        <div className="text-[10px] text-slate-500">
                                          {m.label} · {new Date(p.paid_at).toLocaleDateString("fr-FR")}
                                          {p.reference && ` · ${p.reference}`}
                                        </div>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 opacity-0 group-hover:opacity-100 transition"
                                      onClick={() => { if (confirm("Supprimer ce paiement ?")) deletePayment.mutate(p.id); }}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {reconQuery.data && (
                        <Card className="border-slate-200">
                          <CardContent className="p-4">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                              <GitCompare className="h-3.5 w-3.5" /> Rapprochement BC ↔ BL ↔ FA
                            </div>
                            <div className="space-y-2">
                              <ReconLine label="Montant BC" value={(reconQuery.data as any).po ? formatMontant((reconQuery.data as any).po.amount_ttc) : "—"} refText={(reconQuery.data as any).po?.po_number} />
                              <ReconLine label="Qté BL" value={(reconQuery.data as any).dn ? `${(reconQuery.data as any).dn.quantity_received} / ${(reconQuery.data as any).dn.quantity_ordered}` : "—"} refText={(reconQuery.data as any).dn?.dn_number} ok={(reconQuery.data as any).quantite_ok} />
                              <ReconLine label="Montant FA" value={(reconQuery.data as any).invoice ? formatMontant((reconQuery.data as any).invoice.amount_ttc) : "—"} refText={(reconQuery.data as any).invoice?.internal_ref} ok={(reconQuery.data as any).montant_ok} />
                              {(reconQuery.data as any).ecart_montant !== null && (reconQuery.data as any).ecart_montant !== 0 && (
                                <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                                  <span className="font-semibold text-amber-800">Écart facture vs BC :</span>{" "}
                                  <span className="font-mono">{(reconQuery.data as any).ecart_montant > 0 ? "+" : ""}{formatMontant((reconQuery.data as any).ecart_montant)}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {inv.notes && (
                        <Card>
                          <CardContent className="p-3">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Notes</div>
                            <div className="text-sm italic">{inv.notes}</div>
                          </CardContent>
                        </Card>
                      )}
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

      {/* Dialog création facture */}
      <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-violet-600" />Enregistrer une facture d'achat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">N° facture fournisseur *</Label>
                <Input value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} placeholder="Ex : FAC-2026-001" className="h-11 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Date facture *</Label>
                <Input type="date" value={invoiceForm.issued_at} onChange={(e) => setInvoiceForm({ ...invoiceForm, issued_at: e.target.value })} className="h-11" />
              </div>
              <div>
                <Label className="text-xs">Échéance</Label>
                <Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} className="h-11" />
              </div>
              <div>
                <Label className="text-xs">TVA (%)</Label>
                <Input type="number" step="0.01" value={invoiceForm.tva_rate} onChange={(e) => setInvoiceForm({ ...invoiceForm, tva_rate: Number(e.target.value) })} className="h-11 font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Montant HT (GNF) *</Label>
              <Input type="number" value={invoiceForm.amount_ht} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount_ht: Number(e.target.value) })} className="h-11 font-mono text-lg" />
              <div className="text-[10px] text-slate-500 mt-1 font-mono">
                TVA : {formatMontant(Math.round(invoiceForm.amount_ht * invoiceForm.tva_rate / 100))} · TTC : <strong>{formatMontant(invoiceForm.amount_ht + Math.round(invoiceForm.amount_ht * invoiceForm.tva_rate / 100))}</strong>
              </div>
            </div>
            <div>
              <Label className="text-xs">PDF de la facture (max 5 Mo)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input type="file" accept="application/pdf" onChange={handleFileUpload} className="h-11" />
                {invoiceForm.pdf_filename && (
                  <Badge className="bg-emerald-100 text-emerald-700 gap-1"><FileCheck className="h-3 w-3" />{invoiceForm.pdf_filename}</Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} rows={2} placeholder="Remarques…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialog(false)}>Annuler</Button>
            <Button className="bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700"
              disabled={!invoiceForm.invoice_number.trim() || !invoiceForm.amount_ht || createInvoice.isPending}
              onClick={() => {
                if (!detailLotId) return;
                createInvoice.mutate({
                  lotId: detailLotId,
                  invoice_number: invoiceForm.invoice_number.trim(),
                  issued_at: invoiceForm.issued_at,
                  due_date: invoiceForm.due_date || null,
                  amount_ht: invoiceForm.amount_ht,
                  tva_rate: invoiceForm.tva_rate,
                  pdf_base64: invoiceForm.pdf_base64 || null,
                  pdf_filename: invoiceForm.pdf_filename || null,
                  notes: invoiceForm.notes || null,
                });
              }}>
              <PlusCircle className="h-4 w-4 mr-1.5" />Enregistrer la facture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ajout paiement */}
      <Dialog open={paymentDialog !== null} onOpenChange={(o) => !o && setPaymentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-600" />Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Montant (GNF) *</Label>
              <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} className="h-11 font-mono text-lg text-center" />
            </div>
            <div>
              <Label className="text-xs">Mode *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { v: "bank_transfer", l: "Virement", i: CreditCard },
                  { v: "cash", l: "Espèces", i: Banknote },
                  { v: "mobile_money", l: "Mobile", i: Smartphone },
                  { v: "check", l: "Chèque", i: ScrollText },
                  { v: "other", l: "Autre", i: Wallet },
                ].map((m) => {
                  const MI = m.i;
                  return (
                    <button key={m.v} type="button" onClick={() => setPaymentForm({ ...paymentForm, method: m.v })}
                      className={cn("p-2 rounded-lg border-2 text-xs text-center transition",
                        paymentForm.method === m.v ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold" : "border-slate-200 hover:border-slate-300")}>
                      <MI className="h-4 w-4 mx-auto mb-1" />{m.l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date paiement</Label>
                <Input type="date" value={paymentForm.paid_at} onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })} className="h-11" />
              </div>
              <div>
                <Label className="text-xs">Référence</Label>
                <Input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="Ex : REF12345" className="h-11 font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!paymentForm.amount || recordPayment.isPending}
              onClick={() => paymentDialog && recordPayment.mutate({
                invoiceId: paymentDialog.id, amount: paymentForm.amount, method: paymentForm.method,
                paid_at: new Date(paymentForm.paid_at).toISOString(),
                reference: paymentForm.reference.trim() || null, notes: paymentForm.notes.trim() || null,
              })}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog litige */}
      <Dialog open={disputeDialog !== null} onOpenChange={(o) => !o && setDisputeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-500" />Signaler un litige</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-slate-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
              Le paiement de cette facture sera suspendu jusqu'à résolution du litige.
            </div>
            <div>
              <Label className="text-xs">Motif du litige *</Label>
              <Textarea value={disputeNotes} onChange={(e) => setDisputeNotes(e.target.value)} rows={4}
                placeholder="Ex : Montant erroné, quantité non conforme, service non rendu…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialog(null)}>Annuler</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" disabled={!disputeNotes.trim() || markDispute.isPending}
              onClick={() => disputeDialog && markDispute.mutate({ invoiceId: disputeDialog.id, notes: disputeNotes.trim() })}>
              Confirmer le litige
            </Button>
          </DialogFooter>
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

function ReconLine({ label, value, refText, ok }: { label: string; value: string; refText?: string; ok?: boolean | null }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
      <div className="flex items-center gap-2 min-w-0">
        {ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          : ok === false ? <XCircle className="h-4 w-4 text-rose-600" />
          : <GitCompare className="h-4 w-4 text-slate-400" />}
        <div>
          <div className="text-sm font-semibold">{label}</div>
          {refText && <div className="text-[10px] font-mono text-slate-500">{refText}</div>}
        </div>
      </div>
      <div className="font-mono text-sm font-bold">{value}</div>
    </div>
  );
}
