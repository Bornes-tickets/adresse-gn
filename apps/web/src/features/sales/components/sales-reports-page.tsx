"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Activity,
  Download,
  RefreshCw,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  getBackofficeRoleDashboard,
} from "@/features/backoffice/api";

import type {
  BackofficeRoleDashboardResponse,
} from "@/features/backoffice/api";

import {
  getAccessToken,
} from "@/lib/supabase/browser";


function metricValue(
  value: number,
  format:
    | "number"
    | "gnf",
): string {
  const formatted =
    new Intl.NumberFormat(
      "fr-FR",
    ).format(
      value,
    );

  return format
    === "gnf"
      ? `${formatted} GNF`
      : formatted;
}


function formatActivityDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    },
  ).format(
    date,
  );
}


function exportReport(
  data:
    BackofficeRoleDashboardResponse,
) {
  const rows:
    string[][] = [
      [
        "Indicateur",
        "Valeur",
      ],

      ...data.metrics.map(
        (metric) => [
          metric.label,
          metricValue(
            metric.value,
            metric.format,
          ),
        ],
      ),

      [],

      [
        "Activité",
        "Client",
        "Statut",
        "Date",
      ],

      ...data.activity.map(
        (item) => [
          item.primary,
          item.secondary
            ?? "",
          item.status
            ?? "",
          formatActivityDate(
            item.date,
          ),
        ],
      ),
    ];

  const quote =
    (value: string) =>
      `"${value.replaceAll(
        "\"",
        "\"\"",
      )}"`;

  const content =
    rows
      .map(
        (row) =>
          row
            .map(
              (
                value,
              ) =>
                quote(
                  value,
                ),
            )
            .join(","),
      )
      .join("\n");

  const blob =
    new Blob(
      [
        "\uFEFF",
        content,
      ],
      {
        type:
          "text/csv;charset=utf-8",
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href =
    url;

  anchor.download =
    `rapport-commercial-${
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        )
    }.csv`;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url,
  );
}


export function SalesReportsPage() {
  const [
    data,
    setData,
  ] = useState<
    BackofficeRoleDashboardResponse
    | null
  >(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(
    false,
  );

  const [
    error,
    setError,
  ] = useState(
    "",
  );


  const load =
    useCallback(
      async (
        silent = false,
      ) => {
        if (silent) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

        setError(
          "",
        );

        try {
          const token =
            await getAccessToken();

          if (!token) {
            throw new Error(
              "Votre session a expiré.",
            );
          }

          const result =
            await getBackofficeRoleDashboard(
              token,
              "sales",
            );

          setData(
            result,
          );
        }
        catch(loadError) {
          setError(
            loadError
              instanceof Error
              ? loadError.message
              : "Impossible de charger le rapport commercial.",
          );
        }
        finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void load();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    },
    [
      load,
    ],
  );


  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Commercial
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Rapports
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Synthèse de l&apos;activité commerciale, des commandes et des encaissements.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              !data
            }
            onClick={() => {
              if (data) {
                exportReport(
                  data,
                );
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter le rapport
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={
              refreshing
            }
            onClick={() =>
              void load(
                true,
              )
            }
          >
            <RefreshCw
              className={[
                "mr-2 h-4 w-4",
                refreshing
                  ? "animate-spin"
                  : "",
              ].join(
                " ",
              )}
            />

            Actualiser
          </Button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border bg-white text-sm text-slate-500">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Préparation du rapport...
        </div>
      ) : data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map(
              (metric) => (
                <article
                  key={
                    metric.key
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {metric.label}
                  </p>

                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {metricValue(
                      metric.value,
                      metric.format,
                    )}
                  </p>
                </article>
              ),
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <Activity className="h-5 w-5 text-blue-600" />

              <h2 className="font-bold text-slate-950">
                Activité commerciale récente
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {data.activity.length ? (
                data.activity.map(
                  (item) => (
                    <article
                      key={
                        item.id
                      }
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-950">
                          {item.primary}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {item.secondary
                            ?? "—"}
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-sm font-semibold text-slate-700">
                          {item.status
                            ?? "—"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatActivityDate(
                            item.date,
                          )}
                        </p>
                      </div>
                    </article>
                  ),
                )
              ) : (
                <p className="px-5 py-12 text-center text-sm text-slate-500">
                  Aucune activité récente.
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
