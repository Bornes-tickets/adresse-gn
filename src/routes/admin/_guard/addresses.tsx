import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Filter,
  History,
  Info as InfoIcon,
  MapPin,
  MapPinned,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Trash2,
  UserCog,
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
  ADDRESS_STATUSES,
  VERIFICATION_LEVELS,
  VISIBILITIES,
  formatDateFr,
  formatDateTimeFr,
  statusLabel,
} from "@/lib/admin";
import {
  adminAddressDetail,
  adminAddresses,
  adminReassignOwner,
  adminUpdateAddress,
  adminZones,
} from "@/lib/admin.functions";
import { CATEGORY_LABELS, categoryLabel } from "@/lib/geo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/addresses")({
  head: () => ({
    meta: [
      { title: "Adresses — Administration Adresse GN" },
      {
        name: "description",
        content: "Modération et vérification des adresses Adresse GN.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAddresses,
});

/* ------------------------------------------------------------------ */
/*  Helpers visuels                                                    */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; ring: string; icon: React.ElementType }
> = {
  // Visibilité
  public: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200", icon: Eye },
  private: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200", icon: EyeOff },
  hidden: { bg: "bg-zinc-100", text: "text-zinc-600", ring: "ring-zinc-200", icon: EyeOff },
  // Vérification
  verified: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    icon: ShieldCheck,
  },
  claimed: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    ring: "ring-sky-200",
    icon: ShieldAlert,
  },
  unverified: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    ring: "ring-amber-200",
    icon: ShieldQuestion,
  },
  // Statut adresse
  active: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    icon: CheckCircle2,
  },
  suspended: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    ring: "ring-amber-200",
    icon: PauseCircle,
  },
  deleted: { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200", icon: Trash2 },
  pending: {
    bg: "bg-violet-100",
    text: "text-violet-700",
    ring: "ring-violet-200",
    icon: Sparkles,
  },
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
const KPI_TONES: Record<
  KpiTone,
  { bg: string; ring: string; iconBg: string; iconText: string }
> = {
  sky: {
    bg: "bg-gradient-to-br from-sky-50 to-white",
    ring: "ring-sky-100",
    iconBg: "bg-sky-100",
    iconText: "text-sky-600",
  },
  emerald: {
    bg: "bg-gradient-to-br from-emerald-50 to-white",
    ring: "ring-emerald-100",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-50 to-white",
    ring: "ring-amber-100",
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
  },
  violet: {
    bg: "bg-gradient-to-br from-violet-50 to-white",
    ring: "ring-violet-100",
    iconBg: "bg-violet-100",
    iconText: "text-violet-600",
  },
  rose: {
    bg: "bg-gradient-to-br from-rose-50 to-white",
    ring: "ring-rose-100",
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
  },
  slate: {
    bg: "bg-gradient-to-br from-slate-50 to-white",
    ring: "ring-slate-200",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
  },
};

function Kpi({
  label,
  valeur,
  aide,
  icone: Icone,
  ton = "slate",
}: {
  label: string;
  valeur: string | number;
  aide?: string;
  icone: React.ElementType;
  ton?: KpiTone;
}) {
  const t = KPI_TONES[ton];
  return (
    <div
      className={cn(
        "flex items-start justify-between rounded-xl p-4 ring-1 transition-all hover:shadow-sm",
        t.bg,
        t.ring,
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{valeur}</p>
        {aide ? <p className="mt-1 text-xs text-slate-500">{aide}</p> : null}
      </div>
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          t.iconBg,
          t.iconText,
        )}
      >
        <Icone className="size-5" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                                */
/* ------------------------------------------------------------------ */

function AdminAddresses() {
  const lister = useServerFn(adminAddresses);
  const detail = useServerFn(adminAddressDetail);
  const majAdresse = useServerFn(adminUpdateAddress);
  const reassigner = useServerFn(adminReassignOwner);
  const listerZones = useServerFn(adminZones);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [visibilite, setVisibilite] = useState("tous");
  const [categorie, setCategorie] = useState("tous");
  const [verification, setVerification] = useState("tous");
  const [commune, setCommune] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ouvrirProprio, setOuvrirProprio] = useState(false);
  const [email, setEmail] = useState("");

  const filtres = {
    page,
    pageSize: 20,
    visibility: visibilite === "tous" ? null : visibilite,
    category: categorie === "tous" ? null : categorie,
    verification: verification === "tous" ? null : verification,
    communeId: commune === "tous" ? null : commune,
    q: recherche.trim() || null,
  };

  const adresses = useQuery({
    queryKey: ["admin", "addresses", filtres],
    queryFn: () => lister({ data: filtres }),
  });
  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => listerZones() });
  const fiche = useQuery({
    queryKey: ["admin", "address", detailId],
    queryFn: () => detail({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const muter = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) =>
      majAdresse({ data: v }),
    onSuccess: () => {
      toast.success("Adresse mise à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["admin", "address"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterProprio = useMutation({
    mutationFn: () => reassigner({ data: { addressId: detailId!, email } }),
    onSuccess: () => {
      toast.success("Propriétaire réassigné.");
      setOuvrirProprio(false);
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof adresses.data>["rows"][number];

  const rows = adresses.data?.rows ?? [];
  const kpis = useMemo(() => {
    const total = adresses.data?.total ?? 0;
    const publiques = rows.filter((r) => r.visibility === "public").length;
    const privees = rows.filter((r) => r.visibility === "private").length;
    const verifiees = rows.filter((r) => r.verification_level === "verified").length;
    const revendiquees = rows.filter((r) => r.verification_level === "claimed").length;
    const nonVerifiees = rows.filter(
      (r) => r.verification_level === "unverified",
    ).length;
    return { total, publiques, privees, verifiees, revendiquees, nonVerifiees };
  }, [rows, adresses.data?.total]);

  const filtresActifs =
    (visibilite !== "tous" ? 1 : 0) +
    (categorie !== "tous" ? 1 : 0) +
    (verification !== "tous" ? 1 : 0) +
    (commune !== "tous" ? 1 : 0) +
    (recherche.trim() ? 1 : 0);

  const reinitialiserFiltres = () => {
    setVisibilite("tous");
    setCategorie("tous");
    setVerification("tous");
    setCommune("tous");
    setRecherche("");
    setPage(1);
  };

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: "balise",
      entete: "Balise",
      rendu: (l) =>
        l.beacon_number ? (
          <span className="font-mono text-sm font-semibold text-slate-900">
            {l.beacon_number}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      cle: "nom",
      entete: "Nom",
      rendu: (l) => (
        <span className="font-medium text-slate-900">{l.name ?? "—"}</span>
      ),
    },
    {
      cle: "cat",
      entete: "Catégorie",
      rendu: (l) => (
        <Badge variant="outline" className="gap-1 text-xs">
          <Building2 className="size-3 text-slate-500" />
          {categoryLabel(l.category)}
        </Badge>
      ),
    },
    {
      cle: "vis",
      entete: "Visibilité",
      rendu: (l) => <StatutColore valeur={l.visibility} />,
    },
    {
      cle: "verif",
      entete: "Vérification",
      rendu: (l) => <StatutColore valeur={l.verification_level} />,
    },
    {
      cle: "commune",
      entete: "Commune",
      rendu: (l) =>
        l.commune_name ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <MapPin className="size-3 text-slate-400" />
            {l.commune_name}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      cle: "creee",
      entete: "Créée",
      rendu: (l) => (
        <span className="text-xs text-slate-600">{formatDateFr(l.created_at)}</span>
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setDetailId(l.id)}
                >
                  <InfoIcon className="size-3.5" />
                  Détail
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voir la fiche complète</TooltipContent>
            </Tooltip>
            {l.verification_level !== "verified" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    onClick={() =>
                      muter.mutate({
                        id: l.id,
                        patch: { verification_level: "verified" },
                      })
                    }
                  >
                    <ShieldCheck className="size-3.5" />
                    Valider
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marquer comme vérifiée</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                  onClick={() =>
                    muter.mutate({ id: l.id, patch: { status: "suspended" } })
                  }
                >
                  <PauseCircle className="size-3.5" />
                  Suspendre
                </Button>
              </TooltipTrigger>
              <TooltipContent>Suspendre temporairement</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  onClick={() =>
                    muter.mutate({ id: l.id, patch: { status: "deleted" } })
                  }
                >
                  <Trash2 className="size-3.5" />
                  Supprimer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Supprimer l'adresse</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ---------- En-tête de page ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <MapPinned className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Adresses
            </h1>
            <p className="text-sm text-slate-500">
              Modération, vérification et suivi des adresses Adresse GN.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void adresses.refetch()}
            disabled={adresses.isFetching}
          >
            <RefreshCw
              className={cn("size-4", adresses.isFetching && "animate-spin")}
            />
            Actualiser
          </Button>
        </div>
      </div>

      {/* ---------- KPI cards ---------- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Total"
          valeur={kpis.total}
          aide="Résultat filtré"
          icone={MapPinned}
          ton="slate"
        />
        <Kpi
          label="Publiques"
          valeur={kpis.publiques}
          aide="Visibles au public"
          icone={Eye}
          ton="emerald"
        />
        <Kpi
          label="Privées"
          valeur={kpis.privees}
          aide="Réservées au propriétaire"
          icone={EyeOff}
          ton="slate"
        />
        <Kpi
          label="Vérifiées"
          valeur={kpis.verifiees}
          aide="Contrôlées par un agent"
          icone={ShieldCheck}
          ton="emerald"
        />
        <Kpi
          label="Revendiquées"
          valeur={kpis.revendiquees}
          aide="En cours de validation"
          icone={ShieldAlert}
          ton="sky"
        />
        <Kpi
          label="Non vérifiées"
          valeur={kpis.nonVerifiees}
          aide="À examiner"
          icone={ShieldQuestion}
          ton="amber"
        />
      </div>

      {/* ---------- Filtres ---------- */}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label className="text-xs text-slate-600">
                Recherche (nom d'établissement)
              </Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={recherche}
                  onChange={(e) => {
                    setRecherche(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ex : Hôtel Kaloum…"
                  className="pl-8"
                />
              </div>
            </div>
            <Filtre
              label="Visibilité"
              valeur={visibilite}
              set={(v) => {
                setVisibilite(v);
                setPage(1);
              }}
              options={[...VISIBILITIES]}
            />
            <Filtre
              label="Vérification"
              valeur={verification}
              set={(v) => {
                setVerification(v);
                setPage(1);
              }}
              options={[...VERIFICATION_LEVELS]}
            />
            <div>
              <Label className="text-xs text-slate-600">Catégorie</Label>
              <Select
                value={categorie}
                onValueChange={(v) => {
                  setCategorie(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Toutes</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Commune</Label>
              <Select
                value={commune}
                onValueChange={(v) => {
                  setCommune(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Toutes</SelectItem>
                  {(zones.data?.communes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Table ---------- */}
      <Card className="overflow-hidden">
        <AdminTable
          colonnes={colonnes}
          lignes={rows}
          chargement={adresses.isLoading}
          total={adresses.data?.total ?? 0}
          page={page}
          pageSize={20}
          onPage={setPage}
        />
      </Card>

      {/* ---------- Sheet détail ---------- */}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <MapPinned className="size-5 text-emerald-600" />
              Fiche adresse
            </SheetTitle>
          </SheetHeader>
          {fiche.isLoading && (
            <div className="p-6 text-sm text-slate-500">Chargement…</div>
          )}
          {fiche.data && (
            <div className="space-y-5 px-1 py-5 text-sm">
              {/* En-tête fiche */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
                <p className="text-xs uppercase tracking-wider text-emerald-100">
                  Balise associée
                </p>
                <p className="mt-1 font-mono text-2xl font-bold">
                  {(fiche.data.adresse as any).beacons?.public_number ?? "—"}
                </p>
                <p className="mt-2 text-sm text-emerald-50">
                  {fiche.data.adresse.name ?? "Sans nom"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatutColore valeur={fiche.data.adresse.visibility} />
                  <StatutColore valeur={fiche.data.adresse.verification_level} />
                  {fiche.data.adresse.status && (
                    <StatutColore valeur={fiche.data.adresse.status} />
                  )}
                </div>
              </div>

              {/* Métadonnées */}
              <Section titre="Informations" icone={InfoIcon}>
                <div className="grid grid-cols-2 gap-3">
                  <Champ label="Nom" valeur={fiche.data.adresse.name ?? "—"} />
                  <Champ
                    label="Catégorie"
                    valeur={categoryLabel(fiche.data.adresse.category)}
                  />
                  <Champ
                    label="Visibilité"
                    valeur={statusLabel(fiche.data.adresse.visibility)}
                  />
                  <Champ
                    label="Vérification"
                    valeur={statusLabel(fiche.data.adresse.verification_level)}
                  />
                  <Champ
                    label="Statut"
                    valeur={statusLabel(fiche.data.adresse.status)}
                  />
                  <Champ
                    label="Commune"
                    valeur={(fiche.data.adresse as any).communes?.name ?? "—"}
                  />
                </div>
              </Section>

              {/* Coordonnées */}
              {fiche.data.adresse.point && (
                <Section titre="Localisation" icone={MapPin}>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <p className="text-xs text-slate-500">Coordonnées GPS</p>
                    <p className="mt-1 font-mono text-sm text-slate-900">
                      {fiche.data.adresse.point.lat.toFixed(6)},{" "}
                      {fiche.data.adresse.point.lng.toFixed(6)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        href={`https://www.openstreetmap.org/?mlat=${fiche.data.adresse.point.lat}&mlon=${fiche.data.adresse.point.lng}#map=18/${fiche.data.adresse.point.lat}/${fiche.data.adresse.point.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="size-3" />
                        OpenStreetMap
                      </a>
                      
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        href={`https://www.google.com/maps?q=${fiche.data.adresse.point.lat},${fiche.data.adresse.point.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="size-3" />
                        Google Maps
                      </a>
                    </div>
                  </div>
                </Section>
              )}

              {/* Actions rapides */}
              <Section titre="Actions rapides" icone={UserCog}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-slate-600">
                      Statut de l'adresse
                    </Label>
                    <Select
                      value={fiche.data.adresse.status ?? "active"}
                      onValueChange={(v) =>
                        muter.mutate({ id: detailId!, patch: { status: v } })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADDRESS_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">
                      Niveau de vérification
                    </Label>
                    <Select
                      value={fiche.data.adresse.verification_level ?? "unverified"}
                      onValueChange={(v) =>
                        muter.mutate({
                          id: detailId!,
                          patch: { verification_level: v },
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VERIFICATION_LEVELS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full sm:w-auto"
                  onClick={() => setOuvrirProprio(true)}
                >
                  <UserCog className="size-4" />
                  Réassigner le propriétaire
                </Button>
              </Section>

              {/* Historique */}
              <Section titre="Historique (journal d'audit)" icone={History}>
                {fiche.data.journal.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                    Aucun évènement enregistré.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fiche.data.journal.map((j) => (
                      <div
                        key={j.id}
                        className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-xs"
                      >
                        <div className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100">
                          <ClipboardList className="size-3 text-slate-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{j.action}</p>
                          <p className="text-slate-500">
                            {formatDateTimeFr(j.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ---------- Dialog réassignation ---------- */}
      <Dialog open={ouvrirProprio} onOpenChange={setOuvrirProprio}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <UserCog className="size-4" />
              </div>
              Réassigner le propriétaire
            </DialogTitle>
            <DialogDescription>
              Saisis l'email de l'utilisateur qui deviendra le nouveau propriétaire de
              cette adresse.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Email de l'utilisateur</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              placeholder="prenom.nom@exemple.gn"
            />
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              L'ancien propriétaire perdra ses droits sur cette adresse.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvrirProprio(false)}>
              Annuler
            </Button>
            <Button
              disabled={!email || muterProprio.isPending}
              onClick={() => muterProprio.mutate()}
              className="bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700"
            >
              {muterProprio.isPending ? "Réassignation…" : "Réassigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Petits composants                                                  */
/* ------------------------------------------------------------------ */

function Filtre({
  label,
  valeur,
  set,
  options,
}: {
  label: string;
  valeur: string;
  set: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <Label className="text-xs text-slate-600">{label}</Label>
      <Select value={valeur} onValueChange={set}>
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {statusLabel(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Section({
  titre,
  icone: Icone,
  children,
}: {
  titre: string;
  icone: React.ElementType;
  children: React.ReactNode;
}) {
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

function Champ({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{valeur}</p>
    </div>
  );
}
