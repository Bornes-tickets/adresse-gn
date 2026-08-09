import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Flag,
  MapPin,
  Minus,
  QrCode,
  Target,
  UserSquare2,
} from "lucide-react";

import { AdminPointsMap } from "@/components/admin/AdminPointsMap";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeFr, statusLabel } from "@/lib/admin";
import { ACCENT_CLASSES, type AccentAdmin } from "@/lib/admin-nav";
import { adminDashboard } from "@/lib/admin.functions";
import { categoryLabel } from "@/lib/geo";
import { cn } from "@/lib/utils";

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

const PERIODES = [
  { cle: 7, label: "7 j" },
  { cle: 30, label: "30 j" },
  { cle: 90, label: "90 j" },
] as const;

function pourcentage(actuel: number, precedent: number): number | null {
  if (precedent === 0) return actuel === 0 ? 0 : null;
  return Math.round(((actuel - precedent) / precedent) * 100);
}

function Sparkline({ data, couleur }: { data: { jour: string; total: number }[]; couleur: string }) {
  const id = useMemo(() => `spark-${Math.random().toString(36).slice(2)}`, []);
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={couleur} stopOpacity={0.35} />
              <stop offset="100%" stopColor={couleur} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="total"
            stroke={couleur}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface KpiProps {
  titre: string;
  valeur: string;
  accent: AccentAdmin;
  icone: typeof QrCode;
  detail?: string;
  delta?: number | null;
  serie?: { jour: string; total: number }[];
  lien?: string;
}

function Kpi({ titre, valeur, accent, icone: Icone, detail, delta, serie, lien }: KpiProps) {
  const a = ACCENT_CLASSES[accent];
  const FlecheDelta = delta == null ? Minus : delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;

  return (
    <Card className="group relative overflow-hidden border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className={cn("absolute inset-x-0 top-0 h-1", a.puce)} />
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{titre}</CardTitle>
        <span
          className={cn("flex size-9 items-center justify-center rounded-xl border", a.fond, a.bordure)}
        >
          <Icone className={cn("size-4", a.texte)} />
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold tabular-nums text-foreground">{valeur}</p>
          {delta !== undefined && (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                delta == null || delta === 0
                  ? "bg-muted text-muted-foreground"
                  : delta > 0
                    ? "bg-admin-green/10 text-admin-green"
                    : "bg-admin-red/10 text-admin-red",
              )}
            >
              <FlecheDelta className="size-3" />
              {delta == null ? "n/a" : `${Math.abs(delta)}%`}
            </span>
          )}
        </div>
        {serie && serie.length > 1 && <Sparkline data={serie} couleur={a.variable} />}
        <div className="flex items-center justify-between gap-2">
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
          {lien && (
            <Link
              to={lien}
              className={cn(
                "ml-auto inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100",
                a.texte,
              )}
            >
              Voir détails <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TooltipPerso({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums text-muted-foreground">
          {p.name} : <span className="font-semibold text-popover-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

const COULEURS_STATUT: Record<string, AccentAdmin> = {
  active: "green",
  generated: "blue",
  assigned: "cyan",
  suspended: "amber",
  cancelled: "red",
};

const GNF = new Intl.NumberFormat("fr-FR");

function AdminDashboard() {
  const charger = useServerFn(adminDashboard);
  const [jours, setJours] = useState<number>(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => charger(),
  });

  if (error) {
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const serie = data.installationsParJour.slice(-jours);
  const serieCourte = data.installationsParJour.slice(-14);
  const totalBalises = data.statutsBalises.reduce((t, s) => t + s.total, 0) || 1;
  const totalAdresses = data.adressesPubliques + data.adressesPrivees;

  const donut = data.statutsBalises.filter((s) => s.total > 0);
  const objectifLabels: Record<string, string> = {
    installations: "Installations du mois",
    adresses: "Nouvelles adresses du mois",
    revenus: "Revenus encaissés (GNF)",
  };
  const objectifAccents: Record<string, AccentAdmin> = {
    installations: "green",
    adresses: "cyan",
    revenus: "orange",
  };

  return (
    <div className="space-y-6">
      {/* Filtres globaux */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Vue d'ensemble</h2>
          <p className="text-sm text-muted-foreground">
            Réseau Adresse GN — {totalAdresses} adresses actives, {data.points.length} géolocalisées.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {PERIODES.map((p) => (
            <button
              key={p.cle}
              type="button"
              onClick={() => setJours(p.cle)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                jours === p.cle
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bande KPI multicolore */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titre="Balises actives"
          valeur={String(data.balisesActives)}
          accent="blue"
          icone={QrCode}
          detail={`${Math.round((data.balisesActives / totalBalises) * 100)}% du parc`}
          lien="/admin/beacons"
        />
        <Kpi
          titre="Installations (7 j)"
          valeur={String(data.tendances.installations.actuel)}
          accent="green"
          icone={ClipboardCheck}
          delta={pourcentage(
            data.tendances.installations.actuel,
            data.tendances.installations.precedent,
          )}
          serie={serieCourte}
          detail="vs 7 jours précédents"
          lien="/admin/installations"
        />
        <Kpi
          titre="Nouvelles adresses (7 j)"
          valeur={String(data.tendances.adresses.actuel)}
          accent="cyan"
          icone={MapPin}
          delta={pourcentage(data.tendances.adresses.actuel, data.tendances.adresses.precedent)}
          detail="vs 7 jours précédents"
          lien="/admin/addresses"
        />
        <Kpi
          titre="Commandes (7 j)"
          valeur={String(data.tendances.commandes.actuel)}
          accent="orange"
          icone={CreditCard}
          delta={pourcentage(data.tendances.commandes.actuel, data.tendances.commandes.precedent)}
          detail="vs 7 jours précédents"
          lien="/admin/payments"
        />
        <Kpi
          titre="Balises à installer"
          valeur={String(data.balisesGenerees)}
          accent="amber"
          icone={CalendarClock}
          detail="En attente de pose"
          lien="/admin/installations-attente"
        />
        <Kpi
          titre="Signalements ouverts"
          valeur={String(data.signalementsOuverts)}
          accent="pink"
          icone={Flag}
          detail="À traiter"
          lien="/admin/reports"
        />
        <Kpi
          titre="Agents actifs"
          valeur={String(data.agentsActifs)}
          accent="violet"
          icone={UserSquare2}
          detail="Terrain"
          lien="/admin/agents"
        />
        <Kpi
          titre="Adresses publiques"
          valeur={String(data.adressesPubliques)}
          accent="lime"
          icone={MapPin}
          detail={`${data.adressesPrivees} privées`}
          lien="/admin/addresses"
        />
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/70 shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Installations par jour ({jours} jours)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie}>
                <defs>
                  <linearGradient id="gradInstall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-admin-green)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-admin-green)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="jour"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  minTickGap={16}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                <ReTooltip content={<TooltipPerso />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Installations"
                  stroke="var(--color-admin-green)"
                  strokeWidth={2}
                  fill="url(#gradInstall)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Statuts des balises</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="total" nameKey="statut" innerRadius={46} outerRadius={70}>
                    {donut.map((s) => (
                      <Cell
                        key={s.statut}
                        fill={ACCENT_CLASSES[COULEURS_STATUT[s.statut] ?? "slate"].variable}
                      />
                    ))}
                  </Pie>
                  <ReTooltip content={<TooltipPerso />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">
              {donut.map((s) => (
                <li key={s.statut} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      ACCENT_CLASSES[COULEURS_STATUT[s.statut] ?? "slate"].puce,
                    )}
                  />
                  <span className="text-muted-foreground">{statusLabel(s.statut)}</span>
                  <span className="ml-auto tabular-nums font-medium text-foreground">
                    {Math.round((s.total / totalBalises) * 100)}%
                  </span>
                  <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">
                    {s.total}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Activité temps réel */}
        <Card className="border-border/70 shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="installations">
              <TabsList>
                <TabsTrigger value="installations">Installations</TabsTrigger>
                <TabsTrigger value="commandes">Commandes</TabsTrigger>
                <TabsTrigger value="signalements">Signalements</TabsTrigger>
              </TabsList>

              <TabsContent value="installations" className="mt-4 space-y-2">
                {data.activite.installations.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune installation enregistrée.
                  </p>
                )}
                {data.activite.installations.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-admin-green/10">
                      <ClipboardCheck className="size-4 text-admin-green" />
                    </span>
                    <span className="font-mono text-sm text-foreground">{i.numero ?? "—"}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTimeFr(i.date)}
                    </span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="commandes" className="mt-4 space-y-2">
                {data.activite.commandes.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune commande pour le moment.
                  </p>
                )}
                {data.activite.commandes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-admin-orange/10">
                      <CreditCard className="size-4 text-admin-orange" />
                    </span>
                    <span className="font-mono text-sm text-foreground">{c.ref}</span>
                    <Badge variant="secondary">{statusLabel(c.statut)}</Badge>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {GNF.format(c.montant)} GNF
                    </span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="signalements" className="mt-4 space-y-2">
                {data.activite.signalements.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucun signalement.
                  </p>
                )}
                {data.activite.signalements.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-admin-pink/10">
                      <Flag className="size-4 text-admin-pink" />
                    </span>
                    <span className="truncate text-sm text-foreground">{r.raison}</span>
                    <Badge variant="secondary">{statusLabel(r.statut)}</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTimeFr(r.date)}
                    </span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Objectifs mensuels */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="size-4 text-admin-violet" />
            <CardTitle className="text-base">Objectifs du mois</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.objectifs.map((o) => {
              const pct = Math.min(100, Math.round((o.valeur / o.cible) * 100));
              return (
                <div key={o.cle} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{objectifLabels[o.cle] ?? o.cle}</span>
                    <span className="tabular-nums font-medium text-foreground">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {GNF.format(o.valeur)} / {GNF.format(o.cible)}{" "}
                    <span className={ACCENT_CLASSES[objectifAccents[o.cle] ?? "slate"].texte}>•</span>
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Top zones */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top 5 zones les plus actives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topZones.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune zone renseignée.</p>
            )}
            {data.topZones.map((z, i) => {
              const max = data.topZones[0]?.total || 1;
              return (
                <div key={z.nom} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <span className="flex size-5 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      {z.nom}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{z.total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-admin-cyan"
                      style={{ width: `${Math.round((z.total / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Catégories */}
        <Card className="border-border/70 shadow-sm">
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="libelle" tick={{ fontSize: 10 }} interval={0} angle={-20} dy={8} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                <ReTooltip content={<TooltipPerso />} />
                <Bar
                  dataKey="total"
                  name="Adresses"
                  fill="var(--color-admin-violet)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
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
