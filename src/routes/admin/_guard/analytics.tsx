import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminPointsMap } from "@/components/admin/AdminPointsMap";
import { AdminTable } from "@/components/admin/AdminTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { adminAnalytics } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/analytics")({
  head: () => ({
    meta: [
      { title: "Statistiques d'usage — Administration Adresse GN" },
      {
        name: "description",
        content: "Recherches, itinéraires et zones les plus consultées sur Adresse GN.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const charger = useServerFn(adminAnalytics);
  const [jours, setJours] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics", jours],
    queryFn: () => charger({ data: { jours: Number(jours) } }),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-72 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select value={jours} onValueChange={setJours}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 jours</SelectItem>
            <SelectItem value="30">30 jours</SelectItem>
            <SelectItem value="90">90 jours</SelectItem>
            <SelectItem value="180">180 jours</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {data.recherchesTotal}
          </span>{" "}
          recherches ·{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {data.itinerairesTotal}
          </span>{" "}
          itinéraires lancés · conversion{" "}
          <span className="font-semibold text-foreground tabular-nums">{data.conversion} %</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recherches par jour</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.recherchesParJour}>
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itinéraires par application</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.parProvider}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="provider" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <ReTooltip />
                <Bar dataKey="total" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 20 des adresses recherchées</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminTable
              colonnes={[
                {
                  cle: "numero",
                  entete: "Numéro",
                  rendu: (l: { numero: string }) => (
                    <span className="font-mono text-sm">{l.numero}</span>
                  ),
                },
                {
                  cle: "total",
                  entete: "Recherches",
                  rendu: (l: { total: number }) => String(l.total),
                },
              ]}
              lignes={data.topAdresses}
              vide="Aucune recherche aboutie sur la période."
              cle={(l) => l.numero}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Densité des adresses actives</CardTitle>
        </CardHeader>
        <CardContent className="h-[420px] p-0">
          <AdminPointsMap points={data.chaleur} />
        </CardContent>
      </Card>
    </div>
  );
}
