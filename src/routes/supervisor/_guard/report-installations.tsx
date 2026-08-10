import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  supervisorInstallationReport,
  supervisorAgents,
  supervisorZones,
} from "@/lib/supervisor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileBarChart2, Download, MapPin } from "lucide-react";

export const Route = createFileRoute("/supervisor/_guard/report-installations")({
  component: SupervisorInstallationReport,
});

function SupervisorInstallationReport() {
  const fn = useServerFn(supervisorInstallationReport);
  const agentsFn = useServerFn(supervisorAgents);
  const zonesFn = useServerFn(supervisorZones);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const [filters, setFilters] = useState({
    from: monthAgo,
    to: today,
    agentId: "",
    communeId: "",
    validation: "" as "" | "validated" | "pending",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sup-install-report", filters],
    queryFn: () => fn({ data: {
      from: filters.from || null,
      to: filters.to || null,
      agentId: filters.agentId || null,
      communeId: filters.communeId || null,
      validation: filters.validation || null,
    } }),
  });

  const { data: agents } = useQuery({ queryKey: ["sup-agents-list"], queryFn: () => agentsFn() });
  const { data: zones } = useQuery({ queryKey: ["sup-zones-list"], queryFn: () => zonesFn() });

  const csvUrl = useMemo(() => {
    if (!data?.rows.length) return null;
    const header = "balise,categorie,agent,commune,latitude,longitude,precision_m,pose_le,validee_le\n";
    const lines = data.rows.map((r: any) => [
      r.beacon_number ?? "",
      r.beacon_category ?? "",
      r.agent_badge ?? "",
      r.commune_name ?? "",
      r.gps_lat ?? "",
      r.gps_lng ?? "",
      r.accuracy_m ?? "",
      r.installed_at ?? "",
      r.validated_at ?? "",
    ].map((v) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileBarChart2 className="h-6 w-6 text-indigo-600" />
            Rapport d'installations
          </h1>
          <p className="text-sm text-slate-600">Vue détaillée des balises installées avec filtres et export CSV.</p>
        </div>
        {csvUrl && (
          <a href={csvUrl} download={`installations_${filters.from}_${filters.to}.csv`}>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-1" /> Exporter CSV
            </Button>
          </a>
        )}
      </header>

      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">Du</label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">Au</label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">Agent</label>
            <select
              value={filters.agentId}
              onChange={(e) => setFilters({ ...filters, agentId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Tous</option>
              {(agents as any[])?.map((a: any) => (
                <option key={a.id} value={a.id}>{a.badge_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">Commune</label>
            <select
              value={filters.communeId}
              onChange={(e) => setFilters({ ...filters, communeId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Toutes</option>
              {zones?.communes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">État</label>
            <select
              value={filters.validation}
              onChange={(e) => setFilters({ ...filters, validation: e.target.value as any })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Tous</option>
              <option value="validated">Validées</option>
              <option value="pending">En attente</option>
            </select>
          </div>
        </div>
      </Card>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs uppercase text-slate-500">Total</div>
            <div className="text-2xl font-bold">{data.stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-slate-500">Validées</div>
            <div className="text-2xl font-bold text-emerald-600">{data.stats.validees}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-slate-500">En attente</div>
            <div className="text-2xl font-bold text-amber-600">{data.stats.enAttente}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-slate-500">Précision moy.</div>
            <div className="text-2xl font-bold">{data.stats.precisionMoyenne != null ? `±${data.stats.precisionMoyenne}m` : "—"}</div>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Chargement…</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Aucune installation sur cette période.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left p-3">Balise</th>
                  <th className="text-left p-3">Catégorie</th>
                  <th className="text-left p-3">Agent</th>
                  <th className="text-left p-3">Commune</th>
                  <th className="text-left p-3">GPS</th>
                  <th className="text-left p-3">Précision</th>
                  <th className="text-left p-3">Posée</th>
                  <th className="text-left p-3">Validée</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono">{r.beacon_number ?? "—"}</td>
                    <td className="p-3"><Badge variant="outline">{r.beacon_category ?? "—"}</Badge></td>
                    <td className="p-3 font-mono text-xs">{r.agent_badge ?? "—"}</td>
                    <td className="p-3">{r.commune_name ?? "—"}</td>
                    <td className="p-3 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {r.gps_lat && r.gps_lng ? `${Number(r.gps_lat).toFixed(4)}, ${Number(r.gps_lng).toFixed(4)}` : "—"}
                      </div>
                    </td>
                    <td className="p-3">
                      {r.accuracy_m != null ? (
                        <Badge variant={r.accuracy_m <= 10 ? "default" : r.accuracy_m <= 30 ? "secondary" : "destructive"}>
                          ±{Math.round(r.accuracy_m)}m
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {r.installed_at ? new Date(r.installed_at).toLocaleString("fr-FR") : "—"}
                    </td>
                    <td className="p-3">
                      {r.validated_at ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {new Date(r.validated_at).toLocaleDateString("fr-FR")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">En attente</Badge>
                      )}
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
