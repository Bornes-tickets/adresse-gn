import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  Home,
  Info as InfoIcon,
  Package,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LOT_STATUSES, formatDateFr, statusLabel } from "@/lib/admin";
import { adminLots, adminUpdateLot } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/lots")({
  head: () => ({
    meta: [
      { title: "Lots de balises — Administration Adresse GN" },
      {
        name: "description",
        content: "Suivi des lots de fabrication et de distribution.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLots,
});

/* ------------------------------------------------------------------ */
/*  Catégories de balises (miroir de la table beacon_categories)       */
/* ------------------------------------------------------------------ */

type CategoryConf = {
  name: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  ring: string;
  price?: number;
  description: string;
};

const CATEGORIES: Record<string, CategoryConf> = {
  digital_only: {
    name: "Numérique seule",
    icon: Wifi,
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-200",
    price: 40000,
    description: "Adresse enregistrée, sans balise physique",
  },
  residential: {
    name: "Résidentiel Standard",
    icon: Home,
    bg: "bg-sky-100",
    text: "text-sky-700",
    ring: "ring-sky-200",
    price: 150000,
    description: "Plaque balise posée par un agent agréé",
  },
  residential_plus: {
    name: "Résidentiel Premium",
    icon: ShieldCheck,
    bg: "bg-violet-100",
    text: "text-violet-700",
    ring: "ring-violet-200",
    price: 300000,
    description: "Balise renforcée, pose prioritaire",
  },
  professional: {
    name: "Professionnel",
    icon: Briefcase,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    price: 450000,
    description: "Balise commerçants, artisans, PME",
  },
  institutional: {
    name: "Institutionnel",
    icon: Building2,
    bg: "bg-amber-100",
    text: "text-amber-700",
    ring: "ring-amber-200",
    price: 800000,
    description: "Balise administrations, ambassades, ONG",
  },
  custom: {
    name: "Sur mesure",
    icon: Sparkles,
    bg: "bg-rose-100",
    text: "text-rose-700",
    ring: "ring-rose-200",
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
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 cursor-help",
              conf.bg,
              conf.text,
              conf.ring,
            )}
          >
            <Icone className="size-3" />
            {conf.name}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{conf.name}</p>
            <p className="text-xs text-slate-300">{conf.description}</p>
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
/*  Helpers statuts                                                    */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; ring: string; icon: React.ElementType }
> = {
  generated: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", icon: Package },
  ordered: { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-200", icon: Sparkles },
  received: { bg: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-200", icon: PackageOpen },
  in_use: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200", icon: PackageCheck },
  active: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200", icon: CheckCircle2 },
  depleted: { bg: "bg-zinc-100", text: "text-zinc-600", ring: "ring-zinc-200", icon: AlertTriangle },
  recalled: { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200", icon: AlertTriangle },
  cancelled: { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200", icon: Ban },
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

/* ------------------------------------------------------------------ */
/*  KPI                                                                */
/* ------------------------------------------------------------------ */

type KpiTone = "sky" | "emerald" | "amber" | "violet" | "rose" | "slate" | "indigo";
const KPI_TONES: Record<KpiTone, { bg: string; ring: string; iconBg: string; iconText: string }> = {
  sky: { bg: "bg-gradient-to-br from-sky-50 to-white", ring: "ring-sky-100", iconBg: "bg-sky-100", iconText: "text-sky-600" },
  emerald: { bg: "bg-gradient-to-br from-emerald-50 to-white", ring: "ring-emerald-100", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
  amber: { bg: "bg-gradient-to-br from-amber-50 to-white", ring: "ring-amber-100", iconBg: "bg-amber-100", iconText: "text-amber-600" },
  violet: { bg: "bg-gradient-to-br from-violet-50 to-white", ring: "ring-violet-100", iconBg: "bg-violet-100", iconText: "text-violet-600" },
  rose: { bg: "bg-gradient-to-br from-rose-50 to-white", ring: "ring-rose-100", iconBg: "bg-rose-100", iconText: "text-rose-600" },
  slate: { bg: "bg-gradient-to-br from-slate-50 to-white", ring: "ring-slate-200", iconBg: "bg-slate-100", iconText: "text-slate-600" },
  indigo: { bg: "bg-gradient-to-br from-indigo-50 to-white", ring: "ring-indigo-100", iconBg: "bg-indigo-100", iconText: "text-indigo-600" },
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

function AdminLots() {
  const lister = useServerFn(adminLots);
  const maj = useServerFn(adminUpdateLot);
  const qc = useQueryClient();

  const [statut, setStatut] = useState<string>("tous");
  const [categorie, setCategorie] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");
  const [fournisseur, setFournisseur] = useState<string>("tous");

  const lots = useQuery({ queryKey: ["admin", "lots"], queryFn: () => lister() });

  const muter = useMutation({
    mutationFn: (v: { id: string; status: string }) => maj({ data: v }),
    onSuccess: () => {
      toast.success("Lot mis à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "lots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof lots.data>[number] & { category?: string | null };
  const rows: Ligne[] = (lots.data ?? []) as Ligne[];

  const kpis = useMemo(() => {
    const total = rows.length;
    const totalBalises = rows.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
    const enUsage = rows.filter((l) => l.status === "in_use" || l.status === "active").length;
    const affectes = rows.filter((l) => (l.assignations?.length ?? 0) > 0).length;
    // Valeur totale estimée
    const valeurGnf = rows.reduce((sum, l) => {
      const price = CATEGORIES[l.category ?? "residential"]?.price ?? 0;
      return sum + price * (l.quantity ?? 0);
    }, 0);
    return { total, totalBalises, enUsage, affectes, valeurGnf };
  }, [rows]);

  /* Répartition par catégorie */
  const parCategorie = useMemo(() => {
    const map = new Map<string, { lots: number; balises: number }>();
    rows.forEach((l) => {
      const cat = l.category ?? "residential";
      const cur = map.get(cat) ?? { lots: 0, balises: 0 };
      cur.lots += 1;
      cur.balises += l.quantity ?? 0;
      map.set(cat, cur);
    });
    return Array.from(map.entries()).flatMap(([code, stats]) => {
      const conf = CATEGORIES[code];
      return conf ? [{ code, ...stats, conf }] : [];
    });
  }, [rows]);

  const fournisseurs = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((l) => {
      if (l.supplier) set.add(l.supplier);
    });
    return Array.from(set).sort();
  }, [rows]);

  const rowsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return rows.filter((l) => {
      if (statut !== "tous" && l.status !== statut) return false;
      if (categorie !== "tous" && (l.category ?? "residential") !== categorie) return false;
      if (fournisseur !== "tous" && (l.supplier ?? "") !== fournisseur) return false;
      if (q) {
        const dansCode = (l.code ?? "").toLowerCase().includes(q);
        const dansFournisseur = (l.supplier ?? "").toLowerCase().includes(q);
        const dansAgent = (l.assignations ?? []).some((a) => (a.badge ?? "").toLowerCase().includes(q));
        if (!dansCode && !dansFournisseur && !dansAgent) return false;
      }
      return true;
    });
  }, [rows, statut, categorie, fournisseur, recherche]);

  const filtresActifs =
    (statut !== "tous" ? 1 : 0) +
    (categorie !== "tous" ? 1 : 0) +
    (fournisseur !== "tous" ? 1 : 0) +
    (recherche.trim() ? 1 : 0);

  const reinitialiserFiltres = () => {
    setStatut("tous");
    setCategorie("tous");
    setFournisseur("tous");
    setRecherche("");
  };

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "code",
      entete: "Code",
      rendu: (l) => (
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-indigo-100 text-indigo-600">
            <Package className="size-3.5" />
          </div>
          <span className="font-mono text-sm font-semibold text-slate-900">{l.code}</span>
        </div>
      ),
    },
    {
      cle: "cat",
      entete: "Catégorie",
      rendu: (l) => <CategoryBadge code={l.category} />,
    },
    {
      cle: "qte",
      entete: "Quantité",
      rendu: (l) => (
        <Badge variant="outline" className="tabular-nums">
          {l.quantity} balises
        </Badge>
      ),
    },
    {
      cle: "fournisseur",
      entete: "Fournisseur",
      rendu: (l) =>
        l.supplier ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-700">
            <Truck className="size-3 text-slate-400" />
            {l.supplier}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      cle: "recu",
      entete: "Reçu le",
      rendu: (l) =>
        l.received_at ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Calendar className="size-3" />
            {formatDateFr(l.received_at)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      cle: "affect",
      entete: "Agents",
      rendu: (l) => {
        if (!l.assignations || l.assignations.length === 0) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Users className="size-3" />
              Aucun
            </span>
          );
        }
        return (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-help text-xs">
                  <Users className="size-3 text-emerald-500" />
                  <Badge variant="secondary" className="text-[10px]">
                    {l.assignations.length}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-0.5">
                  {l.assignations.map((a, i) => (
                    <div key={i} className="font-mono text-xs">
                      {a.badge ?? "?"}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      cle: "statut",
      entete: "Statut",
      rendu: (l) => <StatutColore valeur={l.status} />,
    },
    {
      cle: "actions",
      entete: "Changer",
      rendu: (l) => (
        <Select
          value={l.status ?? "generated"}
          onValueChange={(v) => muter.mutate({ id: l.id, status: v })}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOT_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {statusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
            <Package className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lots de balises</h1>
            <p className="text-sm text-slate-500">
              Suivi de la fabrication, réception et distribution par catégorie.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void lots.refetch()}
            disabled={lots.isFetching}
          >
            <RefreshCw className={cn("size-4", lots.isFetching && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* KPI globaux */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Total lots" valeur={kpis.total} aide="Tous statuts" icone={Package} ton="slate" />
        <Kpi label="Balises totales" valeur={kpis.totalBalises} aide="Volume cumulé" icone={PackageCheck} ton="indigo" />
        <Kpi label="En usage" valeur={kpis.enUsage} aide="Sur le terrain" icone={CheckCircle2} ton="emerald" />
        <Kpi label="Affectés" valeur={kpis.affectes} aide="Assignés à un agent" icone={Users} ton="amber" />
        <Kpi
          label="Valeur estimée"
          valeur={`${(kpis.valeurGnf / 1_000_000).toFixed(1)}M`}
          aide="GNF (prix indicatifs)"
          icone={Tag}
          ton="violet"
        />
      </div>

      {/* Répartition par catégorie */}
      {parCategorie.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Tag className="size-4 text-slate-500" />
              Répartition par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {parCategorie.map(({ code, lots, balises, conf }) => {
                const Icone = conf.icon;
                return (
                  <button
                    key={code}
                    onClick={() =>
                      setCategorie(categorie === code ? "tous" : code)
                    }
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                      categorie === code
                        ? "border-slate-900 ring-1 ring-slate-900"
                        : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "grid size-7 place-items-center rounded-md",
                          conf.bg,
                          conf.text,
                        )}
                      >
                        <Icone className="size-3.5" />
                      </div>
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {conf.name}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-bold text-slate-900 tabular-nums">
                      {balises}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {lots} lot{lots > 1 ? "s" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
              <button
                onClick={reinitialiserFiltres}
                className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-slate-500 hover:text-slate-900"
              >
                <X className="size-3" />
                Réinitialiser
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs text-slate-600">Recherche</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Code, fournisseur, agent…"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Catégorie</Label>
              <Select value={categorie} onValueChange={setCategorie}>
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
              <Label className="text-xs text-slate-600">Statut</Label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous statuts</SelectItem>
                  {LOT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Fournisseur</Label>
              <Select value={fournisseur} onValueChange={setFournisseur}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous fournisseurs</SelectItem>
                  {fournisseurs.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résumé */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{rowsFiltres.length}</span> lot(s) affiché(s) sur {rows.length} au total
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <AdminTable
          colonnes={colonnes}
          lignes={rowsFiltres}
          chargement={lots.isLoading}
          cle={(l) => l.id}
        />
      </Card>
    </div>
  );
}
