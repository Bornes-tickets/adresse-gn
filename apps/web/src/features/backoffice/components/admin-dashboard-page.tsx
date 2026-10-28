"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Boxes,
  CircleAlert,
  ClipboardCheck,
  Globe2,
  MapPin,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/supabase/browser";

import {
  BackofficeApiError,
  type AdminDashboardResponse,
  getAdminDashboard,
} from "../api";

import {
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "./professional-ui";


function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}


function formatMoney(value: number) {
  return `${formatNumber(value)} GNF`;
}


function formatDate(value: string | null) {
  if (!value) {
    return "Date inconnue";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed);
}


const STATUS_LABELS: Record<string, string> = {
  generated: "Générées",
  available: "Disponibles",
  assigned: "Affectées",
  planned: "Planifiées",
  installed: "Installées",
  active: "Actives",
  suspended: "Suspendues",
  cancelled: "Annulées",
  replaced: "Remplacées",
};


const STATUS_ORDER = [
  "generated",
  "available",
  "assigned",
  "planned",
  "installed",
  "active",
  "suspended",
  "cancelled",
  "replaced",
];


const OBJECTIVE_LABELS: Record<string, string> = {
  adresses: "Adresses",
  installations: "Installations",
  revenus: "Revenus",
  commandes: "Commandes",
};


export function AdminDashboardPage() {
  const router = useRouter();

  const [
    data,
    setData,
  ] = useState<AdminDashboardResponse | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const token = await getAccessToken();

        if (!token) {
          router.replace("/login?returnTo=%2Fadmin");
          return;
        }

        const result = await getAdminDashboard(
          token,
          controller.signal,
        );

        if (controller.signal.aborted) {
          return;
        }

        setData(result);
      }
      catch(loadError) {
        if (controller.signal.aborted) {
          return;
        }

        if (
          loadError instanceof BackofficeApiError
          && loadError.statusCode === 401
        ) {
          router.replace("/login?returnTo=%2Fadmin");
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le tableau de bord.",
        );
      }
      finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    router,
  ]);


  const sortedStatuses = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...data.statutsBalises].sort((left, right) => {
      const leftIndex = STATUS_ORDER.indexOf(left.statut);
      const rightIndex = STATUS_ORDER.indexOf(right.statut);

      return (
        (leftIndex < 0 ? 999 : leftIndex)
        - (rightIndex < 0 ? 999 : rightIndex)
      );
    });
  }, [
    data,
  ]);


  if (loading) {
    return (
      <LoadingState label="Chargement du pilotage national…" />
    );
  }


  if (
    error
    || !data
  ) {
    return (
      <ErrorState
        title="Tableau de bord indisponible"
        description={
          error
          || "Aucune donnée reçue."
        }
        onRetry={() => window.location.reload()}
      />
    );
  }


  const totalAddresses =
    data.adressesPubliques
    + data.adressesPrivees;

  const totalBeacons =
    data.statutsBalises.reduce(
      (total, item) =>
        total + item.total,
      0,
    );

  const recentActivity = [
    ...data.activite.installations.map((item) => ({
      id: `installation-${item.id}`,
      kind: "Installation",
      primary: item.numero || "Installation terrain",
      secondary: "Activité terrain",
      status: "installed",
      date: item.date,
    })),
    ...data.activite.commandes.map((item) => ({
      id: `order-${item.id}`,
      kind: "Commande",
      primary: item.ref,
      secondary: formatMoney(item.montant),
      status: item.statut,
      date: item.date,
    })),
    ...data.activite.signalements.map((item) => ({
      id: `report-${item.id}`,
      kind: "Signalement",
      primary: item.raison,
      secondary: "Suivi support",
      status: item.statut,
      date: item.date,
    })),
  ]
    .sort((left, right) => {
      const leftDate =
        left.date
          ? new Date(left.date).getTime()
          : 0;

      const rightDate =
        right.date
          ? new Date(right.date).getTime()
          : 0;

      return rightDate - leftDate;
    })
    .slice(0, 6);


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pilotage national"
        title="Réseau Adresse GN"
        description={
          `${formatNumber(totalAddresses)} adresses actives, `
          + `${formatNumber(totalBeacons)} balises suivies et `
          + `${formatNumber(data.agentsActifs)} agent(s) opérationnel(s).`
        }
        icon={Sparkles}
        actions={
          <>
            <Link
              href="/admin/balises"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E3660] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2E4A7B]"
            >
              <Boxes className="h-4 w-4" />
              Gérer les balises
            </Link>

            <Link
              href="/admin/adresses"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <MapPin className="h-4 w-4" />
              Voir les adresses
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Balises actives"
          value={formatNumber(data.balisesActives)}
          detail={`${formatNumber(totalBeacons)} balises au total`}
          icon={PackageCheck}
          accent="teal"
        />

        <MetricCard
          label="Adresses publiques"
          value={formatNumber(data.adressesPubliques)}
          detail={`${formatNumber(data.adressesPrivees)} privées`}
          icon={Globe2}
          accent="brand"
        />

        <MetricCard
          label="Installations — 7 jours"
          value={formatNumber(data.installations7j)}
          detail="Activité terrain récente"
          icon={ClipboardCheck}
          accent="violet"
        />

        <MetricCard
          label="Agents actifs"
          value={formatNumber(data.agentsActifs)}
          detail="Agents opérationnels"
          icon={Users}
          accent="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="À surveiller"
          description="Éléments qui méritent une attention administrative."
          icon={ShieldAlert}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/balises"
              className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-[#2E4A7B]/30 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Balises générées
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    En attente de prise en charge physique par OPS.
                  </p>
                </div>

                <strong className="text-2xl text-slate-950">
                  {formatNumber(data.balisesGenerees)}
                </strong>
              </div>

              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#2E4A7B]">
                Ouvrir le référentiel
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              href="/support/signalements"
              className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-rose-200 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Signalements ouverts
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Nouveaux ou encore en cours de traitement.
                  </p>
                </div>

                <strong className="text-2xl text-slate-950">
                  {formatNumber(data.signalementsOuverts)}
                </strong>
              </div>

              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                Consulter
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Nouvelles adresses — 7 jours
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Créations récentes dans le réseau.
                  </p>
                </div>

                <strong className="text-2xl text-slate-950">
                  {formatNumber(
                    data.tendances.adresses.actuel,
                  )}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Commandes — 7 jours
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Activité commerciale récente.
                  </p>
                </div>

                <strong className="text-2xl text-slate-950">
                  {formatNumber(
                    data.tendances.commandes.actuel,
                  )}
                </strong>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Actions rapides"
          description="Accéder directement aux opérations administratives courantes."
          icon={Activity}
        >
          <div className="grid gap-3">
            {[
              {
                href: "/admin/balises",
                title: "Générer un lot de balises",
                description: "Réserver de nouveaux numéros nationaux V1.",
                icon: Boxes,
              },
              {
                href: "/admin/adresses",
                title: "Consulter les adresses",
                description: "Rechercher et contrôler le référentiel national.",
                icon: MapPin,
              },
              {
                href: "/supervisor/installations",
                title: "Suivre les installations",
                description: "Voir l’avancement terrain et les contrôles QC.",
                icon: ClipboardCheck,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-[#2E4A7B]/30 hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2E4A7B]/8 text-[#2E4A7B]">
                    <Icon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                      {item.description}
                    </span>
                  </span>

                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2E4A7B]" />
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Cycle du parc de balises"
        description="Lecture consolidée des statuts du parc physique et numérique."
        icon={Boxes}
      >
        {sortedStatuses.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedStatuses.map((item) => (
              <div
                key={item.statut}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge
                    status={item.statut}
                    label={
                      STATUS_LABELS[item.statut]
                      ?? item.statut
                    }
                  />

                  <strong className="text-2xl text-slate-950">
                    {formatNumber(item.total)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Aucun statut disponible.
          </p>
        )}
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Top zones"
          description="Zones concentrant le plus d’adresses dans les données actuelles."
          icon={MapPin}
        >
          <div className="space-y-2">
            {data.topZones.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Aucune donnée disponible.
              </p>
            ) : (
              data.topZones.map((zone, index) => (
                <div
                  key={zone.nom}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                      {index + 1}
                    </span>

                    <span className="truncate text-sm font-medium text-slate-700">
                      {zone.nom}
                    </span>
                  </div>

                  <strong className="text-sm text-slate-950">
                    {formatNumber(zone.total)}
                  </strong>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Objectifs du mois"
          description="Suivi des objectifs de pilotage disponibles."
          icon={Target}
        >
          <div className="space-y-4">
            {data.objectifs.map((objective) => {
              const percent =
                objective.cible > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (
                          objective.valeur
                          / objective.cible
                        )
                        * 100,
                      ),
                    )
                  : 0;

              const monetary =
                objective.cle === "revenus";

              return (
                <div
                  key={objective.cle}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {OBJECTIVE_LABELS[objective.cle] ?? objective.cle}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Objectif :
                        {" "}
                        {monetary
                          ? formatMoney(objective.cible)
                          : formatNumber(objective.cible)}
                      </p>
                    </div>

                    <p className="text-right text-sm font-semibold text-slate-950">
                      {monetary
                        ? formatMoney(objective.valeur)
                        : formatNumber(objective.valeur)}
                    </p>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#2E4A7B] to-[#0EA5A4]"
                      style={{
                        width: `${percent}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-right text-xs font-semibold text-slate-500">
                    {percent} %
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Activité récente"
        description="Derniers événements administratifs consolidés."
        icon={Activity}
      >
        {recentActivity.length ? (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {item.kind}
                    </span>
                    {item.status ? (
                      <StatusBadge status={item.status} />
                    ) : null}
                  </div>

                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {item.primary}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.secondary}
                  </p>
                </div>

                <p className="shrink-0 text-xs text-slate-400">
                  {formatDate(item.date)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            Aucune activité récente disponible.
          </p>
        )}
      </SectionCard>

      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-900">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="leading-6">
          Une balise au statut
          {" "}
          <strong>Générée</strong>
          {" "}
          représente un numéro national réservé. Elle ne devient
          {" "}
          <strong>Disponible</strong>
          {" "}
          qu’après commande fournisseur, réception physique et contrôle qualité conformes par OPS.
        </p>
      </div>
    </div>
  );
}
