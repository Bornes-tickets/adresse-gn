import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building,
  Compass,
  FileCode,
  Globe2,
  Layers,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminDeleteZone, adminSaveZone, adminZones } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/zones")({
  head: () => ({
    meta: [
      { title: "Zones administratives — Administration Adresse GN" },
      {
        name: "description",
        content: "Régions, communes et quartiers du référentiel Adresse GN.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminZones,
});

type Niveau = "region" | "commune" | "district";

/* ------------------------------------------------------------------ */
/*  KPI                                                                */
/* ------------------------------------------------------------------ */

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

function AdminZones() {
  const lister = useServerFn(adminZones);
  const enregistrer = useServerFn(adminSaveZone);
  const supprimer = useServerFn(adminDeleteZone);
  const qc = useQueryClient();

  const [niveau, setNiveau] = useState<Niveau>("commune");
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [parent, setParent] = useState("");
  const [geojson, setGeojson] = useState("");

  // Recherche par onglet
  const [rechRegion, setRechRegion] = useState("");
  const [rechCommune, setRechCommune] = useState("");
  const [rechDistrict, setRechDistrict] = useState("");

  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["admin", "zones"] });

  const muter = useMutation({
    mutationFn: () =>
      enregistrer({
        data: {
          niveau,
          name: nom,
          code: code || null,
          parentId: parent || null,
          geojson: geojson.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Zone enregistrée.");
      setNom("");
      setCode("");
      setGeojson("");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (v: { niveau: Niveau; id: string }) => supprimer({ data: v }),
    onSuccess: () => {
      toast.success("Zone supprimée.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nomRegion = (id: string | null) =>
    (zones.data?.regions ?? []).find((r) => r.id === id)?.name ?? "—";
  const nomCommune = (id: string | null) =>
    (zones.data?.communes ?? []).find((c) => c.id === id)?.name ?? "—";

  const regions = zones.data?.regions ?? [];
  const communes = zones.data?.communes ?? [];
  const districts = zones.data?.districts ?? [];

  const regionsFiltrees = useMemo(
    () =>
      regions.filter((r) =>
        [r.name, r.code].some((v) =>
          (v ?? "").toLowerCase().includes(rechRegion.toLowerCase()),
        ),
      ),
    [regions, rechRegion],
  );
  const communesFiltrees = useMemo(
    () =>
      communes.filter((c: any) =>
        [c.name, nomRegion(c.region_id)].some((v: string) =>
          (v ?? "").toLowerCase().includes(rechCommune.toLowerCase()),
        ),
      ),
    [communes, rechCommune, regions],
  );
  const districtsFiltres = useMemo(
    () =>
      districts.filter((d: any) =>
        [d.name, nomCommune(d.commune_id)].some((v: string) =>
          (v ?? "").toLowerCase().includes(rechDistrict.toLowerCase()),
        ),
      ),
    [districts, rechDistrict, communes],
  );

  const colonnesRegion: Colonne<{ id: string; name: string; code: string }>[] = [
    {
      cle: "nom",
      entete: "Nom",
      rendu: (l) => (
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-violet-100 text-violet-600">
            <Globe2 className="size-3.5" />
          </div>
          <span className="font-medium text-slate-900">{l.name}</span>
        </div>
      ),
    },
    {
      cle: "code",
      entete: "Code",
      rendu: (l) =>
        l.code ? (
          <Badge variant="outline" className="font-mono text-xs">
            {l.code}
          </Badge>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      cle: "communes",
      entete: "Communes",
      rendu: (l) => (
        <span className="text-xs text-slate-600">
          {communes.filter((c: any) => c.region_id === l.id).length}
        </span>
      ),
    },
    {
      cle: "actions",
      entete: "",
      rendu: (l) => (
        <ActionSuppression
          onClick={() => muterSuppression.mutate({ niveau: "region", id: l.id })}
        />
      ),
    },
  ];

  const colonnesCommune = [
    {
      cle: "nom",
      entete: "Nom",
      rendu: (l: any) => (
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-sky-100 text-sky-600">
            <Building className="size-3.5" />
          </div>
          <span className="font-medium text-slate-900">{l.name}</span>
        </div>
      ),
    },
    {
      cle: "region",
      entete: "Région",
      rendu: (l: any) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          <Globe2 className="size-3 text-violet-400" />
          {nomRegion(l.region_id)}
        </span>
      ),
    },
    {
      cle: "quartiers",
      entete: "Quartiers",
      rendu: (l: any) => (
        <span className="text-xs text-slate-600">
          {districts.filter((d: any) => d.commune_id === l.id).length}
        </span>
      ),
    },
    {
      cle: "actions",
      entete: "",
      rendu: (l: any) => (
        <ActionSuppression
          onClick={() => muterSuppression.mutate({ niveau: "commune", id: l.id })}
        />
      ),
    },
  ];

  const colonnesDistrict = [
    {
      cle: "nom",
      entete: "Nom",
      rendu: (l: any) => (
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-emerald-100 text-emerald-600">
            <MapPin className="size-3.5" />
          </div>
          <span className="font-medium text-slate-900">{l.name}</span>
        </div>
      ),
    },
    {
      cle: "commune",
      entete: "Commune",
      rendu: (l: any) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          <Building className="size-3 text-sky-400" />
          {nomCommune(l.commune_id)}
        </span>
      ),
    },
    {
      cle: "actions",
      entete: "",
      rendu: (l: any) => (
        <ActionSuppression
          onClick={() => muterSuppression.mutate({ niveau: "district", id: l.id })}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ---------- En-tête de page ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm">
            <Compass className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Zones administratives
            </h1>
            <p className="text-sm text-slate-500">
              Référentiel géographique : régions, communes et quartiers.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void zones.refetch()}
            disabled={zones.isFetching}
          >
            <RefreshCw className={cn("size-4", zones.isFetching && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* ---------- KPI ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label="Régions"
          valeur={regions.length}
          aide="Découpage national"
          icone={Globe2}
          ton="violet"
        />
        <Kpi
          label="Communes"
          valeur={communes.length}
          aide="Subdivisions régionales"
          icone={Building}
          ton="sky"
        />
        <Kpi
          label="Quartiers"
          valeur={districts.length}
          aide="Découpage local"
          icone={MapPin}
          ton="emerald"
        />
      </div>

      {/* ---------- Layout principal ---------- */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Onglets tables */}
        <Card className="overflow-hidden">
          <Tabs defaultValue="communes" className="space-y-0">
            <div className="border-b bg-slate-50/50 px-4 py-3">
              <TabsList className="bg-white">
                <TabsTrigger value="regions" className="gap-1.5">
                  <Globe2 className="size-3.5" />
                  Régions
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                    {regions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="communes" className="gap-1.5">
                  <Building className="size-3.5" />
                  Communes
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                    {communes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="districts" className="gap-1.5">
                  <MapPin className="size-3.5" />
                  Quartiers
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                    {districts.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="regions" className="mt-0 space-y-3 p-4">
              <BarreRecherche
                placeholder="Rechercher une région (nom ou code)…"
                valeur={rechRegion}
                set={setRechRegion}
              />
              <AdminTable
                colonnes={colonnesRegion}
                lignes={regionsFiltrees as any[]}
                chargement={zones.isLoading}
                cle={(l) => l.id}
              />
            </TabsContent>

            <TabsContent value="communes" className="mt-0 space-y-3 p-4">
              <BarreRecherche
                placeholder="Rechercher une commune (nom ou région)…"
                valeur={rechCommune}
                set={setRechCommune}
              />
              <AdminTable
                colonnes={colonnesCommune as any}
                lignes={communesFiltrees as any[]}
                chargement={zones.isLoading}
                cle={(l) => l.id}
              />
            </TabsContent>

            <TabsContent value="districts" className="mt-0 space-y-3 p-4">
              <BarreRecherche
                placeholder="Rechercher un quartier (nom ou commune)…"
                valeur={rechDistrict}
                set={setRechDistrict}
              />
              <AdminTable
                colonnes={colonnesDistrict as any}
                lignes={districtsFiltres as any[]}
                chargement={zones.isLoading}
                cle={(l) => l.id}
              />
            </TabsContent>
          </Tabs>
        </Card>

        {/* Formulaire ajout / édition */}
        <Card className="h-fit overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
                <Plus className="size-4" />
              </div>
              Ajouter une zone
            </CardTitle>
            <p className="text-xs text-slate-500">
              Sélectionne le niveau puis renseigne les informations.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {/* Niveau via boutons visuels */}
            <div>
              <Label className="text-xs text-slate-600">Niveau administratif</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <BoutonNiveau
                  actif={niveau === "region"}
                  onClick={() => {
                    setNiveau("region");
                    setParent("");
                  }}
                  icone={Globe2}
                  label="Région"
                  ton="violet"
                />
                <BoutonNiveau
                  actif={niveau === "commune"}
                  onClick={() => {
                    setNiveau("commune");
                    setParent("");
                  }}
                  icone={Building}
                  label="Commune"
                  ton="sky"
                />
                <BoutonNiveau
                  actif={niveau === "district"}
                  onClick={() => {
                    setNiveau("district");
                    setParent("");
                  }}
                  icone={MapPin}
                  label="Quartier"
                  ton="emerald"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-600">Nom</Label>
              <Input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="mt-1"
                placeholder={
                  niveau === "region"
                    ? "Ex : Conakry"
                    : niveau === "commune"
                      ? "Ex : Kaloum"
                      : "Ex : Sandervalia"
                }
              />
            </div>

            {niveau === "region" && (
              <div>
                <Label className="text-xs text-slate-600">Code (3 lettres)</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="mt-1 font-mono"
                  placeholder="Ex : CKY"
                  maxLength={5}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Utilisé dans les numéros de balises (GN-<b>CKY</b>-XXXXXX).
                </p>
              </div>
            )}

            {niveau !== "region" && (
              <div>
                <Label className="text-xs text-slate-600">
                  {niveau === "commune" ? "Région parente" : "Commune parente"}
                </Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {(niveau === "commune" ? regions : communes).map((z: any) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {niveau !== "region" && (
              <div>
                <Label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <FileCode className="size-3" />
                  Contour GeoJSON (Polygon, optionnel)
                </Label>
                <Textarea
                  rows={6}
                  value={geojson}
                  onChange={(e) => setGeojson(e.target.value)}
                  placeholder='{"type":"Polygon","coordinates":[[[-13.7,9.5],…]]}'
                  className="mt-1 font-mono text-xs"
                />
                <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500">
                  <MapIcon className="mt-0.5 size-3 shrink-0" />
                  Sert à délimiter la zone sur la carte publique.
                </p>
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700"
              disabled={!nom || (niveau !== "region" && !parent) || muter.isPending}
              onClick={() => muter.mutate()}
            >
              <Save className="size-4" />
              {muter.isPending ? "Enregistrement…" : "Enregistrer la zone"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Aide / info ---------- */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="flex items-start gap-3 py-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
            <AlertTriangle className="size-4" />
          </div>
          <div className="text-xs text-amber-900">
            <p className="font-semibold">Bonnes pratiques</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800">
              <li>
                La suppression d'une région supprime en cascade toutes ses communes et
                quartiers.
              </li>
              <li>
                Le code de région est <strong>immuable</strong> une fois des balises
                générées : ne le change pas après le premier lot.
              </li>
              <li>
                Les contours GeoJSON doivent être des <code>Polygon</code> valides —
                utilise <a href="https://geojson.io" target="_blank" rel="noreferrer" className="underline">geojson.io</a> pour les dessiner.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Petits composants                                                  */
/* ------------------------------------------------------------------ */

function BarreRecherche({
  placeholder,
  valeur,
  set,
}: {
  placeholder: string;
  valeur: string;
  set: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={valeur}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
      {valeur && (
        <button
          type="button"
          onClick={() => set("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Effacer"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function ActionSuppression({ onClick }: { onClick: () => void }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={onClick}
          >
            <Trash2 className="size-3.5" />
            Supprimer
          </Button>
        </TooltipTrigger>
        <TooltipContent>Supprimer définitivement</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BoutonNiveau({
  actif,
  onClick,
  icone: Icone,
  label,
  ton,
}: {
  actif: boolean;
  onClick: () => void;
  icone: React.ElementType;
  label: string;
  ton: "violet" | "sky" | "emerald";
}) {
  const styles = {
    violet: {
      actif: "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500",
      icon: "text-violet-600",
    },
    sky: {
      actif: "border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-500",
      icon: "text-sky-600",
    },
    emerald: {
      actif: "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500",
      icon: "text-emerald-600",
    },
  }[ton];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-all",
        actif
          ? styles.actif
          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <Icone className={cn("size-4", actif && styles.icon)} />
      {label}
    </button>
  );
}
