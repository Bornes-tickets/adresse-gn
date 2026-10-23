"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Activity,
  CircleAlert,
  Gauge,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  type BackofficeRoleDashboardResponse,
  type BackofficeSpace,
  getBackofficeRoleDashboard,
} from "../api";


function formatValue(
  value: number,
  format: "number" | "gnf",
) {
  if (format === "gnf") {
    return `${new Intl.NumberFormat(
      "fr-FR",
    ).format(value)} GNF`;
  }

  return new Intl.NumberFormat(
    "fr-FR",
  ).format(value);
}


function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(value),
  );
}


export function RoleDashboardPage({
  space,
}: {
  space: BackofficeSpace;
}) {
  const [
    data,
    setData,
  ] = useState<
    BackofficeRoleDashboardResponse | null
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

    async function load() {
      setLoading(true);
      setError("");

      try {
        const token =
          await getAccessToken();

        if (!token) {
          throw new Error(
            "Session expirée.",
          );
        }

        const result =
          await getBackofficeRoleDashboard(
            token,
            space,
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
    space,
  ]);


  if(loading){
    return (
      <div className="space-y-5">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({
            length: 8,
          }).map(
            (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-slate-200"
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
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        {error || "Tableau de bord indisponible."}
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
            <Gauge className="h-5 w-5" />
          </span>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {data.title}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {data.subtitle}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map(
          (metric) => (
            <article
              key={metric.key}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-slate-500">
                {metric.label}
              </p>

              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {formatValue(
                  metric.value,
                  metric.format,
                )}
              </p>
            </article>
          ),
        )}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Activity className="h-4 w-4 text-slate-400" />

          <h2 className="font-semibold text-slate-950">
            Activité récente
          </h2>
        </div>

        {data.activity.length
          ? (
              <div className="divide-y">
                {data.activity.map(
                  (item) => (
                    <article
                      key={item.id}
                      className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-950">
                          {item.primary}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {item.secondary || "—"}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-xs font-medium text-slate-700">
                          {item.status || "—"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(
                            item.date,
                          )}
                        </p>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )
          : (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                Aucune activité récente.
              </p>
            )}
      </section>
    </div>
  );
}