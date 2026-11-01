"use client";

import type {
  FormEvent,
} from "react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  listBackofficeResource,
} from "@/features/backoffice/api";

import {
  getAccessToken,
} from "@/lib/supabase/browser";


type SalesDataMode =
  | "clients"
  | "offers"
  | "subscriptions"
  | "installations";


type SalesDataConfig = {
  resource: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  columns: string[];
};


const CONFIGS:
  Record<
    SalesDataMode,
    SalesDataConfig
  > = {
    clients: {
      resource:
        "sales_clients",
      title:
        "Clients",
      subtitle:
        "Portefeuille clients et activité commerciale.",
      searchPlaceholder:
        "Rechercher un client, un email ou un téléphone",
      columns: [
        "full_name",
        "email",
        "phone",
        "account_status",
        "commandes",
        "montant_commandes_gnf",
        "created_at",
      ],
    },

    offers: {
      resource:
        "sales_offers",
      title:
        "Offres",
      subtitle:
        "Catalogue des offres commercialisées par Adresse GN.",
      searchPlaceholder:
        "Rechercher une offre ou un code",
      columns: [
        "code",
        "name",
        "audience",
        "price_gnf",
        "recurring_price_gnf",
        "billing_period",
        "requires_quote",
        "active",
      ],
    },

    subscriptions: {
      resource:
        "sales_subscriptions",
      title:
        "Abonnements",
      subtitle:
        "Suivi des abonnements, échéances et renouvellements.",
      searchPlaceholder:
        "Rechercher un client ou une offre",
      columns: [
        "client_name",
        "client_email",
        "plan_code",
        "status",
        "price_gnf",
        "start_date",
        "end_date",
        "next_billing_date",
        "auto_renew",
      ],
    },

    installations: {
      resource:
        "sales_installations",
      title:
        "Installations à planifier",
      subtitle:
        "Suivi commercial des installations physiques.",
      searchPlaceholder:
        "Rechercher une commande, un client ou un numéro",
      columns: [
        "order_ref",
        "client_name",
        "phone",
        "public_number",
        "status",
        "agent_name",
        "scheduled_at",
        "completed_at",
      ],
    },
  };


const LABELS:
  Record<string, string> = {
    full_name:
      "Client",
    email:
      "Email",
    phone:
      "Téléphone",
    account_status:
      "Compte",
    commandes:
      "Commandes",
    montant_commandes_gnf:
      "Valeur commandes",
    created_at:
      "Création",

    code:
      "Code",
    name:
      "Offre",
    audience:
      "Public",
    price_gnf:
      "Prix",
    recurring_price_gnf:
      "Prix récurrent",
    billing_period:
      "Facturation",
    requires_quote:
      "Sur devis",
    active:
      "Active",

    client_name:
      "Client",
    client_email:
      "Email",
    plan_code:
      "Offre",
    status:
      "Statut",
    start_date:
      "Début",
    end_date:
      "Fin",
    next_billing_date:
      "Prochaine échéance",
    auto_renew:
      "Renouvellement",

    order_ref:
      "Commande",
    public_number:
      "Numéro",
    agent_name:
      "Agent",
    scheduled_at:
      "Planification",
    completed_at:
      "Terminée le",
  };


const STATUS_LABELS:
  Record<string, string> = {
    active:
      "Actif",
    pending:
      "En attente",
    paid:
      "Payée",
    success:
      "Payé",
    failed:
      "Échoué",
    cancelled:
      "Annulé",
    canceled:
      "Annulé",
    completed:
      "Terminée",
    scheduled:
      "Planifiée",
    assigned:
      "Affectée",
    expired:
      "Expiré",
    suspended:
      "Suspendu",
    inactive:
      "Inactif",
    deactivated:
      "Désactivé",
  };


function localizedObject(
  value:
    Record<string, unknown>,
): string {
  for (
    const key
    of [
      "fr",
      "en",
      "ar",
    ]
  ) {
    const current =
      value[key];

    if (
      typeof current
        === "string"
      && current.trim()
    ) {
      return current;
    }
  }

  return JSON.stringify(
    value,
  );
}


function formatValue(
  key: string,
  value: unknown,
): string {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return "—";
  }

  if (
    typeof value
      === "boolean"
  ) {
    return value
      ? "Oui"
      : "Non";
  }

  if (
    typeof value
      === "number"
  ) {
    const formatted =
      new Intl.NumberFormat(
        "fr-FR",
      ).format(
        value,
      );

    return (
      /price|amount|montant/i.test(
        key,
      )
        ? `${formatted} GNF`
        : formatted
    );
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value
      .map(
        (item) =>
          typeof item
            === "object"
          && item !== null
            ? localizedObject(
                item as
                  Record<
                    string,
                    unknown
                  >,
              )
            : String(
                item,
              ),
      )
      .join(", ");
  }

  if (
    typeof value
      === "object"
  ) {
    return localizedObject(
      value as
        Record<
          string,
          unknown
        >,
    );
  }

  const text =
    String(
      value,
    );

  const normalized =
    text.toLowerCase();

  if (
    key === "status"
    || key
      === "account_status"
  ) {
    return (
      STATUS_LABELS[
        normalized
      ]
      ?? text
    );
  }

  if (
    key
      === "billing_period"
  ) {
    return (
      {
        none:
          "Paiement unique",
        month:
          "Mensuelle",
        monthly:
          "Mensuelle",
        year:
          "Annuelle",
        yearly:
          "Annuelle",
      }[
        normalized
      ]
      ?? text
    );
  }

  if (
    /^\d{4}-\d{2}-\d{2}/
      .test(
        text,
      )
  ) {
    const parsed =
      new Date(
        text,
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      return new Intl.DateTimeFormat(
        "fr-FR",
        text.includes(
          "T",
        )
          ? {
              dateStyle:
                "medium",
              timeStyle:
                "short",
            }
          : {
              dateStyle:
                "medium",
            },
      ).format(
        parsed,
      );
    }
  }

  return text;
}


function statusClass(
  value: unknown,
): string {
  const status =
    String(
      value
      ?? "",
    ).toLowerCase();

  if (
    [
      "active",
      "paid",
      "success",
      "completed",
    ].includes(
      status,
    )
  ) {
    return (
      "border-emerald-200 "
      + "bg-emerald-50 "
      + "text-emerald-700"
    );
  }

  if (
    [
      "pending",
      "scheduled",
      "assigned",
    ].includes(
      status,
    )
  ) {
    return (
      "border-amber-200 "
      + "bg-amber-50 "
      + "text-amber-700"
    );
  }

  if (
    [
      "failed",
      "cancelled",
      "canceled",
      "expired",
      "deactivated",
    ].includes(
      status,
    )
  ) {
    return (
      "border-rose-200 "
      + "bg-rose-50 "
      + "text-rose-700"
    );
  }

  return (
    "border-slate-200 "
    + "bg-slate-50 "
    + "text-slate-700"
  );
}


function exportCsv(
  title: string,
  columns: string[],
  rows:
    Array<
      Record<
        string,
        unknown
      >
    >,
) {
  const quote =
    (value: string) =>
      `"${value.replaceAll(
        "\"",
        "\"\"",
      )}"`;

  const lines = [
    columns
      .map(
        (column) =>
          quote(
            LABELS[column]
            ?? column,
          ),
      )
      .join(","),

    ...rows.map(
      (row) =>
        columns
          .map(
            (column) =>
              quote(
                formatValue(
                  column,
                  row[
                    column
                  ],
                ),
              ),
          )
          .join(","),
    ),
  ];

  const blob =
    new Blob(
      [
        "\uFEFF",
        lines.join(
          "\n",
        ),
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
    `adresse-gn-${title
      .toLowerCase()
      .replaceAll(
        " ",
        "-",
      )}.csv`;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url,
  );
}


export function SalesDataPage({
  mode,
}: {
  mode: SalesDataMode;
}) {
  const config =
    CONFIGS[
      mode
    ];

  const [
    data,
    setData,
  ] = useState<{
    items:
      Array<
        Record<
          string,
          unknown
        >
      >;
    total: number;
    page: number;
    page_size: number;
  } | null>(
    null,
  );

  const [
    page,
    setPage,
  ] = useState(
    1,
  );

  const [
    queryDraft,
    setQueryDraft,
  ] = useState(
    "",
  );

  const [
    query,
    setQuery,
  ] = useState(
    "",
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

  const [
    selected,
    setSelected,
  ] = useState<
    Record<
      string,
      unknown
    >
    | null
  >(
    null,
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
            await listBackofficeResource(
              token,
              config.resource,
              {
                page,
                pageSize:
                  25,
                query,
              },
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
              : "Impossible de charger les données.",
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
      [
        config.resource,
        page,
        query,
      ],
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


  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,
          Math.ceil(
            (
              data?.total
              ?? 0
            )
            / (
              data?.page_size
              ?? 25
            ),
          ),
        ),
      [
        data,
      ],
    );


  function submitSearch(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setPage(
      1,
    );

    setQuery(
      queryDraft.trim(),
    );
  }


  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Commercial
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {config.title}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {config.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={
              !data?.items.length
            }
            onClick={() =>
              exportCsv(
                config.title,
                config.columns,
                data?.items
                ?? [],
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={
            submitSearch
          }
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              value={
                queryDraft
              }
              onChange={
                (event) =>
                  setQueryDraft(
                    event.target.value,
                  )
              }
              placeholder={
                config.searchPlaceholder
              }
              className="h-11 pl-10"
            />
          </div>

          <Button
            type="submit"
            className="h-11 bg-slate-950 hover:bg-slate-800"
          >
            Rechercher
          </Button>
        </form>

        <div className="mt-3 flex justify-end">
          <span className="text-xs font-semibold text-slate-500">
            {new Intl.NumberFormat(
              "fr-FR",
            ).format(
              data?.total
              ?? 0,
            )} résultat(s)
          </span>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                {config.columns.map(
                  (column) => (
                    <th
                      key={
                        column
                      }
                      className="whitespace-nowrap px-4 py-3"
                    >
                      {LABELS[
                        column
                      ]
                        ?? column}
                    </th>
                  ),
                )}

                <th className="px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={
                      config.columns.length
                      + 1
                    }
                    className="px-6 py-16 text-center text-sm text-slate-500"
                  >
                    Chargement...
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map(
                  (
                    row,
                    index,
                  ) => (
                    <tr
                      key={
                        String(
                          row.id
                          ?? `${page}-${index}`,
                        )
                      }
                      className="hover:bg-slate-50"
                    >
                      {config.columns.map(
                        (
                          column,
                        ) => (
                          <td
                            key={
                              column
                            }
                            className="max-w-[300px] px-4 py-3 text-slate-700"
                          >
                            {(
                              column
                                === "status"
                              || column
                                === "account_status"
                            ) ? (
                              <span
                                className={[
                                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  statusClass(
                                    row[
                                      column
                                    ],
                                  ),
                                ].join(
                                  " ",
                                )}
                              >
                                {formatValue(
                                  column,
                                  row[
                                    column
                                  ],
                                )}
                              </span>
                            ) : (
                              formatValue(
                                column,
                                row[
                                  column
                                ],
                              )
                            )}
                          </td>
                        ),
                      )}

                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelected(
                              row,
                            )
                          }
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          Voir
                        </Button>
                      </td>
                    </tr>
                  ),
                )
              ) : (
                <tr>
                  <td
                    colSpan={
                      config.columns.length
                      + 1
                    }
                    className="px-6 py-16 text-center text-sm text-slate-500"
                  >
                    Aucun résultat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-500">
            Page {page} / {totalPages}
          </span>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={
                loading
                || page <= 1
              }
              onClick={() =>
                setPage(
                  (
                    current,
                  ) =>
                    Math.max(
                      1,
                      current - 1,
                    ),
                )
              }
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Précédent
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={
                loading
                || page
                  >= totalPages
              }
              onClick={() =>
                setPage(
                  (
                    current,
                  ) =>
                    Math.min(
                      totalPages,
                      current + 1,
                    ),
                )
              }
            >
              Suivant
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
                  {config.title}
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {formatValue(
                    config.columns[
                      0
                    ],
                    selected[
                      config.columns[
                        0
                      ]
                    ],
                  )}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(
                    null,
                  )
                }
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {config.columns.map(
                (column) => (
                  <div
                    key={
                      column
                    }
                    className="rounded-xl bg-slate-50 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {LABELS[
                        column
                      ]
                        ?? column}
                    </p>

                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                      {formatValue(
                        column,
                        selected[
                          column
                        ],
                      )}
                    </p>
                  </div>
                ),
              )}
            </div>

            <div className="flex justify-end border-t p-5">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSelected(
                    null,
                  )
                }
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
