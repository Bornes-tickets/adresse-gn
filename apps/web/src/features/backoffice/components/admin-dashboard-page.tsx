"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  Activity,
  CircleAlert,
  ClipboardCheck,
  Globe2,
  MapPin,
  PackageCheck,
  Users,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  BackofficeApiError,
  type AdminDashboardResponse,
  getAdminDashboard,
} from "../api";


function formatNumber(
  value: number,
){
  return new Intl.NumberFormat(
    "fr-FR",
  ).format(value);
}


function formatMoney(
  value: number,
){
  return (
    formatNumber(value)
    + " GNF"
  );
}


function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Activity;
}){
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {formatNumber(value)}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {detail}
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 p-2.5">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}


export function AdminDashboardPage(){
  const router =
    useRouter();

  const [
    data,
    setData,
  ] = useState<
    AdminDashboardResponse | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function load(){
      try{
        const token =
          await getAccessToken();

        if(!token){
          router.replace(
            "/login?returnTo=%2Fadmin",
          );

          return;
        }

        const result =
          await getAdminDashboard(
            token,
            controller.signal,
          );

        if(
          controller.signal.aborted
        ){
          return;
        }

        setData(result);
      }
      catch(loadError){
        if(
          controller.signal.aborted
        ){
          return;
        }

        if(
          loadError instanceof
            BackofficeApiError
          && loadError.statusCode === 401
        ){
          router.replace(
            "/login?returnTo=%2Fadmin",
          );

          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le tableau de bord.",
        );
      }
      finally{
        if(
          !controller.signal.aborted
        ){
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  },[
    router,
  ]);

  if(loading){
    return (
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="h-36 animate-pulse rounded-2xl bg-slate-200" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({
            length: 8,
          }).map(
            (_,index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl bg-slate-200"
              />
            ),
          )}
        </div>
      </div>
    );
  }

  if(
    error
    || !data
  ){
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <div className="flex gap-3">
          <CircleAlert className="h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Tableau de bord indisponible
            </p>

            <p className="mt-1 text-sm">
              {error
                || "Aucune donnée reçue."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalAddresses =
    data.adressesPubliques
    + data.adressesPrivees;

  const totalBeacons =
    data.statutsBalises.reduce(
      (total,item) =>
        total + item.total,
      0,
    );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="rounded-2xl bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Pilotage national
        </p>

        <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
          Réseau Adresse GN
        </h2>

        <p className="mt-3 text-sm text-slate-300">
          {formatNumber(
            totalAddresses,
          )}
          {" "}
          adresses actives —
          {" "}
          {formatNumber(
            data.points.length,
          )}
          {" "}
          géolocalisées.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Balises actives"
          value={data.balisesActives}
          detail={`${formatNumber(totalBeacons)} balises au total`}
          icon={PackageCheck}
        />

        <Metric
          label="Adresses publiques"
          value={data.adressesPubliques}
          detail={`${formatNumber(data.adressesPrivees)} privées`}
          icon={Globe2}
        />

        <Metric
          label="Installations — 7 jours"
          value={data.installations7j}
          detail="Activité terrain récente"
          icon={ClipboardCheck}
        />

        <Metric
          label="Agents actifs"
          value={data.agentsActifs}
          detail="Agents opérationnels"
          icon={Users}
        />

        <Metric
          label="Balises générées"
          value={data.balisesGenerees}
          detail="Statut historique conservé"
          icon={MapPin}
        />

        <Metric
          label="Signalements ouverts"
          value={data.signalementsOuverts}
          detail="Nouveaux ou en cours"
          icon={CircleAlert}
        />

        <Metric
          label="Adresses — 7 jours"
          value={
            data.tendances
              .adresses
              .actuel
          }
          detail="Nouvelles adresses"
          icon={MapPin}
        />

        <Metric
          label="Commandes — 7 jours"
          value={
            data.tendances
              .commandes
              .actuel
          }
          detail="Commandes récentes"
          icon={Activity}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold">
            État du parc
          </h3>

          <div className="mt-5 space-y-3">
            {data.statutsBalises.map(
              (item) => (
                <div
                  key={item.statut}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm capitalize text-slate-600">
                    {item.statut}
                  </span>

                  <strong>
                    {formatNumber(
                      item.total,
                    )}
                  </strong>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold">
            Top zones
          </h3>

          <div className="mt-5 space-y-3">
            {data.topZones.length === 0
              ? (
                  <p className="text-sm text-slate-500">
                    Aucune donnée disponible.
                  </p>
                )
              : data.topZones.map(
                  (zone,index) => (
                    <div
                      key={zone.nom}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm text-slate-600">
                        {index + 1}.
                        {" "}
                        {zone.nom}
                      </span>

                      <strong>
                        {formatNumber(
                          zone.total,
                        )}
                      </strong>
                    </div>
                  ),
                )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold">
          Objectifs du mois
        </h3>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {data.objectifs.map(
            (objective) => {
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

              return (
                <div
                  key={objective.cle}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <p className="text-sm font-medium capitalize">
                    {objective.cle}
                  </p>

                  <p className="mt-2 text-xl font-semibold">
                    {objective.cle ===
                      "revenus"
                      ? formatMoney(
                          objective.valeur,
                        )
                      : formatNumber(
                          objective.valeur,
                        )}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Objectif :
                    {" "}
                    {objective.cle ===
                      "revenus"
                      ? formatMoney(
                          objective.cible,
                        )
                      : formatNumber(
                          objective.cible,
                        )}
                  </p>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{
                        width:
                          `${percent}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs font-medium">
                    {percent} %
                  </p>
                </div>
              );
            },
          )}
        </div>
      </section>
    </div>
  );
}