import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building,
  ChevronRight,
  Compass,
  Download,
  Globe2,
  LayoutList,
  ListTree,
  Map as MapIcon,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
const KPI_TONES: Record
  KpiTone,
  { bg: string; ring: string; iconBg: string; iconText: string }
> = {
  sky: { bg: "bg-gradient-to-br from-sky-50 to-white", ring: "ring-sky-100", iconBg: "bg-sky-100", iconText: "text-sky-600" },
  emerald: { bg: "bg-gradient-to-br from-emerald-50 to-white", ring: "ring-emerald-100", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
  amber: { bg: "bg-gradient-to-br from-amber-50 to-white", ring: "ring-amber-100", iconBg: "bg-amber-100", iconText: "text-amber-600" },
  violet: { bg: "bg-gradient-to-br from-violet-50 to-white", ring: "ring-violet-100", iconBg: "bg-violet-100", iconText: "text-violet-600" },
  rose: { bg: "bg-gradient-to-br from-rose-50 to-white", ring: "ring-rose-100", iconBg: "bg-rose-100", iconText: "text-rose-600" },
  slate: { bg: "bg-gradient-to-br from-slate-50 to-white", ring: "ring-slate-200", iconBg: "bg-slate-100", iconText: "text-slate-600" },
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
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", t.iconBg, t.iconText)}>
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

  const [vue, setVue] = useState<"liste" | "arbre">("liste");
  const [niveau, setNiveau] = useState<Niveau>("commune");
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [parent, setParent] = useState("");

  const [rechRegion, setRechRegion] = useState("");
  const [rechCommune, setRechCommune] = useState("");
  const [rechDistrict, setRechDistrict] = useState("");
  const [rechArbre, setRechArbre] = useState("");

  const [ouvrirImport, setOuvrirImport] = useState(false);

  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["admin", "zones"] });

  const muter = useMutation({
    mutationFn: () =>
      enregistrer({
        data: {
          niveau,
          name: nom.trim(),
          code: code.trim() || null,
          parentId: parent || null,
          geojson: null,
        },
      }),
    onSuccess: () => {
      toast.success(`${labelNiveau(niveau)} enregistrée avec succès.`);
      setNom("");
      setCode("");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (v: { niveau: Niveau; id: string }) => supprimer({ data: v }),
    onSuccess: (_, v) => {
      toast.success(`${labelNiveau(v.niveau)} supprimée.`);
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
          <Badge variant="outline" className="font-mono text-xs">{l.code}</Badge>
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
      cle: "quartiers",
      entete: "Quartiers",
      rendu: (l) => {
        const ids = communes
          .filter((c: any) => c.region_id === l.id)
          .map((c: any) => c.id);
        return (
          <span className="text-xs text-slate-600">
            {districts.filter((d: any) => ids.includes(d.commune_id)).length}
          </span>
        );
      },
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
      cle: "region",
      entete: "Région",
      rendu: (l: any) => {
        const c = communes.find((x: any) => x.id === l.commune_id) as any;
        return (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <Globe2 className="size-3 text-violet-400" />
            {c ? nomRegion(c.region_id) : "—"}
          </span>
        );
      },
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
      {/* En-tête */}
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
              Découpage géographique de la Guinée : régions, communes et quartiers.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOuvrirImport(true)}
          >
            <Upload className="size-4" />
            Importer des quartiers
          </Button>
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

      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Régions" valeur={regions.length} aide="Découpage national" icone={Globe2} ton="violet" />
        <Kpi label="Communes" valeur={communes.length} aide="Subdivisions régionales" icone={Building} ton="sky" />
        <Kpi label="Quartiers" valeur={districts.length} aide="Découpage local" icone={MapPin} ton="emerald" />
      </div>

      {/* Layout principal */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden">
          {/* Toggle vue liste / arbre */}
          <div className="flex items-center justify-between border-b bg-slate-50/50 px-4 py-2">
            <div className="inline-flex rounded-lg border bg-white p-0.5">
              <button
                onClick={() => setVue("liste")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  vue === "liste"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <LayoutList className="size-3.5" />
                Liste
              </button>
              <button
                onClick={() => setVue("arbre")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  vue === "arbre"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <ListTree className="size-3.5" />
                Arborescence
              </button>
            </div>
            {vue === "arbre" && (
              <div className="w-64">
                <BarreRecherche
                  placeholder="Rechercher une zone…"
                  valeur={rechArbre}
                  set={setRechArbre}
                />
              </div>
            )}
          </div>

          {vue === "liste" ? (
            <Tabs defaultValue="regions" className="space-y-0">
              <div className="border-b bg-white px-4 py-3">
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="regions" className="gap-1.5">
                    <Globe2 className="size-3.5" />
                    Régions
                    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{regions.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="communes" className="gap-1.5">
                    <Building className="size-3.5" />
                    Communes
                    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{communes.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="districts" className="gap-1.5">
                    <MapPin className="size-3.5" />
                    Quartiers
                    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{districts.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="regions" className="mt-0 space-y-3 p-4">
                <BarreRecherche placeholder="Rechercher une région…" valeur={rechRegion} set={setRechRegion} />
                <AdminTable
                  colonnes={colonnesRegion}
                  lignes={regionsFiltrees as any[]}
                  chargement={zones.isLoading}
                  cle={(l) => l.id}
                />
              </TabsContent>

              <TabsContent value="communes" className="mt-0 space-y-3 p-4">
                <BarreRecherche placeholder="Rechercher une commune ou une région…" valeur={rechCommune} set={setRechCommune} />
                <AdminTable
                  colonnes={colonnesCommune as any}
                  lignes={communesFiltrees as any[]}
                  chargement={zones.isLoading}
                  cle={(l) => l.id}
                />
              </TabsContent>

              <TabsContent value="districts" className="mt-0 space-y-3 p-4">
                <BarreRecherche placeholder="Rechercher un quartier ou une commune…" valeur={rechDistrict} set={setRechDistrict} />
                <AdminTable
                  colonnes={colonnesDistrict as any}
                  lignes={districtsFiltres as any[]}
                  chargement={zones.isLoading}
                  cle={(l) => l.id}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <VueArbre
              regions={regions}
              communes={communes}
              districts={districts}
              recherche={rechArbre}
              onSupprimer={(niveau, id) => muterSuppression.mutate({ niveau, id })}
            />
          )}
        </Card>

        {/* Formulaire d'ajout */}
        <Card className="h-fit overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
                <Plus className="size-4" />
              </div>
              Ajouter une zone
            </CardTitle>
            <p className="text-xs text-slate-500">
              Choisis un niveau puis renseigne le nom de la zone.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div>
              <Label className="text-xs text-slate-600">Type de zone</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <BoutonNiveau
                  actif={niveau === "region"}
                  onClick={() => { setNiveau("region"); setParent(""); }}
                  icone={Globe2}
                  label="Région"
                  ton="violet"
                />
                <BoutonNiveau
                  actif={niveau === "commune"}
                  onClick={() => { setNiveau("commune"); setParent(""); }}
                  icone={Building}
                  label="Commune"
                  ton="sky"
                />
                <BoutonNiveau
                  actif={niveau === "district"}
                  onClick={() => { setNiveau("district"); setParent(""); }}
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
                <Label className="text-xs text-slate-600">Code court (3 lettres)</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="mt-1 font-mono"
                  placeholder="Ex : CKY"
                  maxLength={5}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Ce code apparaît dans les numéros de balises : GN-<b>CKY</b>-XXXXXX.
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
                    <SelectValue placeholder="Sélectionner" />
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

            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700"
              disabled={!nom || (niveau !== "region" && !parent) || muter.isPending}
              onClick={() => muter.mutate()}
            >
              <Save className="size-4" />
              {muter.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bloc information */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="flex items-start gap-3 py-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-600">
            <MapIcon className="size-4" />
          </div>
          <div className="text-xs text-slate-700">
            <p className="font-semibold text-slate-900">À propos du référentiel</p>
            <p className="mt-1 text-slate-600">
              La Guinée compte <strong>8 régions administratives</strong> et
              <strong> 33 préfectures</strong>, auxquelles s'ajoutent les{" "}
              <strong>5 communes urbaines de Conakry</strong>. Les quartiers hors
              Conakry peuvent être importés en lot via un fichier CSV.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dialogue import CSV */}
      <ImportCsvDialog
        ouvert={ouvrirImport}
        onFerme={() => setOuvrirImport(false)}
        communes={communes}
        onImporter={async (paires) => {
          let ok = 0;
          let echec = 0;
          for (const p of paires) {
            const commune = communes.find(
              (c: any) => c.name.toLowerCase() === p.commune.toLowerCase(),
            ) as any;
            if (!commune) {
              echec++;
              continue;
            }
            try {
              await enregistrer({
                data: {
                  niveau: "district",
                  name: p.quartier,
                  code: null,
                  parentId: commune.id,
                  geojson: null,
                },
              });
              ok++;
            } catch {
              echec++;
            }
          }
          invalider();
          if (ok > 0) toast.success(`${ok} quartier(s) importé(s).`);
          if (echec > 0) toast.error(`${echec} ligne(s) ignorée(s) (commune introuvable).`);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vue arborescente                                                   */
/* ------------------------------------------------------------------ */

function VueArbre({
  regions,
  communes,
  districts,
  recherche,
  onSupprimer,
}: {
  regions: any[];
  communes: any[];
  districts: any[];
  recherche: string;
  onSupprimer: (niveau: Niveau, id: string) => void;
}) {
  const [regionsOuvertes, setRegionsOuvertes] = useState<Set<string>>(new Set());
  const [communesOuvertes, setCommunesOuvertes] = useState<Set<string>>(new Set());

  const q = recherche.toLowerCase().trim();
  const filtrer = (nom: string) => !q || nom.toLowerCase().includes(q);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const nv = new Set(set);
    nv.has(id) ? nv.delete(id) : nv.add(id);
    setter(nv);
  };

  if (regions.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Aucune zone enregistrée. Utilise le formulaire à droite pour commencer.
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto p-2">
      {regions.map((r) => {
        const communesR = communes.filter((c: any) => c.region_id === r.id);
        const ouvert = regionsOuvertes.has(r.id) || !!q;
        const visible =
          filtrer(r.name) ||
          communesR.some((c: any) => filtrer(c.name)) ||
          districts.some((d: any) => {
            const c = communesR.find((x: any) => x.id === d.commune_id);
            return c && filtrer(d.name);
          });
        if (!visible) return null;

        return (
          <div key={r.id} className="mb-1">
            <button
              onClick={() => toggle(regionsOuvertes, r.id, setRegionsOuvertes)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-50"
            >
              <ChevronRight
                className={cn("size-4 text-slate-400 transition-transform", ouvert && "rotate-90")}
              />
              <Globe2 className="size-4 text-violet-500" />
              <span className="font-semibold text-slate-900">{r.name}</span>
              {r.code && (
                <Badge variant="outline" className="ml-1 font-mono text-[10px]">
                  {r.code}
                </Badge>
              )}
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {communesR.length} communes
              </Badge>
            </button>

            {ouvert && (
              <div className="ml-6 border-l border-slate-100 pl-2">
                {communesR.map((c: any) => {
                  const districtsC = districts.filter((d: any) => d.commune_id === c.id);
                  const ouvertC = communesOuvertes.has(c.id) || !!q;
                  const visibleC =
                    filtrer(c.name) ||
                    districtsC.some((d: any) => filtrer(d.name));
                  if (!visibleC) return null;

                  return (
                    <div key={c.id} className="mt-0.5">
                      <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                        <button
                          onClick={() => toggle(communesOuvertes, c.id, setCommunesOuvertes)}
                          className="flex flex-1 items-center gap-2"
                        >
                          <ChevronRight
                            className={cn(
                              "size-3.5 text-slate-400 transition-transform",
                              ouvertC && "rotate-90",
                            )}
                          />
                          <Building className="size-3.5 text-sky-500" />
                          <span className="text-sm text-slate-800">{c.name}</span>
                          {districtsC.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">
                              {districtsC.length}
                            </Badge>
                          )}
                        </button>
                        <button
                          onClick={() => onSupprimer("commune", c.id)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="size-3.5 text-rose-500 hover:text-rose-700" />
                        </button>
                      </div>

                      {ouvertC && districtsC.length > 0 && (
                        <div className="ml-6 border-l border-slate-100 pl-2">
                          {districtsC
                            .filter((d: any) => filtrer(d.name))
                            .map((d: any) => (
                              <div
                                key={d.id}
                                className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <MapPin className="size-3 text-emerald-500" />
                                <span>{d.name}</span>
                                <button
                                  onClick={() => onSupprimer("district", d.id)}
                                  className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                                  aria-label="Supprimer"
                                >
                                  <Trash2 className="size-3 text-rose-500 hover:text-rose-700" />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dialogue import CSV                                                */
/* ------------------------------------------------------------------ */

function ImportCsvDialog({
  ouvert,
  onFerme,
  communes,
  onImporter,
}: {
  ouvert: boolean;
  onFerme: () => void;
  communes: any[];
  onImporter: (paires: { commune: string; quartier: string }[]) => Promise<void>;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [aperçu, setAperçu] = useState<{ commune: string; quartier: string }[]>([]);
  const [enCours, setEnCours] = useState(false);

  const analyser = async (f: File) => {
    const texte = await f.text();
    const lignes = texte.split(/\r?\n/).filter((l) => l.trim());
    const resultat: { commune: string; quartier: string }[] = [];
    // Ignorer l'en-tête si présent
    const debut = lignes[0]?.toLowerCase().includes("commune") ? 1 : 0;
    for (let i = debut; i < lignes.length; i++) {
      const cols = lignes[i].split(",").map((c) => c.trim());
      if (cols.length >= 2 && cols[0] && cols[1]) {
        resultat.push({ commune: cols[0], quartier: cols[1] });
      }
    }
    setAperçu(resultat);
  };

  const telechargerModele = () => {
    const csv = "commune,quartier\nKindia,Kindia Centre\nKindia,Manquepas\nBoké,Kolaboui";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele_quartiers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const communesNoms = new Set(communes.map((c: any) => c.name.toLowerCase()));
  const introuvables = aperçu.filter(
    (p) => !communesNoms.has(p.commune.toLowerCase()),
  );

  return (
    <Dialog open={ouvert} onOpenChange={onFerme}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Upload className="size-4" />
            </div>
            Importer des quartiers depuis un fichier CSV
          </DialogTitle>
          <DialogDescription>
            Le fichier doit contenir deux colonnes : <strong>commune</strong> et{" "}
            <strong>quartier</strong>. Les communes doivent déjà exister dans le
            référentiel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={telechargerModele}>
              <Download className="size-4" />
              Télécharger le modèle
            </Button>
          </div>

          <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFichier(f);
                  void analyser(f);
                }
              }}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="mx-auto size-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                {fichier ? fichier.name : "Cliquer pour choisir un fichier CSV"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Format .csv uniquement</p>
            </label>
          </div>

          {aperçu.length > 0 && (
            <>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">
                  {aperçu.length} ligne(s) détectée(s)
                </p>
                {introuvables.length > 0 && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    {introuvables.length} ligne(s) ignorée(s) — commune introuvable dans le référentiel.
                  </p>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2 text-left font-medium">Commune</th>
                      <th className="p-2 text-left font-medium">Quartier</th>
                      <th className="p-2 text-left font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aperçu.slice(0, 100).map((p, i) => {
                      const trouve = communesNoms.has(p.commune.toLowerCase());
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2">{p.commune}</td>
                          <td className="p-2">{p.quartier}</td>
                          <td className="p-2">
                            {trouve ? (
                              <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-700">Ignoré</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {aperçu.length > 100 && (
                      <tr>
                        <td colSpan={3} className="p-2 text-center text-slate-500">
                          … et {aperçu.length - 100} autres.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFerme}>
            Annuler
          </Button>
          <Button
            disabled={aperçu.length === 0 || enCours}
            onClick={async () => {
              setEnCours(true);
              await onImporter(aperçu.filter((p) => communesNoms.has(p.commune.toLowerCase())));
              setEnCours(false);
              setFichier(null);
              setAperçu([]);
              onFerme();
            }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
          >
            {enCours ? "Import en cours…" : `Importer ${aperçu.filter((p) => communesNoms.has(p.commune.toLowerCase())).length} quartier(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    violet: { actif: "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500", icon: "text-violet-600" },
    sky: { actif: "border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-500", icon: "text-sky-600" },
    emerald: { actif: "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500", icon: "text-emerald-600" },
  }[ton];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-all",
        actif ? styles.actif : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <Icone className={cn("size-4", actif && styles.icon)} />
      {label}
    </button>
  );
}

function labelNiveau(n: Niveau): string {
  return n === "region" ? "Région" : n === "commune" ? "Commune" : "Quartier";
}
