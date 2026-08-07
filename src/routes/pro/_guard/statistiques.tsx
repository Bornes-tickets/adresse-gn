import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { proEstablishments, proStats } from "@/lib/pro.functions";

export const Route = createFileRoute("/pro/_guard/statistiques")({
  head: () => ({
    meta: [
      { title: "Statistiques de visibilité — Espace pro Adresse GN" },
      {
        name: "description",
        content:
          "Analysez vos recherches, vos heures de pointe, la répartition des itinéraires et votre taux de conversion.",
      },
      { property: "og:title", content: "Statistiques de visibilité — Espace pro Adresse GN" },
      { property: "og:description", content: "Données de fréquentation de vos établissements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StatistiquesPage,
});

const COULEURS = ["#2E4A7B", "#0EA5A4", "#F59E0B", "#EF4444", "#8B5CF6"];

function StatistiquesPage() {
  const [fiche, setFiche] = useState<string>("");
  const [jours, setJours] = useState("30");

  const fiches = useQuery({
    queryKey: ["pro-establishments"],
    queryFn: () => proEstablishments(),
  });

  const idActif = fiche || fiches.data?.[0]?.id || "";

  const stats = useQuery({
    queryKey: ["pro-stats", idActif, jours],
    queryFn: () => proStats({ data: { id: idActif, jours: Number(jours) } }),
    enabled: !!idActif,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Statistiques</h1>
          <p className="text-sm text-muted-foreground">Fréquentation de vos fiches publiques.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={idActif} onValueChange={setFiche}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Établissement" />
            </SelectTrigger>
            <SelectContent>
              {fiches.data?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.business_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={jours} onValueChange={setJours}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!fiches.isPending && !fiches.data?.length && (
        <p className="text-sm text-muted-foreground">
          Créez d'abord une fiche établissement pour voir des statistiques.
        </p>
      )}

      {stats.isPending && !!idActif && <Skeleton className="h-72 w-full" />}

      {stats.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-semibold text-foreground">
                  {stats.data.totalSearches}
                </p>
                <p className="text-xs text-muted-foreground">Recherches</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-semibold text-foreground">{stats.data.totalRoutes}</p>
                <p className="text-xs text-muted-foreground">Itinéraires lancés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-semibold text-foreground">{stats.data.conversion} %</p>
                <p className="text-xs text-muted-foreground">Taux de conversion</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recherches par jour</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.data.searchesByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => new Date(String(v)).toLocaleDateString("fr-FR")}
                    fontSize={11}
                  />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip
                    labelFormatter={(v) => new Date(String(v)).toLocaleDateString("fr-FR")}
                  />
                  <Line type="monotone" dataKey="count" stroke={COULEURS[0]} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Heures de pointe</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.data.heatmap}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip labelFormatter={(h) => `${h}h`} />
                    <Bar dataKey="count" fill={COULEURS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Applications d'itinéraire</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {stats.data.routesByProvider.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.data.routesByProvider}
                        dataKey="count"
                        nameKey="provider"
                        outerRadius={90}
                        label
                      >
                        {stats.data.routesByProvider.map((_, index) => (
                          <Cell key={index} fill={COULEURS[index % COULEURS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun itinéraire sur la période.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
