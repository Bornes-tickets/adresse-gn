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
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
  XCircle,
} from "lucide-react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  listBackofficeResource,
} from "@/features/backoffice/api";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  confirmSalesPayment,
  listSalesPayments,
  rejectSalesPayment,
  SalesApiError,
} from "../api";

import type {
  SalesPaymentItem,
} from "../types";


type OrderRow = {
  id: string;
  order_ref: string;
  status: string;
  offre: string;
  offre_label: string;
  client_type: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  nb_adresses: number;
  amount_gnf: number;
  prix_ttc: number;
  payment_method: string;
  devis_demande: boolean;
  created_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  installed_at: string | null;
};


type ModalMode =
  | "detail"
  | "confirm"
  | "reject"
  | null;


function textValue(
  value: unknown,
): string {
  if (
    value === null
    || value === undefined
  ) {
    return "";
  }

  return String(value);
}


function numberValue(
  value: unknown,
): number {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function boolValue(
  value: unknown,
): boolean {
  return (
    value === true
    || value === "true"
    || value === 1
    || value === "1"
  );
}


function nullableText(
  value: unknown,
): string | null {
  const clean =
    textValue(value).trim();

  return clean || null;
}


function normalizeOrder(
  row: Record<string, unknown>,
): OrderRow {
  return {
    id: textValue(row.id),
    order_ref:
      textValue(row.order_ref),
    status:
      textValue(row.status),
    offre:
      textValue(row.offre),
    offre_label:
      textValue(row.offre_label),
    client_type:
      textValue(row.client_type),
    client_name:
      textValue(row.client_name),
    client_email:
      textValue(row.client_email),
    client_phone:
      textValue(row.client_phone),
    nb_adresses:
      numberValue(row.nb_adresses),
    amount_gnf:
      numberValue(row.amount_gnf),
    prix_ttc:
      numberValue(row.prix_ttc),
    payment_method:
      textValue(row.payment_method),
    devis_demande:
      boolValue(row.devis_demande),
    created_at:
      nullableText(row.created_at),
    submitted_at:
      nullableText(row.submitted_at),
    confirmed_at:
      nullableText(row.confirmed_at),
    installed_at:
      nullableText(row.installed_at),
  };
}


function formatGnf(
  amount: number,
): string {
  return `${
    new Intl.NumberFormat(
      "fr-FR",
      {
        maximumFractionDigits: 0,
      },
    ).format(amount)
  } GNF`;
}


function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
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


function humanStatus(
  value: string,
): string {
  const labels:
    Record<string, string> = {
      pending: "En attente",
      paid: "Payée",
      success: "Payé",
      failed: "Échoué",
      refunded: "Remboursé",
      cancelled: "Annulée",
      rejected: "Rejetée",
    };

  return (
    labels[value.toLowerCase()]
    ?? value
    ?? "—"
  );
}


function statusClass(
  value: string,
): string {
  const normalized =
    value.toLowerCase();

  if (
    [
      "paid",
      "success",
      "confirmed",
    ].includes(normalized)
  ) {
    return (
      "border-emerald-200 "
      + "bg-emerald-50 "
      + "text-emerald-700"
    );
  }

  if (
    normalized === "pending"
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
      "rejected",
    ].includes(normalized)
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
    + "text-slate-600"
  );
}


function sameDay(
  value: string | null,
  date: Date,
): boolean {
  if (!value) {
    return false;
  }

  const parsed =
    new Date(value);

  return (
    parsed.getFullYear()
      === date.getFullYear()
    && parsed.getMonth()
      === date.getMonth()
    && parsed.getDate()
      === date.getDate()
  );
}


function sameMonth(
  value: string | null,
  date: Date,
): boolean {
  if (!value) {
    return false;
  }

  const parsed =
    new Date(value);

  return (
    parsed.getFullYear()
      === date.getFullYear()
    && parsed.getMonth()
      === date.getMonth()
  );
}


function isPhysical(
  order: OrderRow,
): boolean {
  const value =
    `${order.offre} ${order.offre_label}`
      .toLowerCase();

  return !(
    value.includes("numerique")
    || value.includes("numérique")
    || value.includes("digital")
  );
}


function paymentText(
  payment:
    SalesPaymentItem | undefined,
  order: OrderRow,
): string {
  if (
    payment?.status === "success"
    || order.status === "paid"
  ) {
    return "Payé";
  }

  if (
    payment?.status === "failed"
  ) {
    return "Échoué";
  }

  if (
    payment?.status === "refunded"
  ) {
    return "Remboursé";
  }

  if (
    payment?.status === "pending"
    && order.payment_method === "manual"
  ) {
    return "À valider";
  }

  return "À payer";
}


function exportCsv(
  orders: OrderRow[],
) {
  const quote =
    (value: unknown) =>
      `"${String(
        value ?? "",
      ).replaceAll(
        "\"",
        "\"\"",
      )}"`;

  const lines = [
    [
      "Référence",
      "Client",
      "Email",
      "Téléphone",
      "Offre",
      "Statut",
      "Montant GNF",
      "Paiement",
      "Création",
      "Confirmation",
      "Installation",
    ]
      .map(quote)
      .join(","),

    ...orders.map(
      (order) => [
        order.order_ref,
        order.client_name,
        order.client_email,
        order.client_phone,
        order.offre_label,
        order.status,
        order.amount_gnf,
        order.payment_method,
        order.created_at,
        order.confirmed_at,
        order.installed_at,
      ]
        .map(quote)
        .join(","),
    ),
  ];

  const blob =
    new Blob(
      [
        "\uFEFF",
        lines.join("\n"),
      ],
      {
        type:
          "text/csv;charset=utf-8",
      },
    );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;

  anchor.download =
    `adresse-gn-commandes-${
      new Date()
        .toISOString()
        .slice(0, 10)
    }.csv`;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}


function KpiCard({
  label,
  value,
  helper,
  icon,
  className,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  className: string;
}) {
  return (
    <article
      className={[
        "rounded-2xl border p-4 shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          {icon}
        </span>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs font-medium text-slate-500">
        {helper}
      </p>
    </article>
  );
}


export function SalesOrdersPage({
  mode = "orders",
}: {
  mode?: "orders" | "quotes";
}) {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const urlQuery =
    searchParams.get("q")
    ?? "";

  const [
    orders,
    setOrders,
  ] = useState<OrderRow[]>([]);

  const [
    payments,
    setPayments,
  ] = useState<SalesPaymentItem[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    queryDraft,
    setQueryDraft,
  ] = useState(urlQuery);

  const [
    query,
    setQuery,
  ] = useState(urlQuery);

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    offerFilter,
    setOfferFilter,
  ] = useState("all");

  const [
    paymentFilter,
    setPaymentFilter,
  ] = useState("all");

  const [
    clientFilter,
    setClientFilter,
  ] = useState("all");

  const [
    fromDate,
    setFromDate,
  ] = useState("");

  const [
    toDate,
    setToDate,
  ] = useState("");

  const [
    showFilters,
    setShowFilters,
  ] = useState(true);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(10);

  const [
    selected,
    setSelected,
  ] = useState<OrderRow | null>(null);

  const [
    modalMode,
    setModalMode,
  ] = useState<ModalMode>(null);

  const [
    externalRef,
    setExternalRef,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    rejectReason,
    setRejectReason,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const loadData =
    useCallback(
      async (
        silent = false,
      ) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const token =
            await getAccessToken();

          if (!token) {
            router.replace(
              "/login?returnTo=%2Fsales%2Fcommandes",
            );

            return;
          }

          const firstOrders =
            await listBackofficeResource(
              token,
              "sales_orders",
              {
                page: 1,
                pageSize: 100,
                query,
              },
            );

          const orderPages =
            Math.max(
              1,
              Math.ceil(
                firstOrders.total
                / firstOrders.page_size,
              ),
            );

          const orderResponses =
            [firstOrders];

          for (
            let current = 2;
            current <= orderPages;
            current += 1
          ) {
            orderResponses.push(
              await listBackofficeResource(
                token,
                "sales_orders",
                {
                  page: current,
                  pageSize: 100,
                  query,
                },
              ),
            );
          }

          const firstPayments =
            await listSalesPayments({
              page: 1,
              pageSize: 100,
              status: "all",
            });

          const paymentPages =
            Math.max(
              1,
              Math.ceil(
                firstPayments.total
                / firstPayments.page_size,
              ),
            );

          const paymentResponses =
            [firstPayments];

          for (
            let current = 2;
            current <= paymentPages;
            current += 1
          ) {
            paymentResponses.push(
              await listSalesPayments({
                page: current,
                pageSize: 100,
                status: "all",
              }),
            );
          }

          setOrders(
            orderResponses
              .flatMap(
                (response) =>
                  response.items,
              )
              .map(
                normalizeOrder,
              ),
          );

          setPayments(
            paymentResponses.flatMap(
              (response) =>
                response.items,
            ),
          );
        }
        catch(loadError) {
          setError(
            loadError
              instanceof Error
              ? loadError.message
              : "Impossible de charger les commandes.",
          );
        }
        finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        query,
        router,
      ],
    );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadData();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    loadData,
  ]);


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setQueryDraft(
            urlQuery,
          );

          setQuery(
            urlQuery,
          );
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    urlQuery,
  ]);


  const paymentByOrder =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            SalesPaymentItem
          >();

        for (
          const payment
          of payments
        ) {
          if (
            !map.has(
              payment.order_ref,
            )
          ) {
            map.set(
              payment.order_ref,
              payment,
            );
          }
        }

        return map;
      },
      [
        payments,
      ],
    );


  const scopedOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            mode === "quotes"
              ? order.devis_demande
              : true,
        ),
      [
        mode,
        orders,
      ],
    );


  const offers =
    useMemo(
      () =>
        Array.from(
          new Map(
            scopedOrders
              .filter(
                (order) =>
                  order.offre,
              )
              .map(
                (order) => [
                  order.offre,
                  order.offre_label
                  || order.offre,
                ],
              ),
          ).entries(),
        ),
      [
        scopedOrders,
      ],
    );


  const filteredOrders =
    useMemo(
      () =>
        scopedOrders.filter(
          (order) => {
            if (
              statusFilter
                !== "all"
              && order.status
                !== statusFilter
            ) {
              return false;
            }

            if (
              offerFilter
                !== "all"
              && order.offre
                !== offerFilter
            ) {
              return false;
            }

            if (
              paymentFilter
                !== "all"
              && order.payment_method
                !== paymentFilter
            ) {
              return false;
            }

            if (
              clientFilter
                !== "all"
              && order.client_type
                !== clientFilter
            ) {
              return false;
            }

            if (
              fromDate
              && order.created_at
              && new Date(
                order.created_at,
              )
                < new Date(
                  `${fromDate}T00:00:00`,
                )
            ) {
              return false;
            }

            if (
              toDate
              && order.created_at
              && new Date(
                order.created_at,
              )
                > new Date(
                  `${toDate}T23:59:59`,
                )
            ) {
              return false;
            }

            return true;
          },
        ),
      [
        clientFilter,
        fromDate,
        offerFilter,
        paymentFilter,
        scopedOrders,
        statusFilter,
        toDate,
      ],
    );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setPage(1);
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    clientFilter,
    fromDate,
    offerFilter,
    pageSize,
    paymentFilter,
    query,
    statusFilter,
    toDate,
  ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredOrders.length
        / pageSize,
      ),
    );

  const safePage =
    Math.min(
      page,
      totalPages,
    );

  const visibleOrders =
    filteredOrders.slice(
      (safePage - 1)
        * pageSize,
      safePage
        * pageSize,
    );


  const metrics =
    useMemo(
      () => {
        const now =
          new Date();

        const today =
          scopedOrders.filter(
            (order) =>
              sameDay(
                order.created_at,
                now,
              ),
          ).length;

        const pending =
          scopedOrders.filter(
            (order) =>
              order.status
                === "pending",
          ).length;

        const paid =
          scopedOrders.filter(
            (order) =>
              order.status
                === "paid",
          ).length;

        const toPlan =
          scopedOrders.filter(
            (order) =>
              order.status
                === "paid"
              && !order.installed_at
              && isPhysical(order),
          ).length;

        const revenue =
          payments
            .filter(
              (payment) =>
                payment.status
                  === "success"
                && sameMonth(
                  payment.paid_at
                  ?? payment.payment_created_at,
                  now,
                ),
            )
            .reduce(
              (
                sum,
                payment,
              ) =>
                sum
                + payment.amount_gnf,
              0,
            );

        return {
          today,
          pending,
          paid,
          toPlan,
          revenue,
        };
      },
      [
        payments,
        scopedOrders,
      ],
    );


  const selectedPayment =
    selected
      ? paymentByOrder.get(
          selected.order_ref,
        )
      : undefined;


  const canValidate =
    Boolean(
      selected
      && selected.status
        === "pending"
      && selected.payment_method
        === "manual"
      && selectedPayment
      && selectedPayment.status
        === "pending",
    );


  function submitSearch(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const clean =
      queryDraft.trim();

    setQuery(
      clean,
    );

    if (
      mode === "orders"
    ) {
      router.replace(
        clean
          ? `/sales/commandes?q=${encodeURIComponent(clean)}`
          : "/sales/commandes",
      );
    }
  }


  function resetFilters() {
    setStatusFilter("all");
    setOfferFilter("all");
    setPaymentFilter("all");
    setClientFilter("all");
    setFromDate("");
    setToDate("");
  }


  function openDetail(
    order: OrderRow,
  ) {
    setSelected(order);
    setModalMode("detail");
    setExternalRef("");
    setNote("");
    setRejectReason("");
    setError("");
  }


  function openValidation(
    order: OrderRow,
  ) {
    const payment =
      paymentByOrder.get(
        order.order_ref,
      );

    setSelected(order);
    setModalMode("confirm");

    setExternalRef(
      payment?.external_ref
      ?? "",
    );

    setNote("");
    setRejectReason("");
    setError("");
  }


  async function validateOrder() {
    if (
      !selected
      || !selectedPayment
    ) {
      return;
    }

    const reference =
      externalRef.trim();

    if (!reference) {
      setError(
        "La référence du paiement est obligatoire.",
      );

      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await confirmSalesPayment(
        selectedPayment.id,
        {
          external_ref:
            reference,
          note:
            note.trim()
            || null,
        },
      );

      setNotice(
        "Commande validée. Le paiement et le traitement métier ont été confirmés.",
      );

      setSelected(null);
      setModalMode(null);

      await loadData(
        true,
      );
    }
    catch(actionError) {
      setError(
        actionError
          instanceof SalesApiError
          ? actionError.message
          : actionError
              instanceof Error
            ? actionError.message
            : "Validation impossible.",
      );
    }
    finally {
      setSubmitting(false);
    }
  }


  async function rejectPayment() {
    if (
      !selectedPayment
    ) {
      return;
    }

    const reason =
      rejectReason.trim();

    if (
      reason.length < 3
    ) {
      setError(
        "Le motif doit contenir au moins 3 caractères.",
      );

      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await rejectSalesPayment(
        selectedPayment.id,
        reason,
      );

      setNotice(
        "Paiement rejeté.",
      );

      setSelected(null);
      setModalMode(null);

      await loadData(
        true,
      );
    }
    catch(actionError) {
      setError(
        actionError
          instanceof SalesApiError
          ? actionError.message
          : actionError
              instanceof Error
            ? actionError.message
            : "Rejet impossible.",
      );
    }
    finally {
      setSubmitting(false);
    }
  }


  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-5">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Commercial
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {mode === "quotes"
              ? "Devis"
              : "Commandes"}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {mode === "quotes"
              ? "Qualification et suivi des demandes de devis."
              : "Suivi commercial, validation des paiements et passage vers l'installation."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {mode === "orders" ? (
            <Button
              type="button"
              onClick={() =>
                router.push(
                  "/commander",
                )
              }
              className="rounded-xl bg-teal-700 hover:bg-teal-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle commande
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              exportCsv(
                filteredOrders,
              )
            }
            className="rounded-xl"
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setShowFilters(
                (value) =>
                  !value,
              )
            }
            className="rounded-xl"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtres avancés
          </Button>
        </div>
      </section>

      {mode === "orders" ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Commandes du jour"
            value={String(metrics.today)}
            helper="Activité aujourd'hui"
            icon={<ShoppingCart className="h-5 w-5" />}
            className="border-blue-100 bg-blue-50/70 text-blue-600"
          />

          <KpiCard
            label="En attente paiement"
            value={String(metrics.pending)}
            helper="À traiter commercialement"
            icon={<Clock3 className="h-5 w-5" />}
            className="border-amber-100 bg-amber-50/70 text-amber-600"
          />

          <KpiCard
            label="Confirmées"
            value={String(metrics.paid)}
            helper="Commandes payées"
            icon={<CheckCircle2 className="h-5 w-5" />}
            className="border-emerald-100 bg-emerald-50/70 text-emerald-600"
          />

          <KpiCard
            label="À planifier"
            value={String(metrics.toPlan)}
            helper="Installations physiques"
            icon={<CalendarDays className="h-5 w-5" />}
            className="border-violet-100 bg-violet-50/70 text-violet-600"
          />

          <KpiCard
            label="CA du mois"
            value={formatGnf(metrics.revenue)}
            helper="Paiements encaissés"
            icon={<BarChart3 className="h-5 w-5" />}
            className="border-teal-100 bg-teal-50/70 text-teal-600"
          />
        </section>
      ) : null}

      {error ? (
        <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <CircleAlert className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {notice}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={submitSearch}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            value={queryDraft}
            onChange={(event) =>
              setQueryDraft(
                event.target.value,
              )
            }
            placeholder="Rechercher une commande, un client, un email ou un téléphone..."
            className="h-11 rounded-xl pl-11"
          />
        </form>

        {showFilters ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">
                Tous les statuts
              </option>

              <option value="pending">
                En attente
              </option>

              <option value="paid">
                Payée
              </option>
            </select>

            <select
              value={offerFilter}
              onChange={(event) =>
                setOfferFilter(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">
                Toutes les offres
              </option>

              {offers.map(
                ([
                  code,
                  label,
                ]) => (
                  <option
                    key={code}
                    value={code}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>

            <select
              value={paymentFilter}
              onChange={(event) =>
                setPaymentFilter(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">
                Tous les paiements
              </option>

              <option value="manual">
                Manuel
              </option>

              <option value="orange">
                Orange Money
              </option>
            </select>

            <select
              value={clientFilter}
              onChange={(event) =>
                setClientFilter(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">
                Tous les clients
              </option>

              <option value="particulier">
                Particulier
              </option>

              <option value="entreprise">
                Entreprise
              </option>
            </select>

            <Input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl"
            />

            <Input
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(
                  event.target.value,
                )
              }
              className="h-10 rounded-xl"
            />
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Réinitialiser les filtres
          </button>

          <span className="text-xs font-semibold text-slate-500">
            {filteredOrders.length} résultat(s)
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Chargement...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">
                      Réf commande
                    </th>

                    <th className="px-4 py-3">
                      Client
                    </th>

                    <th className="px-4 py-3">
                      Offre
                    </th>

                    <th className="px-4 py-3">
                      Statut
                    </th>

                    <th className="px-4 py-3">
                      Paiement
                    </th>

                    <th className="px-4 py-3">
                      Montant
                    </th>

                    <th className="px-4 py-3">
                      Création
                    </th>

                    <th className="px-4 py-3">
                      Confirmation
                    </th>

                    <th className="px-4 py-3">
                      Installation
                    </th>

                    <th className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {visibleOrders.length ? (
                    visibleOrders.map(
                      (order) => {
                        const payment =
                          paymentByOrder.get(
                            order.order_ref,
                          );

                        const confirmable =
                          order.status
                            === "pending"
                          && order.payment_method
                            === "manual"
                          && payment?.status
                            === "pending";

                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-slate-50/70"
                          >
                            <td className="px-4 py-3 font-semibold text-slate-950">
                              {order.order_ref}
                            </td>

                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">
                                {order.client_name || "Client"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {order.client_phone
                                  || order.client_email
                                  || "—"}
                              </p>
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {order.offre_label
                                || order.offre
                                || "—"}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  statusClass(
                                    order.status,
                                  ),
                                ].join(" ")}
                              >
                                {humanStatus(
                                  order.status,
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  statusClass(
                                    payment?.status
                                    ?? order.status,
                                  ),
                                ].join(" ")}
                              >
                                {paymentText(
                                  payment,
                                  order,
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {formatGnf(
                                order.amount_gnf,
                              )}
                            </td>

                            <td className="px-4 py-3 text-xs text-slate-600">
                              {formatDate(
                                order.created_at,
                              )}
                            </td>

                            <td className="px-4 py-3 text-xs text-slate-600">
                              {formatDate(
                                order.confirmed_at,
                              )}
                            </td>

                            <td className="px-4 py-3 text-xs text-slate-600">
                              {formatDate(
                                order.installed_at,
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                {confirmable ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      openValidation(
                                        order,
                                      )
                                    }
                                    className="rounded-lg bg-teal-700 hover:bg-teal-800"
                                  >
                                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                    Valider
                                  </Button>
                                ) : null}

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openDetail(
                                      order,
                                    )
                                  }
                                  className="rounded-lg"
                                >
                                  <Eye className="mr-1.5 h-4 w-4" />
                                  Voir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-6 py-16 text-center text-sm text-slate-500"
                      >
                        Aucune commande ne correspond aux filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Afficher
                </span>

                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2"
                >
                  {[10, 25, 50].map(
                    (size) => (
                      <option
                        key={size}
                        value={size}
                      >
                        {size}
                      </option>
                    ),
                  )}
                </select>

                <span>
                  résultats par page
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={
                    safePage <= 1
                  }
                  onClick={() =>
                    setPage(
                      (value) =>
                        Math.max(
                          1,
                          value - 1,
                        ),
                    )
                  }
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="min-w-24 text-center text-xs font-semibold text-slate-600">
                  Page {safePage} / {totalPages}
                </span>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={
                    safePage >= totalPages
                  }
                  onClick={() =>
                    setPage(
                      (value) =>
                        Math.min(
                          totalPages,
                          value + 1,
                        ),
                    )
                  }
                  className="h-9 w-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={refreshing}
                  onClick={() =>
                    void loadData(
                      true,
                    )
                  }
                  className="h-9 w-9"
                >
                  <RefreshCw
                    className={[
                      "h-4 w-4",
                      refreshing
                        ? "animate-spin"
                        : "",
                    ].join(" ")}
                  />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {selected && modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
                  Commande
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {selected.order_ref}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setModalMode(null);
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Client
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {selected.client_name || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Offre
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {selected.offre_label || selected.offre || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Montant
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {formatGnf(
                      selected.amount_gnf,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Paiement
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {selected.payment_method || "—"}
                  </p>
                </div>
              </div>

              {modalMode === "detail" ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-slate-500">
                      Email :
                    </span>{" "}
                    {selected.client_email || "—"}
                  </p>

                  <p>
                    <span className="text-slate-500">
                      Téléphone :
                    </span>{" "}
                    {selected.client_phone || "—"}
                  </p>

                  <p>
                    <span className="text-slate-500">
                      Statut :
                    </span>{" "}
                    {humanStatus(
                      selected.status,
                    )}
                  </p>

                  <p>
                    <span className="text-slate-500">
                      Nombre d&apos;adresses :
                    </span>{" "}
                    {selected.nb_adresses}
                  </p>
                </div>
              ) : null}

              {modalMode === "confirm" ? (
                <div className="space-y-4">
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    <span>
                      Référence du paiement *
                    </span>

                    <Input
                      value={externalRef}
                      onChange={(event) =>
                        setExternalRef(
                          event.target.value,
                        )
                      }
                      placeholder="Référence transaction, reçu ou bordereau"
                    />
                  </label>

                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    <span>
                      Note interne
                    </span>

                    <Textarea
                      value={note}
                      onChange={(event) =>
                        setNote(
                          event.target.value,
                        )
                      }
                      placeholder="Information facultative"
                    />
                  </label>
                </div>
              ) : null}

              {modalMode === "reject" ? (
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  <span>
                    Motif du rejet *
                  </span>

                  <Textarea
                    value={rejectReason}
                    onChange={(event) =>
                      setRejectReason(
                        event.target.value,
                      )
                    }
                    placeholder="Motif du rejet"
                  />
                </label>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t p-5">
              {modalMode === "detail" && canValidate ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setModalMode(
                        "reject",
                      )
                    }
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeter
                  </Button>

                  <Button
                    type="button"
                    onClick={() =>
                      setModalMode(
                        "confirm",
                      )
                    }
                    className="bg-teal-700 hover:bg-teal-800"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Valider la commande
                  </Button>
                </>
              ) : null}

              {modalMode === "confirm" ? (
                <Button
                  type="button"
                  disabled={
                    submitting
                    || !externalRef.trim()
                  }
                  onClick={() =>
                    void validateOrder()
                  }
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  {submitting
                    ? "Validation..."
                    : "Confirmer la validation"}
                </Button>
              ) : null}

              {modalMode === "reject" ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={
                    submitting
                    || rejectReason.trim().length < 3
                  }
                  onClick={() =>
                    void rejectPayment()
                  }
                >
                  {submitting
                    ? "Rejet..."
                    : "Confirmer le rejet"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}