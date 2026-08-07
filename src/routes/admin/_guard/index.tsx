import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminPointsMap } from "@/components/admin/AdminPointsMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminDashboard } from "@/lib/admin.functions";
import { categoryLabel } from "@/lib/geo";

export const Route = createFileRoute("/admin/_guard/")({
  head: () => ({
    meta: [
      { title: "Dashboard administration — Adresse GN" },
      {
        name: "description",
        content: "Pilotage opérationnel du réseau Adresse GN : balises, installations, adresses.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

function Kpi({ titre, valeur, detail }: { titre: string; valeur: string; detail?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titre}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums text-foreground">{valeur}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const charger = useServerFn(adminDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => charger(),
  });

  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const donut = [
    { name: "Publiques", value: data.adressesPubliques },
    { name: "Privées", value: data.adressesPrivees },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi titre="Balises actives" valeur={String(data.balisesActives)} />
        <Kpi
          titre="Balises générées non installées"
          valeur={String(data.balisesGenerees)}
          detail="En attente d'installation"
        />
        <Kpi titre="Installations (7 jours)" valeur={String(data.installations7j)} />
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Adresses publiques / privées
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="h-24 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" innerRadius={26} outerRadius={44}>
                    <Cell fill="var(--color-primary)" />
                    <Cell fill="var(--color-muted-foreground)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm">
              <p className="text-foreground">
                <span className="font-semibold tabular-nums">{data.adressesPubliques}</span>{" "}
                publiques
              </p>
              <p className="text-muted-foreground">
                <span className="font-semibold tabular-nums">{data.adressesPrivees}</span> privées
              </p>
            </div>
          </CardContent>
        </Card>
        <Kpi titre="Signalements ouverts" valeur={String(data.signalementsOuverts)} />
        <Kpi titre="Agents actifs" valeur={String(data.agentsActifs)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Installations par jour (30 jours)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.installationsParJour}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="jour" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <ReTooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.parCategorie.map((c) => ({
                  ...c,
                  libelle: categoryLabel(c.categorie),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="libelle" tick={{ fontSize: 10 }} interval={0} angle={-20} dy={8} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <ReTooltip />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">
            Adresses actives — Conakry ({data.points.length} points)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[60vh] p-0 md:h-[70vh]">
          <AdminPointsMap points={data.points} />
        </CardContent>
      </Card>
    </div>
  );
}
