import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ElementType } from "react";
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

import { AdminTable } from "@/components/admin/AdminTable";
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard/zones")({
  head: () => ({
    meta: [
      { title: "Zones administratives — Administration Adresse GN" },
      {
        name: "description",
        content:
          "Référentiel national Adresse GN : régions, préfectures, communes, quartiers/districts et secteurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminZones,
});

type Niveau = "region" | "prefecture" | "commune" | "district" | "sector";
type DistrictKind = "quartier" | "district";
type CommuneType = "urban" | "rural";

type RegionRow = {
  id: string;
  name: string;
  slug: string | null;
  code: string | null;
  stat_code: string | null;
  source: string | null;
  source_name: string | null;
  geojson: unknown;
  is_active: boolean;
};

type PrefectureRow = {
  id: string;
  region_id: string;
  name: string;
  slug: string;
  code: string | null;
  stat_code: string | null;
  is_special_zone: boolean;
  source: string | null;
  source_name: string | null;
  geojson: unknown;
  is_active: boolean;
};

type CommuneRow = {
  id: string;
  region_id: string | null;
  prefecture_id: string | null;
  name: string;
  slug: string | null;
  code: string | null;
  stat_code: string | null;
  administrative_type: "urban" | "rural" | null;
  source: string | null;
  source_name: string | null;
  geojson: unknown;
  is_active: boolean;
};

type DistrictRow = {
  id: string;
  commune_id: string;
  name: string;
  slug: string | null;
  kind: DistrictKind;
  code: string | null;
  source: string | null;
  source_name: string | null;
  source_year?: number | null;
  verification_status?: string | null;
  official_reference?: string | null;
  verified_at?: string | null;
  geojson: unknown;
  is_active: boolean;
};

type SectorRow = {
  id: string;
  district_id: string;
  name: string;
  slug: string;
  code: string | null;
  source: string | null;
  source_name: string | null;
  source_year?: number | null;
  verification_status?: string | null;
  official_reference?: string | null;
  verified_at?: string | null;
  geojson: unknown;
  is_active: boolean;
};

type GeoData = {
  regions: RegionRow[];
  prefectures: PrefectureRow[];
  communes: CommuneRow[];
  districts: DistrictRow[];
  sectors: SectorRow[];
};

type ImportRow = {
  commune_stat_code: string;
  region: string;
  prefecture: string;
  commune: string;
  quartier: string;
  type_quartier: DistrictKind;
  secteur: string;
  official_reference: string;
};

type CurrentGeoSummary = {
  target_quartiers_districts: number;
  current_quartiers_districts: number;
  remaining_quartiers_districts: number;
  current_sectors: number;
  communities_with_current_localities: number;
  archived_quartiers_districts: number;
  archived_sectors: number;
  stored_quartiers_districts: number;
  stored_sectors: number;
};

const EMPTY_GEO: GeoData = {
  regions: [],
  prefectures: [],
  communes: [],
  districts: [],
  sectors: [],
};

/**
 * Les RPC sont créées par la migration Supabase fournie avec ce fichier.
 * Le cast garde ce fichier utilisable avant la régénération des types Supabase.
 * Après `supabase gen types`, tu peux remplacer `database` par `supabase`.
 */
const database = supabase as any;

async function fetchGeoZones(): Promise<GeoData> {
  const { data, error } = await database.rpc("admin_geo_zones");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") {
    return EMPTY_GEO;
  }

  return {
    regions: Array.isArray(data.regions) ? data.regions : [],
    prefectures: Array.isArray(data.prefectures) ? data.prefectures : [],
    communes: Array.isArray(data.communes) ? data.communes : [],
    districts: Array.isArray(data.districts) ? data.districts : [],
    sectors: Array.isArray(data.sectors) ? data.sectors : [],
  };
}

async function saveGeoZone(input: {
  niveau: Niveau;
  name: string;
  parentId: string | null;
  code: string | null;
  kind: DistrictKind | CommuneType | null;
}): Promise<string> {
  const { data, error } = await database.rpc("admin_save_geo_zone", {
    p_niveau: input.niveau,
    p_name: input.name,
    p_parent_id: input.parentId,
    p_code: input.code,
    p_kind: input.kind,
    p_geojson: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

async function deleteGeoZone(niveau: Niveau, id: string): Promise<void> {
  const { error } = await database.rpc("admin_delete_geo_zone", {
    p_niveau: niveau,
    p_id: id,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function importGeoRows(rows: ImportRow[]): Promise<{
  rows_received: number;
  quartiers_created: number;
  quartiers_updated: number;
  sectors_created: number;
  sectors_updated: number;
  rows_skipped: number;
}> {
  const { data, error } = await database.rpc("admin_import_current_geo_rows", {
    p_rows: rows,
    p_source_reference: "Arrêté A/2025/447/MATD/CAB/SGG — annexe vérifiée",
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows_received: Number(data?.rows_received ?? rows.length),
    quartiers_created: Number(data?.quartiers_created ?? 0),
    quartiers_updated: Number(data?.quartiers_updated ?? 0),
    sectors_created: Number(data?.sectors_created ?? 0),
    sectors_updated: Number(data?.sectors_updated ?? 0),
    rows_skipped: Number(data?.rows_skipped ?? 0),
  };
}

async function fetchCurrentGeoSummary(): Promise<CurrentGeoSummary> {
  const { data, error } = await database.rpc("geo_current_summary");

  if (error) {
    throw new Error(error.message);
  }

  return {
    target_quartiers_districts: Number(data?.target_quartiers_districts ?? 4865),
    current_quartiers_districts: Number(data?.current_quartiers_districts ?? 0),
    remaining_quartiers_districts: Number(data?.remaining_quartiers_districts ?? 4865),
    current_sectors: Number(data?.current_sectors ?? 0),
    communities_with_current_localities: Number(
      data?.communities_with_current_localities ?? 0,
    ),
    archived_quartiers_districts: Number(data?.archived_quartiers_districts ?? 0),
    archived_sectors: Number(data?.archived_sectors ?? 0),
    stored_quartiers_districts: Number(data?.stored_quartiers_districts ?? 0),
    stored_sectors: Number(data?.stored_sectors ?? 0),
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminZones() {
  const queryClient = useQueryClient();

  const [vue, setVue] = useState<"liste" | "arbre">("liste");
  const [niveau, setNiveau] = useState<Niveau>("commune");
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [parent, setParent] = useState("");
  const [kind, setKind] = useState<DistrictKind>("quartier");
  const [communeType, setCommuneType] = useState<CommuneType>("urban");
  const [ouvrirImport, setOuvrirImport] = useState(false);

  const [recherches, setRecherches] = useState<Record<Niveau, string>>({
    region: "",
    prefecture: "",
    commune: "",
    district: "",
    sector: "",
  });
  const [rechArbre, setRechArbre] = useState("");

  const zones = useQuery({
    queryKey: ["admin", "geo-zones"],
    queryFn: fetchGeoZones,
  });

  const currentSummary = useQuery({
    queryKey: ["admin", "geo-current-summary"],
    queryFn: fetchCurrentGeoSummary,
  });

  const data = zones.data ?? EMPTY_GEO;
  const { regions, prefectures, communes, districts, sectors } = data;

  const currentDistrictCount =
    currentSummary.data?.current_quartiers_districts ?? districts.length;
  const targetDistrictCount =
    currentSummary.data?.target_quartiers_districts ?? 4865;
  const currentSectorCount =
    currentSummary.data?.current_sectors ?? sectors.length;
  const archivedDistrictCount =
    currentSummary.data?.archived_quartiers_districts ?? 0;
  const archivedSectorCount = currentSummary.data?.archived_sectors ?? 0;
  const storedDistrictCount =
    currentSummary.data?.stored_quartiers_districts ?? districts.length;
  const storedSectorCount =
    currentSummary.data?.stored_sectors ?? sectors.length;

  const invalider = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "geo-zones"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "geo-current-summary"] }),
    ]);
  };

  const mutationSave = useMutation({
    mutationFn: () =>
      saveGeoZone({
        niveau,
        name: nom.trim(),
        parentId: parent || null,
        code: code.trim() || null,
        kind:
          niveau === "district"
            ? kind
            : niveau === "commune"
              ? communeType
              : null,
      }),
    onSuccess: async () => {
      toast.success(`${labelNiveau(niveau)} enregistré(e) avec succès.`);
      setNom("");
      setCode("");
      await invalider();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mutationDelete = useMutation({
    mutationFn: (value: { niveau: Niveau; id: string }) =>
      deleteGeoZone(value.niveau, value.id),
    onSuccess: async (_, value) => {
      toast.success(`${labelNiveau(value.niveau)} supprimé(e).`);
      await invalider();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const nomRegion = (id: string | null | undefined) =>
    regions.find((row) => row.id === id)?.name ?? "—";

  const nomPrefecture = (id: string | null | undefined) =>
    prefectures.find((row) => row.id === id)?.name ?? "—";

  const nomCommune = (id: string | null | undefined) =>
    communes.find((row) => row.id === id)?.name ?? "—";

  const nomDistrict = (id: string | null | undefined) =>
    districts.find((row) => row.id === id)?.name ?? "—";

  const regionDeCommune = (commune: CommuneRow) =>
    commune.region_id ??
    prefectures.find((p) => p.id === commune.prefecture_id)?.region_id ??
    null;

  const regionDeDistrict = (district: DistrictRow) => {
    const commune = communes.find((c) => c.id === district.commune_id);
    return commune ? regionDeCommune(commune) : null;
  };

  const prefectureDeDistrict = (district: DistrictRow) =>
    communes.find((c) => c.id === district.commune_id)?.prefecture_id ?? null;

  const communeDeSector = (sector: SectorRow) =>
    districts.find((d) => d.id === sector.district_id)?.commune_id ?? null;

  const q = (n: Niveau) => normalize(recherches[n]);

  const regionsFiltrees = useMemo(() => {
    const search = q("region");
    if (!search) return regions;
    return regions.filter((r) =>
      [r.name, r.code, r.stat_code].some((v) => normalize(v).includes(search)),
    );
  }, [regions, recherches.region]);

  const prefecturesFiltrees = useMemo(() => {
    const search = q("prefecture");
    if (!search) return prefectures;
    return prefectures.filter((p) =>
      [p.name, p.code, p.stat_code, nomRegion(p.region_id)].some((v) =>
        normalize(v).includes(search),
      ),
    );
  }, [prefectures, regions, recherches.prefecture]);

  const communesFiltrees = useMemo(() => {
    const search = q("commune");
    if (!search) return communes;
    return communes.filter((c) =>
      [
        c.name,
        c.code,
        c.stat_code,
        nomPrefecture(c.prefecture_id),
        nomRegion(regionDeCommune(c)),
      ].some((v) => normalize(v).includes(search)),
    );
  }, [communes, prefectures, regions, recherches.commune]);

  const districtsFiltres = useMemo(() => {
    const search = q("district");
    if (!search) return districts;
    return districts.filter((d) =>
      [
        d.name,
        d.kind,
        d.code,
        nomCommune(d.commune_id),
        nomPrefecture(prefectureDeDistrict(d)),
        nomRegion(regionDeDistrict(d)),
      ].some((v) => normalize(v).includes(search)),
    );
  }, [districts, communes, prefectures, regions, recherches.district]);

  const sectorsFiltres = useMemo(() => {
    const search = q("sector");
    if (!search) return sectors;
    return sectors.filter((s) => {
      const communeId = communeDeSector(s);
      const district = districts.find((d) => d.id === s.district_id);
      return [
        s.name,
        s.code,
        nomDistrict(s.district_id),
        nomCommune(communeId),
        district ? nomPrefecture(prefectureDeDistrict(district)) : "",
      ].some((v) => normalize(v).includes(search));
    });
  }, [sectors, districts, communes, prefectures, recherches.sector]);

  const demanderSuppression = (niveauASupprimer: Niveau, id: string, name: string) => {
    const cascade =
      niveauASupprimer === "region"
        ? "Toutes les préfectures, communes, quartiers/districts et secteurs enfants seront également supprimés."
        : niveauASupprimer === "prefecture"
          ? "Toutes les communes, quartiers/districts et secteurs enfants seront également supprimés."
          : niveauASupprimer === "commune"
            ? "Tous les quartiers/districts et secteurs enfants seront également supprimés."
            : niveauASupprimer === "district"
              ? "Tous les secteurs enfants seront également supprimés."
              : "";

    if (!window.confirm(`Supprimer « ${name} » ?${cascade ? `\n\n${cascade}` : ""}`)) {
      return;
    }

    mutationDelete.mutate({ niveau: niveauASupprimer, id });
  };

  const parentOptions =
    niveau === "prefecture"
      ? regions
      : niveau === "commune"
        ? prefectures
        : niveau === "district"
          ? communes
          : niveau === "sector"
            ? districts
            : [];

  const parentLabel =
    niveau === "prefecture"
      ? "Région parente"
      : niveau === "commune"
        ? "Préfecture / zone spéciale parente"
        : niveau === "district"
          ? "Commune parente"
          : niveau === "sector"
            ? "Quartier / district parent"
            : "";

  const colonnesRegion = [
    {
      cle: "nom",
      entete: "Région",
      rendu: (row: RegionRow) => (
        <ZoneName icon={Globe2} tone="violet" name={row.name} />
      ),
    },
    {
      cle: "code",
      entete: "Code Adresse GN",
      rendu: (row: RegionRow) => <CodeBadge value={row.code} />,
    },
    {
      cle: "stat",
      entete: "Code statistique",
      rendu: (row: RegionRow) => <CodeBadge value={row.stat_code} />,
    },
    {
      cle: "prefectures",
      entete: "Préfectures",
      rendu: (row: RegionRow) =>
        prefectures.filter((p) => p.region_id === row.id).length,
    },
    {
      cle: "communes",
      entete: "Communes",
      rendu: (row: RegionRow) =>
        communes.filter((c) => regionDeCommune(c) === row.id).length,
    },
    {
      cle: "actions",
      entete: "",
      rendu: (row: RegionRow) => (
        <ActionSuppression
          disabled={mutationDelete.isPending}
          onClick={() => demanderSuppression("region", row.id, row.name)}
        />
      ),
    },
  ];

  const colonnesPrefecture = [
    {
      cle: "nom",
      entete: "Préfecture / zone",
      rendu: (row: PrefectureRow) => (
        <ZoneName icon={Building} tone="amber" name={row.name} />
      ),
    },
    {
      cle: "region",
      entete: "Région",
      rendu: (row: PrefectureRow) => nomRegion(row.region_id),
    },
    {
      cle: "stat",
      entete: "Code statistique",
      rendu: (row: PrefectureRow) => <CodeBadge value={row.stat_code} />,
    },
    {
      cle: "type",
      entete: "Type",
      rendu: (row: PrefectureRow) =>
        row.is_special_zone ? (
          <Badge variant="outline">Zone spéciale</Badge>
        ) : (
          <span className="text-xs text-slate-600">Préfecture</span>
        ),
    },
    {
      cle: "communes",
      entete: "Communes",
      rendu: (row: PrefectureRow) =>
        communes.filter((c) => c.prefecture_id === row.id).length,
    },
    {
      cle: "actions",
      entete: "",
      rendu: (row: PrefectureRow) => (
        <ActionSuppression
          disabled={mutationDelete.isPending}
          onClick={() => demanderSuppression("prefecture", row.id, row.name)}
        />
      ),
    },
  ];

  const colonnesCommune = [
    {
      cle: "nom",
      entete: "Commune",
      rendu: (row: CommuneRow) => (
        <ZoneName icon={Building} tone="sky" name={row.name} />
      ),
    },
    {
      cle: "prefecture",
      entete: "Préfecture",
      rendu: (row: CommuneRow) => nomPrefecture(row.prefecture_id),
    },
    {
      cle: "region",
      entete: "Région",
      rendu: (row: CommuneRow) => nomRegion(regionDeCommune(row)),
    },
    {
      cle: "type",
      entete: "Type",
      rendu: (row: CommuneRow) => (
        <Badge variant="outline">
          {row.administrative_type === "urban"
            ? "Urbaine"
            : row.administrative_type === "rural"
              ? "Rurale"
              : "—"}
        </Badge>
      ),
    },
    {
      cle: "stat",
      entete: "Code stat.",
      rendu: (row: CommuneRow) => <CodeBadge value={row.stat_code} />,
    },
    {
      cle: "quartiers",
      entete: "Quartiers / districts",
      rendu: (row: CommuneRow) =>
        districts.filter((d) => d.commune_id === row.id).length,
    },
    {
      cle: "secteurs",
      entete: "Secteurs",
      rendu: (row: CommuneRow) => {
        const localIds = districts
          .filter((d) => d.commune_id === row.id)
          .map((d) => d.id);
        return sectors.filter((s) => localIds.includes(s.district_id)).length;
      },
    },
    {
      cle: "actions",
      entete: "",
      rendu: (row: CommuneRow) => (
        <ActionSuppression
          disabled={mutationDelete.isPending}
          onClick={() => demanderSuppression("commune", row.id, row.name)}
        />
      ),
    },
  ];

  const colonnesDistrict = [
    {
      cle: "nom",
      entete: "Quartier / district",
      rendu: (row: DistrictRow) => (
        <ZoneName icon={MapPin} tone="emerald" name={row.name} />
      ),
    },
    {
      cle: "type",
      entete: "Type",
      rendu: (row: DistrictRow) => (
        <Badge variant="outline">
          {row.kind === "district" ? "District" : "Quartier"}
        </Badge>
      ),
    },
    {
      cle: "commune",
      entete: "Commune",
      rendu: (row: DistrictRow) => nomCommune(row.commune_id),
    },
    {
      cle: "prefecture",
      entete: "Préfecture",
      rendu: (row: DistrictRow) => nomPrefecture(prefectureDeDistrict(row)),
    },
    {
      cle: "secteurs",
      entete: "Secteurs",
      rendu: (row: DistrictRow) =>
        sectors.filter((s) => s.district_id === row.id).length,
    },
    {
      cle: "statut",
      entete: "Statut",
      rendu: (row: DistrictRow) => {
        const current =
          row.is_active &&
          (
            ["MATD-2025", "MATD-2025-ANNEXE", "admin"].includes(row.source ?? "") ||
            ["current_verified", "current_verified_2025", "admin_verified"].includes(
              row.verification_status ?? "",
            )
          );

        return (
          <Badge
            variant={current ? "default" : "outline"}
            className="whitespace-nowrap text-[10px]"
          >
            {current
              ? "Actuel"
              : row.verification_status === "historical_archived" ||
                  (row.source ?? "").startsWith("MATD-2017")
                ? "Historique"
                : row.is_active
                  ? "À vérifier"
                  : "Archivé"}
          </Badge>
        );
      },
    },
    {
      cle: "source",
      entete: "Source",
      rendu: (row: DistrictRow) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant="outline" className="w-fit whitespace-nowrap text-[10px]">
            {row.source || "Non renseignée"}
          </Badge>
          {row.source_year ? (
            <span className="text-[10px] text-slate-400">{row.source_year}</span>
          ) : null}
        </div>
      ),
    },
    {
      cle: "actions",
      entete: "",
      rendu: (row: DistrictRow) => (
        <ActionSuppression
          disabled={mutationDelete.isPending}
          onClick={() => demanderSuppression("district", row.id, row.name)}
        />
      ),
    },
  ];

  const colonnesSector = [
    {
      cle: "nom",
      entete: "Secteur",
      rendu: (row: SectorRow) => (
        <ZoneName icon={MapPin} tone="rose" name={row.name} />
      ),
    },
    {
      cle: "quartier",
      entete: "Quartier / district",
      rendu: (row: SectorRow) => nomDistrict(row.district_id),
    },
    {
      cle: "commune",
      entete: "Commune",
      rendu: (row: SectorRow) => nomCommune(communeDeSector(row)),
    },
    {
      cle: "code",
      entete: "Code",
      rendu: (row: SectorRow) => <CodeBadge value={row.code} />,
    },
    {
      cle: "statut",
      entete: "Statut",
      rendu: (row: SectorRow) => {
        const current =
          row.is_active &&
          (
            ["MATD-2025", "MATD-2025-ANNEXE", "admin"].includes(row.source ?? "") ||
            ["current_verified", "current_verified_2025", "admin_verified"].includes(
              row.verification_status ?? "",
            )
          );

        return (
          <Badge
            variant={current ? "default" : "outline"}
            className="whitespace-nowrap text-[10px]"
          >
            {current
              ? "Actuel"
              : row.verification_status === "historical_archived" ||
                  (row.source ?? "").startsWith("MATD-2017")
                ? "Historique"
                : row.is_active
                  ? "À vérifier"
                  : "Archivé"}
          </Badge>
        );
      },
    },
    {
      cle: "source",
      entete: "Source",
      rendu: (row: SectorRow) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant="outline" className="w-fit whitespace-nowrap text-[10px]">
            {row.source || "Non renseignée"}
          </Badge>
          {row.source_year ? (
            <span className="text-[10px] text-slate-400">{row.source_year}</span>
          ) : null}
        </div>
      ),
    },
    {
      cle: "actions",
      entete: "",
      rendu: (row: SectorRow) => (
        <ActionSuppression
          disabled={mutationDelete.isPending}
          onClick={() => demanderSuppression("sector", row.id, row.name)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm">
            <Compass className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Référentiel géographique Adresse GN
            </h1>
            <p className="text-sm text-slate-500">
              Région → préfecture/zone spéciale → commune → quartier/district → secteur.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOuvrirImport(true)}>
            <Upload className="size-4" />
            Importer quartiers / secteurs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void zones.refetch()}
            disabled={zones.isFetching}
          >
            <RefreshCw
              className={cn("size-4", zones.isFetching && "animate-spin")}
            />
            Actualiser
          </Button>
        </div>
      </div>

      {zones.isError ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-start gap-3 py-4 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Impossible de charger le référentiel.</p>
              <p className="mt-1">
                {(zones.error as Error)?.message ??
                  "Vérifie que la migration Supabase a bien été exécutée."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Régions" valeur={regions.length} aide="Référentiel national" ton="violet" />
        <Kpi
          label="Préfectures / zone"
          valeur={prefectures.length}
          aide="33 + Conakry"
          ton="amber"
        />
        <Kpi
          label="Communes"
          valeur={communes.length}
          aide="Seed RGPH-4 2025"
          ton="sky"
        />
        <Kpi
          label="Quartiers / districts"
          valeur={storedDistrictCount.toLocaleString("fr-FR")}
          aide={`${currentDistrictCount.toLocaleString("fr-FR")} actuel(s) sur une cible de ${targetDistrictCount.toLocaleString("fr-FR")} · ${archivedDistrictCount.toLocaleString("fr-FR")} archivé(s)`}
          ton="emerald"
        />
        <Kpi
          label="Secteurs"
          valeur={storedSectorCount.toLocaleString("fr-FR")}
          aide={`${currentSectorCount.toLocaleString("fr-FR")} actuel(s) · ${archivedSectorCount.toLocaleString("fr-FR")} archivé(s)`}
          ton="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2 border-b bg-slate-50/50 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-lg border bg-white p-0.5">
              <button
                type="button"
                onClick={() => setVue("liste")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  vue === "liste"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <LayoutList className="size-3.5" />
                Liste
              </button>
              <button
                type="button"
                onClick={() => setVue("arbre")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  vue === "arbre"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <ListTree className="size-3.5" />
                Arborescence
              </button>
            </div>

            {vue === "arbre" ? (
              <div className="w-full sm:w-72">
                <BarreRecherche
                  placeholder="Rechercher une zone…"
                  valeur={rechArbre}
                  set={setRechArbre}
                />
              </div>
            ) : null}
          </div>

          {vue === "liste" ? (
            <Tabs defaultValue="communes">
              <div className="overflow-x-auto border-b bg-white px-4 py-3">
                <TabsList className="h-auto w-max min-w-full justify-start bg-slate-100">
                  <TabsTrigger value="regions" className="gap-1.5">
                    Régions
                    <CountBadge value={regions.length} />
                  </TabsTrigger>
                  <TabsTrigger value="prefectures" className="gap-1.5">
                    Préfectures
                    <CountBadge value={prefectures.length} />
                  </TabsTrigger>
                  <TabsTrigger value="communes" className="gap-1.5">
                    Communes
                    <CountBadge value={communes.length} />
                  </TabsTrigger>
                  <TabsTrigger value="districts" className="gap-1.5">
                    Quartiers / districts
                    <CountBadge value={districts.length.toLocaleString("fr-FR")} />
                  </TabsTrigger>
                  <TabsTrigger value="sectors" className="gap-1.5">
                    Secteurs
                    <CountBadge value={sectors.length.toLocaleString("fr-FR")} />
                  </TabsTrigger>
                </TabsList>
              </div>

              <ZoneTab
                value="regions"
                search={recherches.region}
                onSearch={(value) =>
                  setRecherches((current) => ({ ...current, region: value }))
                }
                placeholder="Rechercher une région ou un code…"
                columns={colonnesRegion}
                rows={regionsFiltrees}
                loading={zones.isLoading}
              />

              <ZoneTab
                value="prefectures"
                search={recherches.prefecture}
                onSearch={(value) =>
                  setRecherches((current) => ({ ...current, prefecture: value }))
                }
                placeholder="Rechercher une préfecture, région ou code…"
                columns={colonnesPrefecture}
                rows={prefecturesFiltrees}
                loading={zones.isLoading}
              />

              <ZoneTab
                value="communes"
                search={recherches.commune}
                onSearch={(value) =>
                  setRecherches((current) => ({ ...current, commune: value }))
                }
                placeholder="Rechercher une commune, préfecture, région ou code…"
                columns={colonnesCommune}
                rows={communesFiltrees}
                loading={zones.isLoading}
              />

              <ZoneTab
                value="districts"
                search={recherches.district}
                onSearch={(value) =>
                  setRecherches((current) => ({ ...current, district: value }))
                }
                placeholder="Rechercher un quartier/district ou sa commune…"
                columns={colonnesDistrict}
                rows={districtsFiltres}
                loading={zones.isLoading}
              />

              <ZoneTab
                value="sectors"
                search={recherches.sector}
                onSearch={(value) =>
                  setRecherches((current) => ({ ...current, sector: value }))
                }
                placeholder="Rechercher un secteur, quartier ou commune…"
                columns={colonnesSector}
                rows={sectorsFiltres}
                loading={zones.isLoading}
              />
            </Tabs>
          ) : (
            <VueArbre
              data={data}
              recherche={rechArbre}
              onSupprimer={demanderSuppression}
              suppressionEnCours={mutationDelete.isPending}
            />
          )}
        </Card>

        <Card className="h-fit overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white">
                <Plus className="size-4" />
              </div>
              Ajouter une zone
            </CardTitle>
            <p className="text-xs text-slate-500">
              Ajout manuel. Pour les volumes importants, utilise l'import CSV.
            </p>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            <div>
              <Label className="text-xs text-slate-600">Type de zone</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <BoutonNiveau
                  actif={niveau === "region"}
                  onClick={() => {
                    setNiveau("region");
                    setParent("");
                  }}
                  label="Région"
                  ton="violet"
                />
                <BoutonNiveau
                  actif={niveau === "prefecture"}
                  onClick={() => {
                    setNiveau("prefecture");
                    setParent("");
                  }}
                  label="Préfecture"
                  ton="amber"
                />
                <BoutonNiveau
                  actif={niveau === "commune"}
                  onClick={() => {
                    setNiveau("commune");
                    setParent("");
                  }}
                  label="Commune"
                  ton="sky"
                />
                <BoutonNiveau
                  actif={niveau === "district"}
                  onClick={() => {
                    setNiveau("district");
                    setParent("");
                  }}
                  label="Quartier"
                  ton="emerald"
                />
                <BoutonNiveau
                  actif={niveau === "sector"}
                  onClick={() => {
                    setNiveau("sector");
                    setParent("");
                  }}
                  label="Secteur"
                  ton="rose"
                />
              </div>
            </div>

            {niveau === "district" ? (
              <div>
                <Label className="text-xs text-slate-600">Nature locale</Label>
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as DistrictKind)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quartier">Quartier — zone urbaine</SelectItem>
                    <SelectItem value="district">District — zone rurale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {niveau === "commune" ? (
              <div>
                <Label className="text-xs text-slate-600">Nature de la commune</Label>
                <Select
                  value={communeType}
                  onValueChange={(value) => setCommuneType(value as CommuneType)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urban">Commune urbaine</SelectItem>
                    <SelectItem value="rural">Commune rurale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div>
              <Label className="text-xs text-slate-600">Nom</Label>
              <Input
                value={nom}
                onChange={(event) => setNom(event.target.value)}
                className="mt-1"
                placeholder={placeholderNom(niveau)}
              />
            </div>

            <div>
              <Label className="text-xs text-slate-600">
                Code {niveau === "region" ? "Adresse GN" : "(optionnel)"}
              </Label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="mt-1 font-mono"
                placeholder={niveau === "region" ? "Ex : CKY" : "Code officiel si connu"}
                maxLength={20}
              />
              {niveau === "region" ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Ce code peut être utilisé dans les identifiants Adresse GN :
                  GN-<b>CKY</b>-XXXXXX.
                </p>
              ) : null}
            </div>

            {niveau !== "region" ? (
              <div>
                <Label className="text-xs text-slate-600">{parentLabel}</Label>
                <Select value={parent} onValueChange={setParent}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map((row: any) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name}
                        {"stat_code" in row && row.stat_code
                          ? ` — ${row.stat_code}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700"
              disabled={
                !nom.trim() ||
                (niveau !== "region" && !parent) ||
                mutationSave.isPending
              }
              onClick={() => mutationSave.mutate()}
            >
              <Save className="size-4" />
              {mutationSave.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="flex items-start gap-3 py-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-600">
            <MapIcon className="size-4" />
          </div>
          <div className="text-xs text-slate-700">
            <p className="font-semibold text-slate-900">À propos du référentiel</p>
            <p className="mt-1 leading-5 text-slate-600">
              Le référentiel actuel vise 8 régions, 34 préfectures/zones spéciales,
              378 unités communales et une cible opérationnelle nationale de 4 865
              quartiers/districts. Les données historiques MATD 2017 sont archivées et
              exclues du compteur actuel. Seules les localités importées depuis une
              source 2025 vérifiée ou validées par l’administration sont affichées comme
              actuelles. Aucun quartier, district ou secteur manquant n’est fabriqué.
            </p>
          </div>
        </CardContent>
      </Card>

      <ImportCsvDialog
        ouvert={ouvrirImport}
        onFerme={() => setOuvrirImport(false)}
        data={data}
        onImported={invalider}
      />
    </div>
  );
}

function ZoneTab({
  value,
  search,
  onSearch,
  placeholder,
  columns,
  rows,
  loading,
}: {
  value: string;
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  columns: any[];
  rows: any[];
  loading: boolean;
}) {
  return (
    <TabsContent value={value} className="mt-0 space-y-3 p-4">
      <BarreRecherche
        placeholder={placeholder}
        valeur={search}
        set={onSearch}
      />
      <AdminTable
        colonnes={columns as any}
        lignes={rows as any[]}
        chargement={loading}
        cle={(row: any) => row.id}
      />
    </TabsContent>
  );
}

function VueArbre({
  data,
  recherche,
  onSupprimer,
  suppressionEnCours,
}: {
  data: GeoData;
  recherche: string;
  onSupprimer: (niveau: Niveau, id: string, name: string) => void;
  suppressionEnCours: boolean;
}) {
  const { regions, prefectures, communes, districts, sectors } = data;

  const [openRegions, setOpenRegions] = useState<Set<string>>(new Set());
  const [openPrefectures, setOpenPrefectures] = useState<Set<string>>(new Set());
  const [openCommunes, setOpenCommunes] = useState<Set<string>>(new Set());
  const [openDistricts, setOpenDistricts] = useState<Set<string>>(new Set());

  const search = normalize(recherche);

  const toggle = (
    current: Set<string>,
    id: string,
    setter: (value: Set<string>) => void,
  ) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const textMatches = (value: string | null | undefined) =>
    !search || normalize(value).includes(search);

  const subtreeMatchesDistrict = (district: DistrictRow) =>
    textMatches(district.name) ||
    sectors.some(
      (sector) =>
        sector.district_id === district.id && textMatches(sector.name),
    );

  const subtreeMatchesCommune = (commune: CommuneRow) =>
    textMatches(commune.name) ||
    districts.some(
      (district) =>
        district.commune_id === commune.id && subtreeMatchesDistrict(district),
    );

  const subtreeMatchesPrefecture = (prefecture: PrefectureRow) =>
    textMatches(prefecture.name) ||
    communes.some(
      (commune) =>
        commune.prefecture_id === prefecture.id && subtreeMatchesCommune(commune),
    );

  const subtreeMatchesRegion = (region: RegionRow) =>
    textMatches(region.name) ||
    prefectures.some(
      (prefecture) =>
        prefecture.region_id === region.id &&
        subtreeMatchesPrefecture(prefecture),
    );

  if (regions.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Aucune zone enregistrée. Exécute d'abord la migration Supabase.
      </div>
    );
  }

  return (
    <div className="max-h-[72vh] overflow-y-auto p-2">
      {regions.filter(subtreeMatchesRegion).map((region) => {
        const regionOpen = openRegions.has(region.id) || Boolean(search);
        const regionPrefectures = prefectures.filter(
          (prefecture) =>
            prefecture.region_id === region.id &&
            subtreeMatchesPrefecture(prefecture),
        );

        return (
          <div key={region.id} className="mb-1">
            <TreeLine
              level={0}
              open={regionOpen}
              hasChildren={regionPrefectures.length > 0}
              onToggle={() =>
                toggle(openRegions, region.id, setOpenRegions)
              }
              icon={Globe2}
              name={region.name}
              count={`${regionPrefectures.length} préfecture(s)`}
              badge={region.code}
              onDelete={() => onSupprimer("region", region.id, region.name)}
              disabled={suppressionEnCours}
            />

            {regionOpen ? (
              <div className="ml-5 border-l border-slate-100 pl-2">
                {regionPrefectures.map((prefecture) => {
                  const prefOpen =
                    openPrefectures.has(prefecture.id) || Boolean(search);
                  const prefCommunes = communes.filter(
                    (commune) =>
                      commune.prefecture_id === prefecture.id &&
                      subtreeMatchesCommune(commune),
                  );

                  return (
                    <div key={prefecture.id}>
                      <TreeLine
                        level={1}
                        open={prefOpen}
                        hasChildren={prefCommunes.length > 0}
                        onToggle={() =>
                          toggle(
                            openPrefectures,
                            prefecture.id,
                            setOpenPrefectures,
                          )
                        }
                        icon={Building}
                        name={prefecture.name}
                        count={`${prefCommunes.length} commune(s)`}
                        badge={prefecture.stat_code}
                        onDelete={() =>
                          onSupprimer(
                            "prefecture",
                            prefecture.id,
                            prefecture.name,
                          )
                        }
                        disabled={suppressionEnCours}
                      />

                      {prefOpen ? (
                        <div className="ml-5 border-l border-slate-100 pl-2">
                          {prefCommunes.map((commune) => {
                            const communeOpen =
                              openCommunes.has(commune.id) || Boolean(search);
                            const communeDistricts = districts.filter(
                              (district) =>
                                district.commune_id === commune.id &&
                                subtreeMatchesDistrict(district),
                            );

                            return (
                              <div key={commune.id}>
                                <TreeLine
                                  level={2}
                                  open={communeOpen}
                                  hasChildren={communeDistricts.length > 0}
                                  onToggle={() =>
                                    toggle(
                                      openCommunes,
                                      commune.id,
                                      setOpenCommunes,
                                    )
                                  }
                                  icon={Building}
                                  name={commune.name}
                                  count={`${communeDistricts.length} quartier(s)/district(s)`}
                                  badge={commune.stat_code}
                                  onDelete={() =>
                                    onSupprimer(
                                      "commune",
                                      commune.id,
                                      commune.name,
                                    )
                                  }
                                  disabled={suppressionEnCours}
                                />

                                {communeOpen ? (
                                  <div className="ml-5 border-l border-slate-100 pl-2">
                                    {communeDistricts.map((district) => {
                                      const districtOpen =
                                        openDistricts.has(district.id) ||
                                        Boolean(search);
                                      const districtSectors = sectors.filter(
                                        (sector) =>
                                          sector.district_id === district.id &&
                                          textMatches(sector.name),
                                      );

                                      return (
                                        <div key={district.id}>
                                          <TreeLine
                                            level={3}
                                            open={districtOpen}
                                            hasChildren={
                                              districtSectors.length > 0
                                            }
                                            onToggle={() =>
                                              toggle(
                                                openDistricts,
                                                district.id,
                                                setOpenDistricts,
                                              )
                                            }
                                            icon={MapPin}
                                            name={district.name}
                                            count={`${districtSectors.length} secteur(s)`}
                                            badge={
                                              district.kind === "district"
                                                ? "District"
                                                : "Quartier"
                                            }
                                            onDelete={() =>
                                              onSupprimer(
                                                "district",
                                                district.id,
                                                district.name,
                                              )
                                            }
                                            disabled={suppressionEnCours}
                                          />

                                          {districtOpen ? (
                                            <div className="ml-5 border-l border-slate-100 pl-2">
                                              {districtSectors.map((sector) => (
                                                <div key={sector.id}>
                                                  <TreeLine
                                                    level={4}
                                                    open={false}
                                                    hasChildren={false}
                                                    onToggle={() => undefined}
                                                    icon={MapPin}
                                                    name={sector.name}
                                                    count=""
                                                    badge={sector.code}
                                                    onDelete={() =>
                                                      onSupprimer(
                                                        "sector",
                                                        sector.id,
                                                        sector.name,
                                                      )
                                                    }
                                                    disabled={suppressionEnCours}
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TreeLine({
  open,
  hasChildren,
  onToggle,
  icon: Icon,
  name,
  count,
  badge,
  onDelete,
  disabled,
}: {
  level: number;
  open: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  icon: ElementType;
  name: string;
  count: string;
  badge?: string | null;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasChildren}
        className="grid size-5 shrink-0 place-items-center"
        aria-label={hasChildren ? (open ? "Replier" : "Déplier") : undefined}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "size-3.5 text-slate-400 transition-transform",
              open && "rotate-90",
            )}
          />
        ) : (
          <span className="size-3.5" />
        )}
      </button>

      <Icon className="size-3.5 shrink-0 text-slate-500" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
        {name}
      </span>

      {badge ? (
        <Badge variant="outline" className="hidden font-mono text-[10px] sm:inline-flex">
          {badge}
        </Badge>
      ) : null}

      {count ? (
        <span className="hidden text-[10px] text-slate-400 lg:inline">
          {count}
        </span>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="rounded p-1 text-rose-500 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100 focus:opacity-100"
        aria-label={`Supprimer ${name}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function ImportCsvDialog({
  ouvert,
  onFerme,
  data,
  onImported,
}: {
  ouvert: boolean;
  onFerme: () => void;
  data: GeoData;
  onImported: () => Promise<void>;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<ImportRow[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreurCsv, setErreurCsv] = useState("");

  const hierarchieExiste = (row: ImportRow) => {
    if (row.commune_stat_code) {
      return data.communes.some(
        (item) => String(item.stat_code ?? "") === row.commune_stat_code,
      );
    }

    const region = data.regions.find(
      (item) => normalize(item.name) === normalize(row.region),
    );
    if (!region) return false;

    const prefecture = data.prefectures.find(
      (item) =>
        item.region_id === region.id &&
        normalize(item.name) === normalize(row.prefecture),
    );
    if (!prefecture) return false;

    return data.communes.some(
      (item) =>
        item.prefecture_id === prefecture.id &&
        normalize(item.name) === normalize(row.commune),
    );
  };

  const valides = apercu.filter(hierarchieExiste);
  const invalides = apercu.filter((row) => !hierarchieExiste(row));

  const reset = () => {
    setFichier(null);
    setApercu([]);
    setErreurCsv("");
  };

  const fermer = () => {
    if (enCours) return;
    reset();
    onFerme();
  };

  const analyser = async (file: File) => {
    setErreurCsv("");
    const text = await file.text();
    const parsed = parseGeoCsv(text);

    if (parsed.length === 0) {
      setApercu([]);
      setErreurCsv(
        "Aucune ligne exploitable. Colonnes recommandées : commune_stat_code,quartier,type_quartier,secteur,official_reference",
      );
      return;
    }

    setApercu(parsed);
  };

  const telechargerModele = () => {
    const csv = [
      "commune_stat_code,region,prefecture,commune,quartier,type_quartier,secteur,official_reference",
      "2101,Conakry,Conakry,Kaloum,EXEMPLE_QUARTIER,quartier,EXEMPLE_SECTEUR,A/2025/447/MATD/CAB/SGG",
      "5401,Kindia,Kindia,Kindia,EXEMPLE_DISTRICT,district,EXEMPLE_SECTEUR,A/2025/447/MATD/CAB/SGG",
    ].join("\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modele_adresse_gn_quartiers_secteurs.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(next) => {
        if (!next) fermer();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Upload className="size-4" />
            </div>
            Importer quartiers, districts et secteurs
          </DialogTitle>
          <DialogDescription>
            Pour le référentiel actuel, utilise de préférence le
            <strong> code statistique de la commune</strong>, puis le quartier/district
            et le secteur. Les noms de région/préfecture/commune restent acceptés pour
            contrôle visuel, mais le rattachement SQL se fait par code communal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={telechargerModele}>
              <Download className="size-4" />
              Télécharger le modèle CSV
            </Button>
          </div>

          <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFichier(file);
                void analyser(file);
              }}
              className="hidden"
              id="geo-csv-upload"
            />
            <label htmlFor="geo-csv-upload" className="cursor-pointer">
              <Upload className="mx-auto size-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                {fichier ? fichier.name : "Cliquer pour choisir un fichier CSV"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Virgule ou point-virgule accepté. UTF-8 recommandé.
              </p>
            </label>
          </div>

          {erreurCsv ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {erreurCsv}
            </div>
          ) : null}

          {apercu.length > 0 ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <MiniStat label="Lignes détectées" value={apercu.length} />
                <MiniStat label="Hiérarchie reconnue" value={valides.length} />
                <MiniStat label="À corriger" value={invalides.length} />
              </div>

              {invalides.length > 0 ? (
                <p className="flex items-start gap-1 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  Les lignes marquées « hiérarchie introuvable » ne seront pas
                  importées. Vérifie surtout l'orthographe de la région, de la
                  préfecture et de la commune.
                </p>
              ) : null}

              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="min-w-[900px] w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2 text-left font-medium">Code commune</th>
                      <th className="p-2 text-left font-medium">Région</th>
                      <th className="p-2 text-left font-medium">Préfecture</th>
                      <th className="p-2 text-left font-medium">Commune</th>
                      <th className="p-2 text-left font-medium">Quartier / district</th>
                      <th className="p-2 text-left font-medium">Type</th>
                      <th className="p-2 text-left font-medium">Secteur</th>
                      <th className="p-2 text-left font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apercu.slice(0, 200).map((row, index) => {
                      const ok = hierarchieExiste(row);
                      return (
                        <tr
                          key={`${row.region}-${row.commune}-${row.quartier}-${row.secteur}-${index}`}
                          className="border-t"
                        >
                          <td className="p-2 font-mono">{row.commune_stat_code || "—"}</td>
                          <td className="p-2">{row.region || "—"}</td>
                          <td className="p-2">{row.prefecture || "—"}</td>
                          <td className="p-2">{row.commune}</td>
                          <td className="p-2">{row.quartier || "—"}</td>
                          <td className="p-2">{row.type_quartier}</td>
                          <td className="p-2">{row.secteur || "—"}</td>
                          <td className="p-2">
                            {ok ? (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                Prêt
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-700">
                                Hiérarchie introuvable
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {apercu.length > 200 ? (
                      <tr>
                        <td colSpan={8} className="p-2 text-center text-slate-500">
                          … et {apercu.length - 200} autres lignes.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fermer} disabled={enCours}>
            Annuler
          </Button>
          <Button
            disabled={valides.length === 0 || enCours}
            onClick={async () => {
              setEnCours(true);
              try {
                const result = await importGeoRows(valides);
                await onImported();
                toast.success(
                  `${result.quartiers_created} quartier(s)/district(s) créé(s), ${result.quartiers_updated} actualisé(s), ${result.sectors_created} secteur(s) créé(s) et ${result.sectors_updated} actualisé(s).`,
                );
                if (result.rows_skipped > 0) {
                  toast.warning(`${result.rows_skipped} ligne(s) ignorée(s).`);
                }
                fermer();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Import impossible.",
                );
              } finally {
                setEnCours(false);
              }
            }}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
          >
            {enCours ? "Import en cours…" : `Importer ${valides.length} ligne(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseGeoCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((header) =>
    normalizeHeader(header),
  );

  const indexOf = (...names: string[]) =>
    headers.findIndex((header) => names.includes(header));

  const indexes = {
    communeStatCode: indexOf(
      "commune_stat_code",
      "code_commune",
      "stat_code",
      "code_statistique_commune",
    ),
    region: indexOf("region"),
    prefecture: indexOf("prefecture", "préfecture"),
    commune: indexOf("commune"),
    quartier: indexOf("quartier", "district", "quartier_district"),
    type: indexOf("type_quartier", "type", "nature"),
    secteur: indexOf("secteur", "sector"),
    officialReference: indexOf(
      "official_reference",
      "reference_officielle",
      "source_reference",
    ),
  };

  if (indexes.communeStatCode < 0 && indexes.commune < 0) {
    return [];
  }

  if (indexes.quartier < 0) {
    return [];
  }

  const result: ImportRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const columns = parseCsvLine(lines[i], delimiter);
    const get = (index: number) =>
      index >= 0 ? (columns[index] ?? "").trim() : "";

    const commune_stat_code = get(indexes.communeStatCode);
    const region = get(indexes.region);
    const prefecture = get(indexes.prefecture);
    const commune = get(indexes.commune);
    const quartier = get(indexes.quartier);
    const secteur = get(indexes.secteur);
    const official_reference = get(indexes.officialReference);

    if (!commune_stat_code && !commune) continue;
    if (!quartier) continue;

    const rawType = normalize(get(indexes.type));
    const type_quartier: DistrictKind =
      rawType === "district" ? "district" : "quartier";

    result.push({
      commune_stat_code,
      region,
      prefecture,
      commune,
      quartier,
      type_quartier,
      secteur,
      official_reference,
    });
  }

  return result;
}

function detectDelimiter(header: string): "," | ";" {
  const commas = (header.match(/,/g) ?? []).length;
  const semicolons = (header.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: "," | ";"): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function BarreRecherche({
  placeholder,
  valeur,
  set,
}: {
  placeholder: string;
  valeur: string;
  set: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={valeur}
        onChange={(event) => set(event.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
      />
      {valeur ? (
        <button
          type="button"
          onClick={() => set("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Effacer"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function ActionSuppression({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="h-8 gap-1 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            onClick={onClick}
          >
            <Trash2 className="size-3.5" />
            Supprimer
          </Button>
        </TooltipTrigger>
        <TooltipContent>Suppression avec cascade des enfants</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BoutonNiveau({
  actif,
  onClick,
  label,
  ton,
}: {
  actif: boolean;
  onClick: () => void;
  label: string;
  ton: "violet" | "amber" | "sky" | "emerald" | "rose";
}) {
  const styles = {
    violet:
      "border-violet-500 bg-violet-50 text-violet-700 ring-violet-500",
    amber: "border-amber-500 bg-amber-50 text-amber-700 ring-amber-500",
    sky: "border-sky-500 bg-sky-50 text-sky-700 ring-sky-500",
    emerald:
      "border-emerald-500 bg-emerald-50 text-emerald-700 ring-emerald-500",
    rose: "border-rose-500 bg-rose-50 text-rose-700 ring-rose-500",
  }[ton];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2 py-2.5 text-xs font-medium transition-all",
        actif
          ? `${styles} ring-1`
          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {label}
    </button>
  );
}

function ZoneName({
  icon: Icon,
  tone,
  name,
}: {
  icon: ElementType;
  tone: "violet" | "amber" | "sky" | "emerald" | "rose";
  name: string;
}) {
  const styles = {
    violet: "bg-violet-100 text-violet-600",
    amber: "bg-amber-100 text-amber-600",
    sky: "bg-sky-100 text-sky-600",
    emerald: "bg-emerald-100 text-emerald-600",
    rose: "bg-rose-100 text-rose-600",
  }[tone];

  return (
    <div className="flex items-center gap-2">
      <div className={cn("grid size-7 place-items-center rounded-md", styles)}>
        <Icon className="size-3.5" />
      </div>
      <span className="font-medium text-slate-900">{name}</span>
    </div>
  );
}

function CodeBadge({ value }: { value: string | null | undefined }) {
  return value ? (
    <Badge variant="outline" className="font-mono text-xs">
      {value}
    </Badge>
  ) : (
    <span className="text-slate-400">—</span>
  );
}

function CountBadge({ value }: { value: number | string }) {
  return (
    <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
      {value}
    </Badge>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

type KpiTone = "violet" | "amber" | "sky" | "emerald" | "rose";

function Kpi({
  label,
  valeur,
  aide,
  ton,
}: {
  label: string;
  valeur: string | number;
  aide?: string;
  ton: KpiTone;
}) {
  const styles = {
    violet:
      "from-violet-50 to-white ring-violet-100 text-violet-600 bg-violet-100",
    amber: "from-amber-50 to-white ring-amber-100 text-amber-600 bg-amber-100",
    sky: "from-sky-50 to-white ring-sky-100 text-sky-600 bg-sky-100",
    emerald:
      "from-emerald-50 to-white ring-emerald-100 text-emerald-600 bg-emerald-100",
    rose: "from-rose-50 to-white ring-rose-100 text-rose-600 bg-rose-100",
  }[ton].split(" ");

  const gradient = styles.slice(0, 2).join(" ");
  const ring = styles[2];
  const text = styles[3];
  const iconBg = styles[4];

  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br p-4 ring-1",
        gradient,
        ring,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {valeur}
          </p>
          {aide ? <p className="mt-1 text-xs text-slate-500">{aide}</p> : null}
        </div>
        <div className={cn("grid size-9 place-items-center rounded-lg", iconBg, text)}>
          <MapPin className="size-4" />
        </div>
      </div>
    </div>
  );
}

function labelNiveau(niveau: Niveau): string {
  switch (niveau) {
    case "region":
      return "Région";
    case "prefecture":
      return "Préfecture";
    case "commune":
      return "Commune";
    case "district":
      return "Quartier / district";
    case "sector":
      return "Secteur";
  }
}

function placeholderNom(niveau: Niveau): string {
  switch (niveau) {
    case "region":
      return "Ex : Conakry";
    case "prefecture":
      return "Ex : Kindia";
    case "commune":
      return "Ex : Kaloum";
    case "district":
      return "Ex : Sandervalia";
    case "sector":
      return "Ex : Secteur 1";
  }
}

