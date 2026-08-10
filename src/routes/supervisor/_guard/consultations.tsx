import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  supervisorBeacons,
  supervisorLots,
  supervisorAddresses,
  supervisorAgents,
  supervisorZones,
} from "@/lib/supervisor.functions";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Database, Radio, Package, MapPin, UserCog, Map, Search,
  Building2, Layers, Hash, TrendingUp, CircleDot, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supervisor/_guard/consultations")({
  component: SupervisorConsultations,
});

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  generated: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  assigned: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  suspended: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  distributed: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  digital_only: "Numérique",
  residential: "Résidentiel",
  residential_plus: "Résidentiel+",
  professional: "Pro",
  institutional: "Institutionnel",
  custom: "Sur mesure",
};

function SupervisorConsultations() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-indigo-600" />
          Consultations
          <Badge variant="outline" className="text-[10px] ml-2">Lecture seule</Badge>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Explorer tous les référentiels sans droits de modification.
        </p>
      </header>

      <Tabs defaultValue="beacons" className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1">
          <TabsTrigger value="beacons" className="gap-2"><Radio className="h-3.5 w-3.5" /> Balises</TabsTrigger>
          <TabsTrigger value="lots" className="gap-2"><Package className="h-3.5 w-3.5" /> Lots</TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2"><MapPin className="h-3.5 w-3.5" /> Adresses</TabsTrigger>
          <TabsTrigger value="agents" className="gap-2"><UserCog className="h-3.5 w-3.5" /> Agents</TabsTrigger>
          <TabsTrigger value="zones" className="gap-2"><Map className="h-3.5 w-3.5" /> Zones</TabsTrigger>
        </TabsList>

        <TabsContent value="beacons"><BeaconsTab /></TabsContent>
        <TabsContent value="lots"><LotsTab /></TabsContent>
        <TabsContent value="addresses"><AddressesTab /></TabsContent>
        <TabsContent value="agents"><AgentsTab /></TabsContent>
        <TabsContent value="zones"><ZonesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== BALISES ============================== */

function BeaconsTab() {
  const fn = useServerFn(supervisorBeacons);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["sup-beacons", q, statusFilter],
    queryFn: () => fn({ data: {
      page: 1, pageSize: 100,
      q: q || null,
      statuses: statusFilter ? [statusFilter] : [],
    } }),
  });

  const stats = useMemo(() => {
    if (!data?.rows) return null;
    return {
      total: data.total,
      actives: data.rows.filter((b: any) => b.status === "active").length,
      generees: data.rows.filter((b: any) => b.status === "generated").length,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total (page)" value={stats.total} icon={Hash} tone="slate" />
          <StatCard label="Actives" value={stats.actives} icon={CircleDot} tone="emerald" />
          <StatCard label="Générées" value={stats.generees} icon={TrendingUp} tone="indigo" />
        </div>
      )}

      <Card className="p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Rechercher un numéro (GN-CKY-…)" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="generated">Générées</option>
          <option value="assigned">Affectées</option>
          <option value="active">Actives</option>
          <option value="suspended">Suspendues</option>
          <option value="cancelled">Annulées</option>
        </select>
      </Card>

      <DataTable
        loading={isLoading}
        empty={!data?.rows.length}
        columns={["Numéro", "Catégorie", "Statut", "Lot", "Créée"]}
        rows={data?.rows.map((b: any) => (
          <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <td className="p-3 font-mono text-sm">{b.public_number}</td>
            <td className="p-3"><Badge variant="outline">{CATEGORY_LABELS[b.category] ?? b.category ?? "—"}</Badge></td>
            <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded font-medium", STATUS_COLORS[b.status] ?? "bg-slate-100 text-slate-700")}>{b.status}</span></td>
            <td className="p-3 text-xs font-mono text-slate-500">{b.lot_code ?? "—"}</td>
            <td className="p-3 text-xs text-slate-500">{new Date(b.created_at).toLocaleDateString("fr-FR")}</td>
          </tr>
        )) ?? []}
      />
    </div>
  );
}

/* ============================== LOTS ============================== */

function LotsTab() {
  const fn = useServerFn(supervisorLots);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["sup-lots"], queryFn: () => fn() });

  const filtered = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data as any[];
    return (data as any[]).filter((l) =>
      l.code.toLowerCase().includes(t) || (l.supplier ?? "").toLowerCase().includes(t),
    );
  }, [data, q]);

  const totalQuantite = (data as any[])?.reduce((s, l) => s + (l.quantity ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Lots" value={(data as any[]).length} icon={Package} tone="indigo" />
          <StatCard label="Balises total" value={totalQuantite} icon={Hash} tone="violet" />
          <StatCard label="Distribués" value={(data as any[]).filter((l) => l.status === "distributed").length} icon={TrendingUp} tone="emerald" />
        </div>
      )}

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Rechercher un code ou fournisseur…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <DataTable
        loading={isLoading}
        empty={filtered.length === 0}
        columns={["Code", "Catégorie", "Quantité", "Fournisseur", "Statut", "Reçu le"]}
        rows={filtered.map((l) => (
          <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <td className="p-3 font-mono text-sm">{l.code}</td>
            <td className="p-3"><Badge variant="outline">{CATEGORY_LABELS[l.category] ?? l.category ?? "—"}</Badge></td>
            <td className="p-3 font-semibold">{l.quantity}</td>
            <td className="p-3 text-sm">{l.supplier ?? "—"}</td>
            <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded font-medium", STATUS_COLORS[l.status] ?? "bg-slate-100 text-slate-700")}>{l.status}</span></td>
            <td className="p-3 text-xs text-slate-500">{l.received_at ? new Date(l.received_at).toLocaleDateString("fr-FR") : "—"}</td>
          </tr>
        ))}
      />
    </div>
  );
}

/* ============================== ADRESSES ============================== */

function AddressesTab() {
  const fn = useServerFn(supervisorAddresses);
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sup-addresses", q, visibility],
    queryFn: () => fn({ data: { page: 1, pageSize: 100, q: q || null, visibility: visibility || null } }),
  });

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total" value={data.total} icon={MapPin} tone="indigo" />
          <StatCard label="Publiques" value={data.rows.filter((a: any) => a.visibility === "public").length} icon={CircleDot} tone="emerald" />
          <StatCard label="Vérifiées" value={data.rows.filter((a: any) => a.verification_level === "verified").length} icon={TrendingUp} tone="sky" />
        </div>
      )}

      <Card className="p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Rechercher par nom d'adresse…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-md px-3 py-2 text-sm">
          <option value="">Toutes visibilités</option>
          <option value="public">Publiques</option>
          <option value="private">Privées</option>
        </select>
      </Card>

      <DataTable
        loading={isLoading}
        empty={!data?.rows.length}
        columns={["Nom", "Balise", "Commune", "Visibilité", "Vérification", "Créée"]}
        rows={data?.rows.map((a: any) => (
          <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <td className="p-3 font-medium">{a.name ?? <span className="text-slate-400 italic">Sans nom</span>}</td>
            <td className="p-3 font-mono text-xs">{a.beacon_number ?? "—"}</td>
            <td className="p-3 text-sm">{a.commune_name ?? "—"}</td>
            <td className="p-3">
              <Badge className={a.visibility === "public" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                {a.visibility}
              </Badge>
            </td>
            <td className="p-3">
              <Badge variant={a.verification_level === "verified" ? "default" : "outline"}>
                {a.verification_level}
              </Badge>
            </td>
            <td className="p-3 text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
          </tr>
        )) ?? []}
      />
    </div>
  );
}

/* ============================== AGENTS ============================== */

function AgentsTab() {
  const fn = useServerFn(supervisorAgents);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["sup-agents-consult"], queryFn: () => fn() });

  const filtered = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data as any[];
    return (data as any[]).filter((a) =>
      (a.badge_number ?? "").toLowerCase().includes(t) ||
      (a.full_name ?? "").toLowerCase().includes(t) ||
      (a.zone_name ?? "").toLowerCase().includes(t),
    );
  }, [data, q]);

  const actifs = (data as any[])?.filter((a) => a.active).length ?? 0;
  const totalInstalls = (data as any[])?.reduce((s, a) => s + (a.installations ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Agents" value={(data as any[]).length} icon={UserCog} tone="indigo" />
          <StatCard label="Actifs" value={actifs} icon={CircleDot} tone="emerald" />
          <StatCard label="Installations totales" value={totalInstalls} icon={TrendingUp} tone="violet" />
        </div>
      )}

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Rechercher par badge, nom ou zone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <DataTable
        loading={isLoading}
        empty={filtered.length === 0}
        columns={["Badge", "Nom", "Zone", "Installations", "Dernière", "État"]}
        rows={filtered.map((a) => (
          <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <td className="p-3 font-mono text-sm">{a.badge_number}</td>
            <td className="p-3">{a.full_name ?? <span className="text-slate-400 italic">—</span>}</td>
            <td className="p-3 text-sm">{a.zone_name ?? "—"}</td>
            <td className="p-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">{a.installations}</span>
                {a.installations > 0 && (
                  <div className="h-1.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-600" style={{ width: `${Math.min(100, (a.installations / Math.max(...(data as any[]).map((x) => x.installations || 1))) * 100)}%` }} />
                  </div>
                )}
              </div>
            </td>
            <td className="p-3 text-xs text-slate-500">
              {a.derniere_installation ? new Date(a.derniere_installation).toLocaleDateString("fr-FR") : "—"}
            </td>
            <td className="p-3">
              {a.active
                ? <Badge className="bg-emerald-100 text-emerald-700">Actif</Badge>
                : <Badge variant="secondary">Inactif</Badge>}
            </td>
          </tr>
        ))}
      />
    </div>
  );
}

/* ============================== ZONES ============================== */

function ZonesTab() {
  const fn = useServerFn(supervisorZones);
  const { data, isLoading } = useQuery({ queryKey: ["sup-zones-consult"], queryFn: () => fn() });

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const communesFiltered = useMemo(() => {
    if (!data) return [];
    let list = data.communes as any[];
    if (selectedRegion) list = list.filter((c) => c.region_id === selectedRegion);
    if (q.trim()) list = list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [data, selectedRegion, q]);

  const districtsFiltered = useMemo(() => {
    if (!data) return [];
    if (!selectedCommune) return [];
    return (data.districts as any[]).filter((d) => d.commune_id === selectedCommune);
  }, [data, selectedCommune]);

  if (isLoading) return <Card className="p-8 text-center text-slate-500">Chargement…</Card>;
  if (!data) return <Card className="p-8 text-center text-slate-500">Aucune donnée.</Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Régions" value={data.regions.length} icon={Building2} tone="indigo" />
        <StatCard label="Communes" value={data.communes.length} icon={Layers} tone="violet" />
        <StatCard label="Districts" value={data.districts.length} icon={Map} tone="emerald" />
      </div>

      <Card className="p-4">
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Régions</div>
          <div className="flex flex-wrap gap-2">
            {data.regions.map((r: any) => (
              <button
                key={r.id}
                onClick={() => { setSelectedRegion(selectedRegion === r.id ? null : r.id); setSelectedCommune(null); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition border",
                  selectedRegion === r.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700",
                )}
              >
                {r.name} <span className="opacity-60 text-xs">({r.code})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Communes {selectedRegion && `(${communesFiltered.length})`}
              </div>
              <div className="relative w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                  placeholder="Filtrer…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-96 overflow-y-auto">
              {communesFiltered.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  {selectedRegion ? "Aucune commune dans cette région." : "Sélectionne une région pour filtrer."}
                </div>
              ) : (
                communesFiltered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCommune(selectedCommune === c.id ? null : c.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition",
                      selectedCommune === c.id && "bg-indigo-50 dark:bg-indigo-500/10 font-medium",
                    )}
                  >
                    <span>{c.name}</span>
                    {selectedCommune === c.id && <ChevronRight className="h-3.5 w-3.5 text-indigo-500" />}
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Districts / Quartiers {selectedCommune && `(${districtsFiltered.length})`}
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-96 overflow-y-auto">
              {!selectedCommune ? (
                <div className="p-6 text-center text-sm text-slate-400">Sélectionne une commune.</div>
              ) : districtsFiltered.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">Aucun district répertorié.</div>
              ) : (
                districtsFiltered.map((d: any) => (
                  <div key={d.id} className="px-3 py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0">
                    {d.name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================== HELPERS ============================== */

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  const tones: Record<string, string> = {
    slate: "from-slate-500 to-slate-600",
    indigo: "from-indigo-500 to-violet-600",
    violet: "from-violet-500 to-fuchsia-600",
    emerald: "from-emerald-500 to-teal-600",
    sky: "from-sky-500 to-blue-600",
  };
  return (
    <Card className="p-4 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
        <div className="text-2xl font-bold mt-1">{value.toLocaleString("fr-FR")}</div>
      </div>
      <div className={cn("h-10 w-10 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-md", tones[tone] ?? tones.slate)}>
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}

function DataTable({ loading, empty, columns, rows }: {
  loading: boolean;
  empty: boolean;
  columns: string[];
  rows: React.ReactNode[];
}) {
  return (
    <Card className="overflow-hidden">
      {loading ? (
        <div className="p-8 text-center text-slate-500">
          <div className="inline-block h-6 w-6 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-2" />
          <div>Chargement…</div>
        </div>
      ) : empty ? (
        <div className="p-12 text-center">
          <Database className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <div className="text-slate-500">Aucun résultat.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="text-left p-3 font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
