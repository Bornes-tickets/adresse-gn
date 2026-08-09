import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Ban,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Filter,
  Home,
  Info as InfoIcon,
  MapPin,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  adminAgents,
  adminAssignLot,
  adminBeaconDetail,
  adminBeacons,
  adminExportQrPdf,
  adminExportQrZip,
  adminExportQrCsv,
  adminGenerateBeaconLot,
  adminLots,
  adminSetBeaconStatus,
  adminZones,
} from "@/lib/admin.functions";
import { BEACON_STATUSES, downloadBase64, formatDateFr, statusLabel } from "@/lib/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/beacons")({
  head: () => ({
    meta: [
      { title: "Balises — Administration Adresse GN" },
      {
        name: "description",
        content: "Génération, suivi et export des balises Adresse GN.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBeacons,
});

/* ------------------------------------------------------------------ */
/*  Catégories de balises                                              */
/* ------------------------------------------------------------------ */

type CategoryConf = {
  name: string;
  short: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  ring: string;
  border: string;
  price?: number;
  description: string;
};

const CATEGORIES: Record<string, CategoryConf> = {
  digital_only: {
    name: "Numérique seule",
    short: "Numérique",
    icon: Wifi,
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-200",
    border: "border-slate-500",
    price: 40000,
    description: "Adresse enregistrée, sans balise physique",
  },
  residential: {
    name: "Résidentiel Standard",
    short: "Résidentiel",
    icon: Home,
    bg: "bg-sky-100",
    text: "text-sky-700",
    ring: "ring-sky-200",
    border: "border-sky-500",
    price: 150000,
    description: "Plaque balise posée par un agent",
  },
  residential_plus: {
    name: "Résidentiel Premium",
    short: "Premium",
    icon: ShieldCheck,
    bg: "bg-violet-100",
    text: "text-violet-700",
    ring: "ring-violet-200",
    border: "border-violet-500",
    price: 300000,
    description: "Balise renforcée, pose prioritaire",
  },
  professional: {
    name: "Professionnel",
    short: "Pro",
    icon: Briefcase,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    border: "border-emerald-500",
    price: 450000,
    description: "Commerçants, artisans, PME",
  },
  institutional: {
    name: "Institutionnel",
    short: "Institut.",
    icon: Building2,
    bg: "bg-amber-100",
    text: "text-amber-700",
    ring: "ring-amber-200",
    border: "border-amber-500",
    price: 800000,
    description: "Administrations, ambassades, ONG",
  },
  custom: {
    name: "Sur mesure",
    short: "Custom",
    icon: Sparkles,
    bg: "bg-rose-100",
    text: "text-rose-700",
    ring: "ring-rose-200",
    border: "border-rose-500",
    description: "Configuration spécifique",
  },
};

function CategoryBadge({ code }: { code?: string | null }) {
  if (!code) return <span className="text-slate-400 text-xs">—</span>;
  const conf = CATEGORIES[code];
  if (!conf) {
    return (
      <Badge variant="outline" className="text-xs">
        {code}
      </Badge>
    );
  }
  const Icone = conf.icon;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 cursor-help",
              conf.bg,
              conf.text,
              conf.ring,
            )}
          >
            <Icone className="size-2.5" />
            {conf.short}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-0.5">
            <p className="font-medium">{conf.name}</p>
            <p className="text-xs">{conf.description}</p>
            {conf.price && (
              <p className="text-xs font-mono text-emerald-300">
                {conf.price.toLocaleString("fr-FR")} GNF / balise
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers visuels                                                    */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; ring: string; icon: React.ElementType; libelle?: string }
> = {
  generated: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", icon: Package },
  ordered: { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-200", icon: Sparkles },
  received: { bg: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-200", icon: Package },
  in_use: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200", icon: CheckCircle2 },
  active: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200", icon: CheckCircle2 },
  suspended: { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-200", icon: PauseCircle },
  cancelled: { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200", icon: Ban },
  depleted: { bg: "bg-zinc-100", text: "text-zinc-600", ring: "ring-zinc-200", icon: AlertTriangle },
  recalled: { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200", icon: AlertTriangle },
};

function StatutColore({ valeur }: { valeur: string }) {
  const conf = STATUS_STYLES[valeur] ?? {
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-200",
    icon: InfoIcon,
  };
  const Icone = conf.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        conf.bg,
        conf.text,
        conf.ring,
      )}
    >
      <Icone className="size-3" />
      {statusLabel(valeur)}
    </span>
  );
}

type KpiTone = "sky" | "emerald" | "amber" | "violet" | "rose" | "slate";
const KPI_TONES: Record<KpiTone, { bg: string; ring: string; iconBg: string; iconText: string }> = {
  sky: { bg: "bg-gradient-to-br from-sky-50 to-white", ring: "ring-sky-100", iconBg: "bg-sky-100", iconText: "text-sky-600" },
  emerald: { bg: "bg-gradient-to-br from-emerald-50 to-white", ring: "ring-emerald-100", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
  amber: { bg: "bg-gradient-to-br from-amber-50 to-white", ring: "ring-amber-100", iconBg: "bg-amber-100", iconText: "text-amber-600" },
  violet: { bg: "bg-gradient-to-br from-violet-50 to-white", ring: "ring-violet-100", iconBg: "bg-violet-100", iconText: "text-violet-600" },
  rose: { bg: "bg-gradient-to-br from-rose-50 to-white", ring: "ring-rose-100", iconBg: "bg-rose-100", iconText: "text-rose-600" },
  slate: { bg: "bg-gradient-to-br from-slate-50 to-white", ring: "ring-slate-200", iconBg: "bg-slate-100", iconText: "text-slate-600" },
};

function Kpi({ label, valeur, aide, icone: Icone, ton = "slate" }: { label: string; valeur: string | number; aide?: string; icone: React.ElementType; ton?: KpiTone }) {
  const t = KPI_TONES[ton];
  return (
    <div className={cn("flex items-start justify-between rounded-xl p-4 ring-1 transition-all hover:shadow-sm", t.bg, t.ring)}>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{valeur}</p>
        {aide ? <p className="mt-1 text-xs text-slate-500">{aide}</p> : null}
      </div>
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", t.iconBg, t.iconText)}>
        <Icone className="size-5" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                                */
/* ------------------------------------------------------------------ */

function AdminBeacons() {
  const lister = useServerFn(adminBeacons);
  const detail = useServerFn(adminBeaconDetail);
  const changerStatut = useServerFn(adminSetBeaconStatus);
  const genererLot = useServerFn(adminGenerateBeaconLot);
  const exporter = useServerFn(adminExportQrPdf);
  const exporterZip = useServerFn(adminExportQrZip);
  const exporterCsv = useServerFn(adminExportQrCsv);
  const affecter = useServerFn(adminAssignLot);
  const listerLots = useServerFn(adminLots);
  const listerAgents = useServerFn(adminAgents);
  const listerZones = useServerFn(adminZones);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [statut, setStatut] = useState<string>("tous");
  const [lotId, setLotId] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");
  const [depuis, setDepuis] = useState("");
  const [categorieFiltre, setCategorieFiltre] = useState<string>("tous");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ouvrirGen, setOuvrirGen] = useState(false);
  const [ouvrirAffect, setOuvrirAffect] = useState(false);

  const [categorie, setCategorie] = useState<string>("residential");
  const [quantite, setQuantite] = useState("50");
  const [regionId, setRegionId] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [prix, setPrix] = useState("");
  const [affectLot, setAffectLot] = useState("");
  const [affectAgent, setAffectAgent] = useState("");

  const filtres = {
    page,
    pageSize: 20,
    statuses: statut === "tous" ? [] : [statut],
    lotId: lotId === "tous" ? null : lotId,
    from: depuis ? new Date(depuis).toISOString() : null,
    q: recherche.trim() || null,
  };

  const balises = useQuery({
    queryKey: ["admin", "beacons", filtres],
    queryFn: () => lister({ data: filtres }),
  });
  const lots = useQuery({ queryKey: ["admin", "lots"], queryFn: () => listerLots() });
  const agents = useQuery({ queryKey: ["admin", "agents"], queryFn: () => listerAgents() });
  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => listerZones() });
  const fiche = useQuery({
    queryKey: ["admin", "beacon", detailId],
    queryFn: () => detail({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const muterStatut = useMutation({
    mutationFn: (v: { id: string; status: string }) => changerStatut({ data: v }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "beacons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterGen = useMutation({
    mutationFn: () =>
      genererLot({
        data: {
          quantity: Number(quantite),
          regionId,
          category: categorie,
          supplier: fournisseur || null,
          unitPriceGnf: prix ? Number(prix) : null,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        `Lot ${r.lotCode} créé : ${r.quantite} balises ${CATEGORIES[categorie]?.short ?? ""} (${r.premier} → ${r.dernier}).`,
      );
      setOuvrirGen(false);
      void qc.invalidateQueries({ queryKey: ["admin", "beacons"] });
      void qc.invalidateQueries({ queryKey: ["admin", "lots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterExport = useMutation({
    mutationFn: (id: string) => exporter({ data: { lotId: id } }),
    onSuccess: (r) => {
      downloadBase64(r.base64, `QR_lot_${r.lotCode}.pdf`, "application/pdf");
      toast.success(`${r.balises} QR exportés sur ${r.pages} page(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterZip = useMutation({
    mutationFn: (id: string) => exporterZip({ data: { lotId: id } }),
    onSuccess: (r) => {
      downloadBase64(r.base64, `QR_lot_${r.lotCode}_png.zip`, "application/zip");
      toast.success(`${r.fichiers} PNG (${r.cote}x${r.cote} px, 600 DPI) exportés.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterCsv = useMutation({
    mutationFn: (id: string) => exporterCsv({ data: { lotId: id } }),
    onSuccess: (r) => {
      downloadBase64(r.base64, `manifeste_lot_${r.lotCode}.csv`, "text/csv");
      toast.success(`Manifeste CSV : ${r.lignes} balise(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterAffect = useMutation({
    mutationFn: () => affecter({ data: { lotId: affectLot, agentId: affectAgent } }),
    onSuccess: () => {
      toast.success("Lot affecté à l'agent.");
      setOuvrirAffect(false);
      void qc.invalidateQueries({ queryKey: ["admin", "beacons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof balises.data>["rows"][number] & { category?: string | null };
  const exportEnCours = muterExport.isPending || muterZip.isPending || muterCsv.isPending;
  const etapeExport = muterExport.isPending ? "PDF" : muterZip.isPending ? "ZIP PNG" : "CSV";
  const [progression, setProgression] = useState(0);
  useEffect(() => {
    if (!exportEnCours) {
      setProgression(0);
      return;
    }
    setProgression(8);
    const timer = setInterval(() => {
      setProgression((p) => (p >= 92 ? 92 : p + Math.max(1, (95 - p) / 12)));
    }, 320);
    return () => clearInterval(timer);
  }, [exportEnCours]);

  const rows = (balises.data?.rows ?? []) as Ligne[];
  const rowsFiltres = useMemo(
    () => rows.filter((r) => categorieFiltre === "tous" || (r.category ?? "residential") === categorieFiltre),
    [rows, categorieFiltre],
  );

  const kpis = useMemo(() => {
    const total = balises.data?.total ?? 0;
    const actives = rows.filter((r) => r.status === "active" || r.status === "in_use").length;
    const suspendues = rows.filter((r) => r.status === "suspended").length;
    const generees = rows.filter((r) => r.status === "generated").length;
    const annulees = rows.filter((r) => r.status === "cancelled").length;
    return { total, actives, suspendues, generees, annulees };
  }, [rows, balises.data?.total]);

  const filtresActifs =
    (statut !== "tous" ? 1 : 0) +
    (lotId !== "tous" ? 1 : 0) +
    (categorieFiltre !== "tous" ? 1 : 0) +
    (recherche.trim() ? 1 : 0) +
    (depuis ? 1 : 0);

  const reinitialiserFiltres = () => {
    setStatut("tous");
    setLotId("tous");
    setCategorieFiltre("tous");
    setRecherche("");
    setDepuis("");
    setPage(1);
  };

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "numero",
      entete: "Numéro",
      rendu: (l) => (
        <div className="flex items-center gap-2">
          <QrCode className="size-3.5 text-slate-400" />
          <span className="font-mono text-sm font-semibold text-slate-900">{l.public_number}</span>
        </div>
      ),
    },
    {
      cle: "categorie",
      entete: "Catégorie",
      rendu: (l) => <CategoryBadge code={l.category ?? "residential"} />,
    },
    {
      cle: "statut",
      entete: "Statut",
      rendu: (l) => <StatutColore valeur={l.status} />,
    },
    {
      cle: "lot",
      entete: "Lot",
      rendu: (l) =>
        l.lot_code ? (
          <Badge variant="outline" className="font-mono text-xs">
            {l.lot_code}
          </Badge>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      cle: "creee",
      entete: "Créée",
      rendu: (l) => <span className="text-xs text-slate-600">{formatDateFr(l.created_at)}</span>,
    },
    {
      cle: "activee",
      entete: "Activée",
      rendu: (l) =>
        l.activated_at ? (
          <span className="text-xs text-emerald-600">{formatDateFr(l.activated_at)}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      cle: "actions",
      entete: "Actions",
      rendu: (l) => (
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setDetailId(l.id)}>
                  <InfoIcon className="size-3.5" />
                  Détail
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voir la fiche complète</TooltipContent>
            </Tooltip>
            {l.status !== "suspended" && l.status !== "cancelled" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800" onClick={() => muterStatut.mutate({ id: l.id, status: "suspended" })}>
                    <PauseCircle className="size-3.5" />
                    Suspendre
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Suspendre temporairement</TooltipContent>
              </Tooltip>
            )}
            {l.status === "suspended" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" onClick={() => muterStatut.mutate({ id: l.id, status: "active" })}>
                    <PlayCircle className="size-3.5" />
                    Réactiver
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remettre en service</TooltipContent>
              </Tooltip>
            )}
            {l.status !== "cancelled" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => muterStatut.mutate({ id: l.id, status: "cancelled" })}>
                    <Ban className="size-3.5" />
                    Annuler
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Annuler définitivement</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      ),
    },
  ];

  const catConf = CATEGORIES[categorie];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <Radio className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Balises</h1>
            <p className="text-sm text-slate-500">Génération, suivi et export des balises Adresse GN.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void balises.refetch()} disabled={balises.isFetching}>
            <RefreshCw className={cn("size-4", balises.isFetching && "animate-spin")} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOuvrirAffect(true)} disabled={exportEnCours}>
            <UserPlus className="size-4" />
            Affecter à un agent
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700" onClick={() => setOuvrirGen(true)} disabled={exportEnCours}>
            <Plus className="size-4" />
            Générer un lot
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Total" valeur={kpis.total} aide="Balises correspondant aux filtres" icone={Package} ton="slate" />
        <Kpi label="Actives" valeur={kpis.actives} aide="En service sur le terrain" icone={CheckCircle2} ton="emerald" />
        <Kpi label="Générées" valeur={kpis.generees} aide="En attente d'installation" icone={Sparkles} ton="sky" />
        <Kpi label="Suspendues" valeur={kpis.suspendues} aide="Temporairement bloquées" icone={PauseCircle} ton="amber" />
        <Kpi label="Annulées" valeur={kpis.annulees} aide="Retirées définitivement" icone={Ban} ton="rose" />
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="size-4 text-slate-500" />
            Filtres
            {filtresActifs > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {filtresActifs}
              </Badge>
            )}
            {filtresActifs > 0 && (
              <button onClick={reinitialiserFiltres} className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-slate-500 hover:text-slate-900">
                <X className="size-3" />
                Réinitialiser
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-xs text-slate-600">Recherche</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={recherche}
                  onChange={(e) => {
                    setRecherche(e.target.value);
                    setPage(1);
                  }}
                  placeholder="GN-CKY-…"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Statut</Label>
              <Select
                value={statut}
                onValueChange={(v) => {
                  setStatut(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les statuts</SelectItem>
                  {BEACON_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Catégorie</Label>
              <Select value={categorieFiltre} onValueChange={setCategorieFiltre}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Toutes catégories</SelectItem>
                  {Object.entries(CATEGORIES).map(([code, conf]) => (
                    <SelectItem key={code} value={code}>
                      {conf.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Lot</Label>
              <Select
                value={lotId}
                onValueChange={(v) => {
                  setLotId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les lots</SelectItem>
                  {(lots.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Depuis le</Label>
              <div className="relative mt-1">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date"
                  value={depuis}
                  onChange={(e) => {
                    setDepuis(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {lotId !== "tous" && (
            <>
              <Separator className="my-4" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-slate-600">Exports pour ce lot :</span>
                <Button variant="outline" size="sm" disabled={exportEnCours} onClick={() => muterExport.mutate(lotId)}>
                  <FileText className="size-4 text-rose-500" />
                  {muterExport.isPending ? "Génération…" : "PDF"}
                </Button>
                <Button variant="outline" size="sm" disabled={exportEnCours} onClick={() => muterZip.mutate(lotId)}>
                  <FileArchive className="size-4 text-indigo-500" />
                  {muterZip.isPending ? "Génération…" : "ZIP (PNG)"}
                </Button>
                <Button variant="outline" size="sm" disabled={exportEnCours} onClick={() => muterCsv.mutate(lotId)}>
                  <FileSpreadsheet className="size-4 text-emerald-500" />
                  {muterCsv.isPending ? "Génération…" : "Manifeste CSV"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {exportEnCours ? (
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Download className="size-4 animate-pulse text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900">Génération {etapeExport} en cours…</p>
                  <p className="text-xs text-slate-500">Le fichier sera téléchargé automatiquement dès qu'il est prêt.</p>
                </div>
              </div>
              <span className="font-mono text-xs tabular-nums text-indigo-700">{Math.round(progression)}%</span>
            </div>
            <Progress value={progression} className="h-2" />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <AdminTable
          colonnes={colonnes}
          lignes={rowsFiltres}
          chargement={balises.isLoading}
          total={balises.data?.total ?? 0}
          page={page}
          pageSize={20}
          onPage={setPage}
        />
      </Card>

      {/* Sheet détail */}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-indigo-600" />
              Fiche balise
            </SheetTitle>
          </SheetHeader>
          {fiche.isLoading && <div className="p-6 text-sm text-slate-500">Chargement…</div>}
          {fiche.data && (
            <div className="space-y-5 px-1 py-5 text-sm">
              <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white">
                <p className="text-xs uppercase tracking-wider text-slate-300">Numéro public</p>
                <p className="mt-1 font-mono text-2xl font-bold">{fiche.data.beacon.public_number}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatutColore valeur={fiche.data.beacon.status} />
                  <CategoryBadge code={(fiche.data.beacon as any).category ?? "residential"} />
                </div>
              </div>
              <Section titre="Métadonnées" icone={InfoIcon}>
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Lot" valeur={(fiche.data.beacon as any).lots?.code ?? "—"} mono />
                  <Info label="Catégorie" valeur={CATEGORIES[(fiche.data.beacon as any).category ?? "residential"]?.name ?? "—"} />
                  <Info label="Statut" valeur={statusLabel(fiche.data.beacon.status)} />
                  <Info label="Créée le" valeur={formatDateFr(fiche.data.beacon.created_at)} />
                  <Info label="Activée le" valeur={formatDateFr(fiche.data.beacon.activated_at)} />
                </div>
              </Section>
              <Section titre="Adresse rattachée" icone={MapPin}>
                {fiche.data.adresse ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <p className="font-medium text-slate-900">{fiche.data.adresse.name ?? "Sans nom"}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {statusLabel(fiche.data.adresse.visibility)}
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-xs">
                        <ShieldCheck className="size-3" />
                        {statusLabel(fiche.data.adresse.verification_level)}
                      </Badge>
                    </div>
                    {fiche.data.adresse.point && (
                      <p className="mt-2 font-mono text-xs text-slate-500">
                        📍 {fiche.data.adresse.point.lat.toFixed(5)}, {fiche.data.adresse.point.lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                    Aucune adresse rattachée à cette balise.
                  </div>
                )}
              </Section>
              <Section titre="Dernière installation" icone={Activity}>
                {fiche.data.installation ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-slate-700">
                    <p>
                      📅 <strong>{formatDateFr(fiche.data.installation.installed_at)}</strong>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Précision GPS : <span className="font-mono">{fiche.data.installation.accuracy_m ?? "—"} m</span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                    Aucune installation enregistrée.
                  </div>
                )}
              </Section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog génération avec catégories */}
      <Dialog open={ouvrirGen} onOpenChange={setOuvrirGen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
                <Sparkles className="size-4" />
              </div>
              Générer un lot de balises
            </DialogTitle>
            <DialogDescription>
              Choisis d'abord la catégorie, puis la quantité et la zone. Les numéros sont attribués séquentiellement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Sélection de catégorie */}
            <div>
              <Label className="mb-2 flex items-center gap-1.5 text-xs text-slate-600">
                <Tag className="size-3" />
                Catégorie de balise <span className="text-rose-500">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(CATEGORIES).map(([code, conf]) => {
                  const Icone = conf.icon;
                  const actif = categorie === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCategorie(code)}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all hover:shadow-sm",
                        actif ? cn(conf.border, conf.bg, "ring-1", conf.ring) : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className={cn("grid size-6 place-items-center rounded-md", actif ? "bg-white" : conf.bg)}>
                          <Icone className={cn("size-3.5", conf.text)} />
                        </div>
                        {actif && <CheckCircle2 className={cn("size-4", conf.text)} />}
                      </div>
                      <span className={cn("text-xs font-semibold", actif ? conf.text : "text-slate-800")}>{conf.name}</span>
                      <span className={cn("text-[10px] leading-tight", actif ? conf.text : "text-slate-500")}>
                        {conf.description}
                      </span>
                      {conf.price && (
                        <span className={cn("font-mono text-[10px]", actif ? conf.text : "text-slate-500")}>
                          {conf.price.toLocaleString("fr-FR")} GNF
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Quantité (1 à 1000)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Zone (région)</Label>
                <Select value={regionId} onValueChange={setRegionId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir une région" />
                  </SelectTrigger>
                  <SelectContent>
                    {(zones.data?.regions ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Fournisseur (optionnel)</Label>
                <Input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} className="mt-1" placeholder="Nom du fournisseur" />
              </div>
              <div>
                <Label className="text-xs">Prix unitaire réel (GNF)</Label>
                <Input
                  type="number"
                  value={prix}
                  onChange={(e) => setPrix(e.target.value)}
                  className="mt-1"
                  placeholder={catConf?.price ? String(catConf.price) : "Ex : 150000"}
                />
                {catConf?.price && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Prix indicatif catégorie : {catConf.price.toLocaleString("fr-FR")} GNF
                  </p>
                )}
              </div>
            </div>

            {/* Récapitulatif */}
            {catConf && quantite && regionId && (
              <div className={cn("rounded-lg border-2 p-3", catConf.border, catConf.bg)}>
                <p className={cn("text-xs font-semibold uppercase tracking-wider", catConf.text)}>Récapitulatif</p>
                <p className="mt-1 text-sm text-slate-800">
                  <strong className="tabular-nums">{quantite}</strong> balise(s){" "}
                  <strong>{catConf.name}</strong> pour la région{" "}
                  <strong>{zones.data?.regions?.find((r) => r.id === regionId)?.name ?? "…"}</strong>
                </p>
                {catConf.price && (
                  <p className="mt-1 font-mono text-xs text-slate-600">
                    Valeur indicative : {(catConf.price * Number(quantite || 0)).toLocaleString("fr-FR")} GNF
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvrirGen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!regionId || !categorie || muterGen.isPending}
              onClick={() => muterGen.mutate()}
              className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700"
            >
              {muterGen.isPending ? "Génération…" : "Générer le lot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog affectation */}
      <Dialog open={ouvrirAffect} onOpenChange={setOuvrirAffect}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <Users className="size-4" />
              </div>
              Affecter un lot à un agent
            </DialogTitle>
            <DialogDescription>L'agent recevra les balises de ce lot dans son espace de travail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Lot</Label>
              <Select value={affectLot} onValueChange={setAffectLot}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir un lot" />
                </SelectTrigger>
                <SelectContent>
                  {(lots.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code} ({l.quantity} balises)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Agent</Label>
              <Select value={affectAgent} onValueChange={setAffectAgent}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir un agent" />
                </SelectTrigger>
                <SelectContent>
                  {(agents.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.badge_number} — {a.full_name ?? "Sans nom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvrirAffect(false)}>
              Annuler
            </Button>
            <Button
              disabled={!affectLot || !affectAgent || muterAffect.isPending}
              onClick={() => muterAffect.mutate()}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
            >
              {muterAffect.isPending ? "Affectation…" : "Affecter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ titre, icone: Icone, children }: { titre: string; icone: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Icone className="size-3.5" />
        {titre}
      </h3>
      {children}
    </div>
  );
}

function Info({ label, valeur, mono = false }: { label: string; valeur: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("mt-0.5 text-sm text-slate-900", mono && "font-mono text-xs")}>{valeur}</p>
    </div>
  );
}
