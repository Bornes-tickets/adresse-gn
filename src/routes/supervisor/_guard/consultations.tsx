import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Database, Radio, Package, MapPin, UserCog, Map } from "lucide-react";

export const Route = createFileRoute("/supervisor/_guard/consultations")({
  component: SupervisorConsultations,
});

function SupervisorConsultations() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="h-6 w-6 text-indigo-600" />
          Consultations (lecture seule)
        </h1>
        <p className="text-sm text-slate-600">Accéder aux référentiels sans droits de modification.</p>
      </header>

      <Tabs defaultValue="beacons">
        <TabsList>
          <TabsTrigger value="beacons"><Radio className="h-4 w-4 mr-1" /> Balises</TabsTrigger>
          <TabsTrigger value="lots"><Package className="h-4 w-4 mr-1" /> Lots</TabsTrigger>
          <TabsTrigger value="addresses"><MapPin className="h-4 w-4 mr-1" /> Adresses</TabsTrigger>
          <TabsTrigger value="agents"><UserCog className="h-4 w-4 mr-1" /> Agents</TabsTrigger>
          <TabsTrigger value="zones"><Map className="h-4 w-4 mr-1" /> Zones</TabsTrigger>
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

function BeaconsTab() {
  const fn = useServerFn(supervisorBeacons);
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["sup-beacons", q],
    queryFn: () => fn({ data: { page: 1, pageSize: 50, q: q || null } }),
  });
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="Rechercher un numéro…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      </div>
      {isLoading ? <Loading /> : !data || data.rows.length === 0 ? <Empty /> : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left p-3">Numéro</th>
              <th className="text-left p-3">Catégorie</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Lot</th>
              <th className="text-left p-3">Créée</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((b: any) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="p-3 font-mono">{b.public_number}</td>
                <td className="p-3"><Badge variant="outline">{b.category ?? "—"}</Badge></td>
                <td className="p-3"><Badge>{b.status}</Badge></td>
                <td className="p-3 text-xs">{b.lot_code ?? "—"}</td>
                <td className="p-3 text-xs text-slate-500">{new Date(b.created_at).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function LotsTab() {
  const fn = useServerFn(supervisorLots);
  const { data, isLoading } = useQuery({ queryKey: ["sup-lots"], queryFn: () => fn() });
  return (
    <Card className="mt-4 overflow-hidden">
      {isLoading ? <Loading /> : !data || data.length === 0 ? <Empty /> : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Catégorie</th>
              <th className="text-left p-3">Quantité</th>
              <th className="text-left p-3">Fournisseur</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Reçu</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="p-3 font-mono">{l.code}</td>
                <td className="p-3"><Badge variant="outline">{l.category ?? "—"}</Badge></td>
                <td className="p-3">{l.quantity}</td>
                <td className="p-3">{l.supplier ?? "—"}</td>
                <td className="p-3"><Badge>{l.status}</Badge></td>
                <td className="p-3 text-xs text-slate-500">
                  {l.received_at ? new Date(l.received_at).toLocaleDateString("fr-FR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AddressesTab() {
  const fn = useServerFn(supervisorAddresses);
  const { data, isLoading } = useQuery({
    queryKey: ["sup-addresses"],
    queryFn: () => fn({ data: { page: 1, pageSize: 50 } }),
  });
  return (
    <Card className="mt-4 overflow-hidden">
      {isLoading ? <Loading /> : !data || data.rows.length === 0 ? <Empty /> : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left p-3">Nom</th>
              <th className="text-left p-3">Balise</th>
              <th className="text-left p-3">Commune</th>
              <th className="text-left p-3">Visibilité</th>
              <th className="text-left p-3">Vérification</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((a: any) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="p-3">{a.name ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{a.beacon_number ?? "—"}</td>
                <td className="p-3">{a.commune_name ?? "—"}</td>
                <td className="p-3"><Badge variant="outline">{a.visibility}</Badge></td>
                <td className="p-3"><Badge>{a.verification_level}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AgentsTab() {
  const fn = useServerFn(supervisorAgents);
  const { data, isLoading } = useQuery({ queryKey: ["sup-agents"], queryFn: () => fn() });
  return (
    <Card className="mt-4 overflow-hidden">
      {isLoading ? <Loading /> : !data || (data as any[]).length === 0 ? <Empty /> : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left p-3">Badge</th>
              <th className="text-left p-3">Nom</th>
              <th className="text-left p-3">Zone</th>
              <th className="text-left p-3">Installations</th>
              <th className="text-left p-3">Dernière</th>
              <th className="text-left p-3">État</th>
            </tr>
          </thead>
          <tbody>
            {(data as any[]).map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="p-3 font-mono">{a.badge_number}</td>
                <td className="p-3">{a.full_name ?? "—"}</td>
                <td className="p-3">{a.zone_name ?? "—"}</td>
                <td className="p-3 font-semibold">{a.installations}</td>
                <td className="p-3 text-xs text-slate-500">
                  {a.derniere_installation ? new Date(a.derniere_installation).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="p-3">
                  {a.active ? <Badge className="bg-emerald-100 text-emerald-700">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ZonesTab() {
  const fn = useServerFn(supervisorZones);
  const { data, isLoading } = useQuery({ queryKey: ["sup-zones"], queryFn: () => fn() });
  return (
    <Card className="mt-4 p-4">
      {isLoading ? <Loading /> : !data ? <Empty /> : (
        <div className="space-y-4">
          <section>
            <h3 className="font-semibold text-slate-900 mb-2">Régions ({data.regions.length})</h3>
            <div className="flex flex-wrap gap-2">
              {data.regions.map((r: any) => (
                <Badge key={r.id} variant="outline">{r.name} ({r.code})</Badge>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-semibold text-slate-900 mb-2">Communes ({data.communes.length})</h3>
            <div className="text-sm text-slate-600 max-h-64 overflow-y-auto">
              {data.communes.slice(0, 100).map((c: any) => (
                <div key={c.id} className="py-1 border-b border-slate-100">{c.name}</div>
              ))}
              {data.communes.length > 100 && <div className="text-xs text-slate-400 pt-2">… et {data.communes.length - 100} autres</div>}
            </div>
          </section>
          <section>
            <h3 className="font-semibold text-slate-900 mb-2">Districts ({data.districts.length})</h3>
          </section>
        </div>
      )}
    </Card>
  );
}

function Loading() { return <div className="p-8 text-center text-slate-500">Chargement…</div>; }
function Empty() { return <div className="p-8 text-center text-slate-500">Aucune donnée.</div>; }
