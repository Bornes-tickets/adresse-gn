import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supervisorDashboard } from "@/lib/supervisor.functions";
import { Card } from "@/components/ui/card";
import {
  Radio,
  MapPin,
  ClipboardCheck,
  AlertTriangle,
  Users,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/supervisor/_guard/")({
  component: SupervisorDashboard,
});

function SupervisorDashboard() {
  const fn = useServerFn(supervisorDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["supervisor-dashboard"],
    queryFn: () => fn(),
  });

  if (isLoading) return <div className="p-6 text-slate-500">Chargement…</div>;
  if (!data) return <div className="p-6 text-red-600">Erreur de chargement.</div>;

  const kpis = [
    { label: "Balises actives", value: data.balisesActives, icon: Radio, color: "emerald" },
    { label: "Balises générées", value: data.balisesGenerees, icon: Sparkles, color: "violet" },
    { label: "Installations 7j", value: data.installations7j, icon: ClipboardCheck, color: "sky" },
    { label: "Adresses publiques", value: data.adressesPubliques, icon: MapPin, color: "indigo" },
    { label: "Signalements ouverts", value: data.signalementsOuverts, icon: AlertTriangle, color: "amber" },
    { label: "Agents actifs", value: data.agentsActifs, icon: Users, color: "rose" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-600">Vue d'ensemble opérationnelle Adresse GN.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{k.label}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{k.value.toLocaleString("fr-FR")}</div>
              </div>
              <div className={`h-11 w-11 rounded-lg bg-${k.color}-100 text-${k.color}-600 flex items-center justify-center`}>
                <Icon className="h-5 w-5" />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Installations récentes</h2>
          <div className="space-y-2">
            {data.activite.installations.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune installation récente.</p>
            ) : (
              data.activite.installations.map((i) => (
                <div key={i.id} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                  <span className="font-mono text-slate-700">{i.numero ?? "—"}</span>
                  <span className="text-slate-500">{i.date ? new Date(i.date).toLocaleString("fr-FR") : "—"}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Signalements récents</h2>
          <div className="space-y-2">
            {data.activite.signalements.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun signalement récent.</p>
            ) : (
              data.activite.signalements.map((r) => (
                <div key={r.id} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                  <span className="text-slate-700">{r.raison}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{r.statut}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Top 5 zones (adresses actives)</h2>
        <div className="space-y-2">
          {data.topZones.map((z) => (
            <div key={z.nom} className="flex justify-between text-sm">
              <span className="text-slate-700">{z.nom}</span>
              <span className="font-semibold text-slate-900">{z.total}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
