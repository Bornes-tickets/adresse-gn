"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Warehouse,
  Workflow,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  type BackofficeActionDefinition,
  type BackofficeRoleDashboardResponse,
  getBackofficeActionCatalog,
  getBackofficeRoleDashboard,
  listBackofficeResource,
} from "../api";

import {
  ResourceActionButtons,
} from "./resource-actions";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  SectionCard,
  StatusBadge,
  WorkflowStepper,
} from "./professional-ui";


type Row =
  Record<string, unknown>;


type LoadedResource = {
  items: Row[];
  total: number;
};


function asString(
  value: unknown,
) {
  if (
    value === null
    || value === undefined
  ) {
    return "";
  }

  return String(value);
}


function asNumber(
  value: unknown,
) {
  if (
    typeof value === "number"
    && Number.isFinite(value)
  ) {
    return value;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "fr-FR",
  ).format(value);
}


function formatMoney(
  value: unknown,
) {
  return (
    `${formatNumber(
      asNumber(value),
    )} GNF`
  );
}


function isV1Beacon(
  row: Row,
) {
  return (
    asString(
      row.numbering_version,
    ).toLowerCase()
    === "v1"
    && asString(
      row.category,
    ).toLowerCase()
    !== "digital_only"
  );
}


function collectV1LotCodes(
  beacons: Row[],
) {
  return new Set(
    beacons
      .filter(
        isV1Beacon,
      )
      .map(
        (row) =>
          asString(
            row.lot_code,
          ),
      )
      .filter(
        Boolean,
      ),
  );
}


function formatV1PublicNumber(
  value: unknown,
) {
  const raw =
    asString(value);

  const match =
    /^([A-Z]{3}[0-9]{2})-([0-9]{8})([0-9])$/.exec(
      raw,
    );

  if (!match) {
    return raw;
  }

  return (
    `${match[1]}-${match[2]}-${match[3]}`
  );
}


function formatDate(
  value: unknown,
) {
  const text =
    asString(value);

  if (!text) {
    return "—";
  }

  const parsed =
    new Date(text);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return text;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed);
}


function formatDateOnly(
  value: unknown,
) {
  const text =
    asString(value);

  if (!text) {
    return "—";
  }

  const parsed =
    new Date(text);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return text;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
    },
  ).format(parsed);
}


function isOverdue(
  value: unknown,
) {
  const text =
    asString(value);

  if (!text) {
    return false;
  }

  const parsed =
    new Date(text);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return false;
  }

  return parsed.getTime()
    < Date.now();
}


function categoryLabel(
  value: unknown,
) {
  const key =
    asString(value);

  const labels:
    Record<string, string> = {
      residential:
        "Résidentielle",
      residential_plus:
        "Résidentielle premium",
      professional:
        "Professionnelle",
      institutional:
        "Institutionnelle",
      custom:
        "Sur mesure",
      digital_only:
        "Numérique uniquement",
    };

  return labels[key]
    ?? key
    ?? "—";
}


function paymentMethodLabel(
  value: string,
) {
  const labels:
    Record<string, string> = {
      bank_transfer:
        "Virement bancaire",
      cash:
        "Espèces",
      check:
        "Chèque",
      mobile_money:
        "Mobile Money",
      other:
        "Autre",
    };

  return labels[value]
    ?? value;
}


function localizeOpsActions(
  actions:
    BackofficeActionDefinition[],
) {
  return actions.map(
    (action) => ({
      ...action,
      label:
        action.key
          === "set_status"
          ? "Mettre à jour le suivi du lot"
          : action.key
            === "generate_po"
            ? "Créer le bon de commande"
            : action.key
              === "update_po"
              ? "Modifier / envoyer le BC"
              : action.key
                === "generate_dn"
                ? "Enregistrer réception / QC"
                : action.key
                  === "record_payment"
                  ? "Enregistrer le règlement"
                  : action.label,
      fields:
        action.fields.map(
          (field) => {
            if (
              !field.options
            ) {
              return field;
            }

            if (
              action.key
                === "set_status"
              && field.name
                === "status"
            ) {
              return {
                ...field,
                options:
                  field.options.map(
                    (option) => ({
                      ...option,
                      label:
                        lotStatusLabel(
                          option.value,
                        ),
                    }),
                  ),
              };
            }

            if (
              action.key
                === "update_po"
              && field.name
                === "status"
            ) {
              return {
                ...field,
                options:
                  field.options.map(
                    (option) => ({
                      ...option,
                      label:
                        poStatusLabel(
                          option.value,
                        ),
                    }),
                  ),
              };
            }

            if (
              action.key
                === "record_payment"
              && field.name
                === "method"
            ) {
              return {
                ...field,
                options:
                  field.options.map(
                    (option) => ({
                      ...option,
                      label:
                        paymentMethodLabel(
                          option.value,
                        ),
                    }),
                  ),
              };
            }

            return field;
          },
        ),
    }),
  );
}


function lotStatusLabel(
  status: string,
) {
  const labels:
    Record<string, string> = {
      draft: "Brouillon",
      sent: "Envoyé",
      in_production: "En production",
      shipped: "Expédié",
      received: "Reçu / QC complet",
      generated: "Généré",
      distributed: "Distribué",
      ordered: "Commandé",
      in_use: "En utilisation",
      depleted: "Épuisé",
      recalled: "Rappelé",
    };

  return (
    labels[status]
    ?? status
    ?? "—"
  );
}


function poStatusLabel(
  status: string,
) {
  const labels:
    Record<string, string> = {
      draft: "BC brouillon",
      sent: "BC envoyé",
      acknowledged:
        "BC accusé reçu",
      cancelled: "BC annulé",
    };

  return (
    labels[status]
    ?? status
    ?? "—"
  );
}


function paymentStatusLabel(
  status: string,
) {
  const labels:
    Record<string, string> = {
      unpaid: "Non réglée",
      partial:
        "Partiellement réglée",
      paid: "Réglée",
      disputed: "En litige",
      cancelled: "Annulée",
    };

  return (
    labels[status]
    ?? status
    ?? "—"
  );
}


async function loadAllResource(
  accessToken: string,
  resource: string,
  signal?: AbortSignal,
): Promise<LoadedResource> {
  const first =
    await listBackofficeResource(
      accessToken,
      resource,
      {
        page: 1,
        pageSize: 100,
      },
      signal,
    );

  const items = [
    ...first.items,
  ];

  const pageSize =
    Math.max(
      first.page_size,
      1,
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        first.total
        / pageSize,
      ),
    );

  for (
    let page = 2;
    page <= totalPages;
    page += 1
  ) {
    if (signal?.aborted) {
      break;
    }

    const next =
      await listBackofficeResource(
        accessToken,
        resource,
        {
          page,
          pageSize,
        },
        signal,
      );

    items.push(
      ...next.items,
    );
  }

  return {
    items,
    total:
      first.total,
  };
}


function useOpsResource(
  resource: string,
) {
  const [
    data,
    setData,
  ] = useState<LoadedResource>({
    items: [],
    total: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    revision,
    setRevision,
  ] = useState(0);


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
          await loadAllResource(
            token,
            resource,
            controller.signal,
          );

        if (
          !controller.signal
            .aborted
        ) {
          setData(result);
        }
      }
      catch(loadError) {
        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les données OPS.",
        );
      }
      finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    resource,
    revision,
  ]);


  return {
    ...data,
    loading,
    error,
    refresh: () =>
      setRevision(
        (value) =>
          value + 1,
      ),
  };
}


function useOpsActions(
  resource: string,
) {
  const [
    actions,
    setActions,
  ] = useState<
    BackofficeActionDefinition[]
  >([]);

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      try {
        const token =
          await getAccessToken();

        if (!token) {
          return;
        }

        const result =
          await getBackofficeActionCatalog(
            token,
            resource,
            controller.signal,
          );

        if (
          !controller.signal
            .aborted
        ) {
          setActions(
            result.actions,
          );
        }
      }
      catch {
        if (
          !controller.signal
            .aborted
        ) {
          setActions([]);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [
    resource,
  ]);

  return actions;
}


function procurementStage(
  row: Row,
) {
  const quantity =
    asNumber(
      row.quantity,
    );

  const received =
    asNumber(
      row.quantity_received_total,
    );

  const accepted =
    asNumber(
      row.quantity_accepted_total,
    );

  const remaining =
    asNumber(
      row.quantity_remaining,
    );

  const poNumber =
    asString(
      row.po_number,
    );

  const poStatus =
    asString(
      row.purchase_order_status,
    );

  if (!poNumber) {
    return {
      key: "to_order",
      label:
        "À commander",
      detail:
        "Aucun bon de commande fournisseur.",
    };
  }

  if (
    poStatus
    === "cancelled"
  ) {
    return {
      key: "cancelled",
      label:
        "BC annulé",
      detail:
        "Le bon de commande actif doit être régularisé.",
    };
  }

  if (
    quantity > 0
    && accepted >= quantity
  ) {
    return {
      key: "complete",
      label:
        "Réception complète",
      detail:
        "Quantité commandée entièrement reçue et QC conforme.",
    };
  }

  if (
    received > accepted
  ) {
    return {
      key: "qc",
      label:
        "QC à revoir",
      detail:
        "Une partie de la réception n’a pas été libérée.",
    };
  }

  if (
    received > 0
    && remaining > 0
  ) {
    return {
      key: "receiving",
      label:
        "Réception partielle",
      detail:
        "Une partie du lot reste à réceptionner.",
    };
  }

  return {
    key: "receiving",
    label:
      "En approvisionnement",
    detail:
      "BC actif, réception physique encore attendue.",
  };
}


function procurementActionsForRow(
  actions:
    BackofficeActionDefinition[],
  row: Row,
) {
  const poNumber =
    asString(
      row.po_number,
    );

  const poStatus =
    asString(
      row.purchase_order_status,
    );

  const dnNumber =
    asString(
      row.dn_number,
    );

  const invoiceNumber =
    asString(
      row.invoice_number,
    );

  const paymentStatus =
    asString(
      row.payment_status,
    );

  const remaining =
    asNumber(
      row.quantity_remaining,
    );

  const allowed =
    new Set<string>();

  if (!poNumber) {
    allowed.add(
      "generate_po",
    );
  }

  if (poNumber) {
    allowed.add(
      "export_po_pdf",
    );
    allowed.add(
      "update_po",
    );
  }

  if (
    poNumber
    && poStatus
      !== "cancelled"
    && remaining > 0
  ) {
    allowed.add(
      "generate_dn",
    );
  }

  if (dnNumber) {
    allowed.add(
      "export_dn_pdf",
    );
  }

  if (
    poNumber
    && !invoiceNumber
  ) {
    allowed.add(
      "create_invoice",
    );
  }

  if (invoiceNumber) {
    if (
      paymentStatus
      === "disputed"
    ) {
      allowed.add(
        "resolve_dispute",
      );
    }
    else if (
      paymentStatus
      !== "cancelled"
    ) {
      allowed.add(
        "mark_dispute",
      );

      if (
        paymentStatus
        !== "paid"
      ) {
        allowed.add(
          "record_payment",
        );
      }
    }
  }

  return actions.filter(
    (action) =>
      allowed.has(
        action.key,
      ),
  );
}


function primaryProcurementAction(
  actions:
    BackofficeActionDefinition[],
  row: Row,
) {
  const available =
    procurementActionsForRow(
      actions,
      row,
    );

  const poNumber =
    asString(
      row.po_number,
    );

  const poStatus =
    asString(
      row.purchase_order_status,
    );

  const remaining =
    asNumber(
      row.quantity_remaining,
    );

  const invoiceNumber =
    asString(
      row.invoice_number,
    );

  const paymentStatus =
    asString(
      row.payment_status,
    );

  let key = "";

  if (!poNumber) {
    key =
      "generate_po";
  }
  else if (
    poStatus
    === "draft"
  ) {
    key =
      "update_po";
  }
  else if (
    remaining > 0
  ) {
    key =
      "generate_dn";
  }
  else if (
    !invoiceNumber
  ) {
    key =
      "create_invoice";
  }
  else if (
    paymentStatus
    === "disputed"
  ) {
    key =
      "resolve_dispute";
  }
  else if (
    paymentStatus
    !== "paid"
    && paymentStatus
      !== "cancelled"
  ) {
    key =
      "record_payment";
  }

  const selected =
    available.find(
      (action) =>
        action.key === key,
    );

  if (!selected) {
    return [];
  }

  const labels:
    Record<string, string> = {
      generate_po:
        "Créer le bon de commande",
      update_po:
        "Finaliser / envoyer le BC",
      generate_dn:
        "Enregistrer réception / QC",
      create_invoice:
        "Créer la facture fournisseur",
      record_payment:
        "Enregistrer le règlement",
      resolve_dispute:
        "Lever le litige",
    };

  return [
    {
      ...selected,
      label:
        labels[selected.key]
        ?? selected.label,
    },
  ];
}


function DashboardActivity({
  data,
}: {
  data:
    BackofficeRoleDashboardResponse;
}) {
  return (
    <SectionCard
      title="Activité logistique récente"
      description="Derniers lots remontés par le dashboard OPS."
      icon={Activity}
    >
      {data.activity.length ? (
        <div className="divide-y divide-slate-100">
          {data.activity.map(
            (item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.primary}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.secondary
                      || "—"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {item.status ? (
                    <StatusBadge
                      status={
                        item.status
                      }
                      label={
                        lotStatusLabel(
                          item.status,
                        )
                      }
                    />
                  ) : null}

                  <span className="text-xs text-slate-400">
                    {formatDate(
                      item.date,
                    )}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <EmptyState
          title="Aucune activité récente"
          description="Les prochains événements de lots apparaîtront ici."
        />
      )}
    </SectionCard>
  );
}


export function OpsDashboardPage() {
  const [
    dashboard,
    setDashboard,
  ] = useState<
    BackofficeRoleDashboardResponse | null
  >(null);

  const [
    procurement,
    setProcurement,
  ] = useState<LoadedResource>({
    items: [],
    total: 0,
  });

  const [
    stock,
    setStock,
  ] = useState<LoadedResource>({
    items: [],
    total: 0,
  });

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

        const [
          dashboardResult,
          procurementResult,
          stockResult,
          beaconsResult,
        ] = await Promise.all([
          getBackofficeRoleDashboard(
            token,
            "ops",
            controller.signal,
          ),
          loadAllResource(
            token,
            "ops_procurement",
            controller.signal,
          ),
          loadAllResource(
            token,
            "ops_stock",
            controller.signal,
          ),
          loadAllResource(
            token,
            "ops_beacons",
            controller.signal,
          ),
        ]);

        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        const v1Beacons =
          beaconsResult.items.filter(
            isV1Beacon,
          );

        const v1LotCodes =
          collectV1LotCodes(
            v1Beacons,
          );

        const v1ProcurementItems =
          procurementResult.items.filter(
            (row) =>
              v1LotCodes.has(
                asString(
                  row.lot_code,
                ),
              ),
          );

        const v1StockItems =
          stockResult.items.filter(
            (row) =>
              v1LotCodes.has(
                asString(
                  row.code,
                ),
              ),
          );

        setDashboard({
          ...dashboardResult,
          activity:
            dashboardResult.activity.filter(
              (item) =>
                v1LotCodes.has(
                  asString(
                    item.primary,
                  ),
                ),
            ),
          metrics: [
            ...dashboardResult.metrics.filter(
              (item) =>
                item.key
                !== "generated",
            ),
            {
              key: "generated",
              label:
                "Balises générées V1",
              value:
                v1Beacons.filter(
                  (row) =>
                    asString(
                      row.status,
                    )
                    === "generated",
                ).length,
              format:
                "number",
            },
          ],
        });

        setProcurement({
          items:
            v1ProcurementItems,
          total:
            v1ProcurementItems.length,
        });

        setStock({
          items:
            v1StockItems,
          total:
            v1StockItems.length,
        });
      }
      catch(loadError) {
        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le pilotage OPS.",
        );
      }
      finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, []);


  if (loading) {
    return (
      <LoadingState label="Chargement du pilotage OPS…" />
    );
  }


  if (
    error
    || !dashboard
  ) {
    return (
      <ErrorState
        title="Pilotage OPS indisponible"
        description={
          error
          || "Aucune donnée reçue."
        }
        onRetry={() =>
          window.location.reload()
        }
      />
    );
  }


  const metricValue =
    (key: string) =>
      dashboard.metrics.find(
        (item) =>
          item.key === key,
      )?.value
      ?? 0;

  const available =
    stock.items.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_available,
          ),
      0,
    );

  const toOrder =
    procurement.items.filter(
      (row) =>
        !asString(
          row.po_number,
        ),
    ).length;

  const toReceive =
    procurement.items.filter(
      (row) =>
        asString(
          row.po_number,
        )
        && asString(
          row.purchase_order_status,
        ) !== "cancelled"
        && asNumber(
          row.quantity_remaining,
        ) > 0,
    ).length;

  const qcAttention =
    procurement.items.filter(
      (row) =>
        asNumber(
          row.quantity_received_total,
        )
        > asNumber(
            row.quantity_accepted_total,
          ),
    ).length;

  const openInvoices =
    procurement.items.filter(
      (row) => {
        const status =
          asString(
            row.payment_status,
          );

        return (
          asString(
            row.invoice_number,
          )
          && ![
            "paid",
            "cancelled",
          ].includes(
            status,
          )
        );
      },
    ).length;


  const quantityOrdered =
    procurement.items.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity,
          ),
      0,
    );

  const quantityReceived =
    procurement.items.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_received_total,
          ),
      0,
    );

  const quantityAccepted =
    procurement.items.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_accepted_total,
          ),
      0,
    );

  const purchaseCommitment =
    procurement.items.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.purchase_order_amount_ttc,
          ),
      0,
    );

  const invoicedTotal =
    procurement.items.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.invoice_amount_ttc,
          ),
      0,
    );

  const paidTotal =
    procurement.items.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.amount_paid,
          ),
      0,
    );

  const payableTotal =
    Math.max(
      0,
      invoicedTotal
      - paidTotal,
    );

  const overdueDeliveries =
    procurement.items.filter(
      (row) =>
        asNumber(
          row.quantity_remaining,
        ) > 0
        && isOverdue(
          row.expected_delivery,
        ),
    ).length;

  const partialReceipts =
    procurement.items.filter(
      (row) =>
        asNumber(
          row.quantity_received_total,
        ) > 0
        && asNumber(
          row.quantity_remaining,
        ) > 0,
    ).length;

  const disputedInvoices =
    procurement.items.filter(
      (row) =>
        asString(
          row.payment_status,
        ) === "disputed",
    ).length;

  const supplierCount =
    new Set(
      procurement.items
        .map(
          (row) =>
            asString(
              row.supplier_name,
            )
            || asString(
              row.legacy_supplier,
            ),
        )
        .filter(
          Boolean,
        ),
    ).size;


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Opérations · Logistique"
        title="Approvisionnement physique"
        description="Pilotez uniquement les lots de la nouvelle codification V1, depuis les numéros générés par l’Administration jusqu’à la réception conforme."
        icon={Warehouse}
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            Nouvelle codification V1 physique uniquement
          </span>
        }
        actions={
          <>
            <Link
              href="/ops/commandes-fournisseurs"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0F766E] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115E59]"
            >
              <Truck className="h-4 w-4" />
              Commandes fournisseur
            </Link>

            <Link
              href="/ops/stock"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Boxes className="h-4 w-4" />
              Voir le stock
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Balises générées"
          value={
            formatNumber(
              metricValue(
                "generated",
              ),
            )
          }
          detail="Identités numériques à approvisionner"
          icon={PackageOpen}
          accent="violet"
        />

        <MetricCard
          label="Balises disponibles"
          value={
            formatNumber(
              available,
            )
          }
          detail="Réceptions physiques QC conformes"
          icon={PackageCheck}
          accent="teal"
        />

        <MetricCard
          label="Lots à réceptionner"
          value={
            formatNumber(
              toReceive,
            )
          }
          detail="BC actif avec quantité restante"
          icon={Truck}
          accent="amber"
        />

        <MetricCard
          label="Lots reçus"
          value={
            formatNumber(
              stock.items.filter(
                (row) =>
                  asString(
                    row.status,
                  )
                  === "received",
              ).length,
            )
          }
          detail={`${formatNumber(
            stock.total,
          )} lot(s) V1 suivi(s)`}
          icon={CheckCircle2}
          accent="brand"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Volume commandé"
          value={
            formatNumber(
              quantityOrdered,
            )
          }
          detail={`${formatNumber(
            supplierCount,
          )} fournisseur(s)`}
          icon={Boxes}
          accent="brand"
        />

        <MetricCard
          label="Reçu physique"
          value={
            formatNumber(
              quantityReceived,
            )
          }
          detail={`${formatNumber(
            partialReceipts,
          )} réception(s) partielle(s)`}
          icon={Truck}
          accent="amber"
        />

        <MetricCard
          label="QC conforme"
          value={
            formatNumber(
              quantityAccepted,
            )
          }
          detail={`${formatNumber(
            qcAttention,
          )} anomalie(s) à traiter`}
          icon={ShieldCheck}
          accent="teal"
        />

        <MetricCard
          label="Engagement BC"
          value={
            formatMoney(
              purchaseCommitment,
            )
          }
          detail={`${formatNumber(
            openInvoices,
          )} facture(s) ouverte(s)`}
          icon={FileText}
          accent="violet"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Santé des approvisionnements"
          description="Contrôles de délai, de conformité et de règlement à surveiller."
          icon={AlertTriangle}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label:
                  "Livraisons en retard",
                value:
                  overdueDeliveries,
                detail:
                  "Échéance dépassée avec quantité restant à recevoir.",
              },
              {
                label:
                  "Réceptions partielles",
                value:
                  partialReceipts,
                detail:
                  "Lots déjà reçus en partie mais non soldés.",
              },
              {
                label:
                  "Écarts QC",
                value:
                  qcAttention,
                detail:
                  "Quantité reçue supérieure à la quantité acceptée.",
              },
              {
                label:
                  "Factures en litige",
                value:
                  disputedInvoices,
                detail:
                  "Dossiers nécessitant une résolution fournisseur.",
              },
            ].map(
              (item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.detail}
                      </p>
                    </div>
                    <strong className="text-2xl text-slate-950">
                      {formatNumber(
                        item.value,
                      )}
                    </strong>
                  </div>
                </div>
              ),
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Synthèse financière fournisseurs"
          description="Lecture consolidée des engagements, factures et règlements."
          icon={FileText}
        >
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {[
              [
                "Bons de commande TTC",
                purchaseCommitment,
              ],
              [
                "Factures fournisseurs TTC",
                invoicedTotal,
              ],
              [
                "Montant réglé",
                paidTotal,
              ],
              [
                "Reste à payer",
                payableTotal,
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={
                    String(
                      label,
                    )
                  }
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="text-sm text-slate-600">
                    {label}
                  </span>
                  <strong className="text-sm text-slate-950">
                    {formatMoney(
                      value,
                    )}
                  </strong>
                </div>
              ),
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-xs leading-5 text-teal-900">
            Les montants sont calculés uniquement sur les lots V1 physiques suivis par OPS.
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Chaîne d’approvisionnement"
        description="La disponibilité physique est établie uniquement par la réception fournisseur et le contrôle qualité."
        icon={Workflow}
      >
        <WorkflowStepper
          steps={[
            {
              key: "generated",
              label:
                "Numéros générés",
              description:
                "Créés par l’Administration.",
              state:
                "complete",
            },
            {
              key: "po",
              label:
                "Bon de commande",
              description:
                "OPS formalise la commande fournisseur.",
              state:
                "current",
            },
            {
              key: "shipping",
              label:
                "Production / expédition",
              description:
                "Suivi du fournisseur et du transport.",
            },
            {
              key: "receipt",
              label:
                "Réception physique",
              description:
                "Quantités réellement reçues, y compris partielles.",
            },
            {
              key: "qc",
              label:
                "Contrôle qualité",
              description:
                "Le QC conforme déclenche la libération des balises V1 éligibles.",
            },
            {
              key: "available",
              label:
                "Disponible",
              description:
                "Le Supervisor peut ensuite affecter la balise.",
            },
          ]}
        />

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 text-sm text-cyan-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-6">
            Changer uniquement le statut logistique d’un lot ne rend pas ses balises disponibles.
            {" "}
            <strong>
              La libération `generated → available` est réalisée par l’enregistrement d’une réception avec QC conforme.
            </strong>
          </p>
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="À traiter maintenant"
          description="Priorités calculées à partir des dossiers fournisseurs existants."
          icon={AlertTriangle}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label:
                  "Sans bon de commande",
                value:
                  toOrder,
                detail:
                  "Lots encore sans BC fournisseur.",
                href:
                  "/ops/commandes-fournisseurs",
              },
              {
                label:
                  "À réceptionner",
                value:
                  toReceive,
                detail:
                  "Lots avec quantité physique restante.",
                href:
                  "/ops/commandes-fournisseurs",
              },
              {
                label:
                  "QC à revoir",
                value:
                  qcAttention,
                detail:
                  "Quantité reçue supérieure à la quantité conforme.",
                href:
                  "/ops/commandes-fournisseurs",
              },
              {
                label:
                  "Factures ouvertes",
                value:
                  openInvoices,
                detail:
                  "Factures fournisseur non soldées.",
                href:
                  "/ops/commandes-fournisseurs",
              },
            ].map(
              (item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-teal-200 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.label}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.detail}
                      </p>
                    </div>

                    <strong className="text-2xl text-slate-950">
                      {formatNumber(
                        item.value,
                      )}
                    </strong>
                  </div>

                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                    Ouvrir
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ),
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Passage au Supervisor"
          description="OPS s’arrête à la disponibilité physique."
          icon={Sparkles}
        >
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
              Stock prêt terrain
            </p>

            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              {formatNumber(
                available,
              )}
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              balise(s) disponible(s) après réception physique et QC conforme. L’affectation à une demande, la planification et l’agent relèvent ensuite du Supervisor.
            </p>
          </div>
        </SectionCard>
      </section>

      <DashboardActivity
        data={dashboard}
      />
    </div>
  );
}


type ProcurementFilter =
  | "all"
  | "to_order"
  | "receiving"
  | "qc"
  | "complete"
  | "cancelled";


export function OpsProcurementPage() {
  const resource =
    useOpsResource(
      "ops_procurement",
    );

  const stock =
    useOpsResource(
      "ops_stock",
    );

  const beacons =
    useOpsResource(
      "ops_beacons",
    );

  const actions =
    useOpsActions(
      "ops_procurement",
    );

  const localizedActions =
    useMemo(
      () =>
        localizeOpsActions(
          actions,
        ),
      [
        actions,
      ],
    );

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<ProcurementFilter>(
    "all",
  );


  const v1LotCodes =
    useMemo(
      () =>
        collectV1LotCodes(
          beacons.items,
        ),
      [
        beacons.items,
      ],
    );


  const v1ProcurementItems =
    useMemo(
      () =>
        resource.items.filter(
          (row) =>
            v1LotCodes.has(
              asString(
                row.lot_code,
              ),
            ),
        ),
      [
        resource.items,
        v1LotCodes,
      ],
    );


  const stockByLot =
    useMemo(
      () =>
        new Map(
          stock.items
            .filter(
              (row) =>
                v1LotCodes.has(
                  asString(
                    row.code,
                  ),
                ),
            )
            .map(
              (row) => [
                asString(
                  row.id,
                ),
                row,
              ],
            ),
        ),
      [
        stock.items,
        v1LotCodes,
      ],
    );


  const rows =
    useMemo(
      () => {
        const normalized =
          query.trim()
            .toLowerCase();

        return v1ProcurementItems.filter(
          (row) => {
            const stage =
              procurementStage(
                row,
              );

            if (
              filter !== "all"
              && stage.key
                !== filter
            ) {
              return false;
            }

            if (!normalized) {
              return true;
            }

            const haystack = [
              row.lot_code,
              row.supplier_name,
              row.legacy_supplier,
              row.po_number,
              row.dn_number,
              row.invoice_number,
            ]
              .map(
                asString,
              )
              .join(" ")
              .toLowerCase();

            return haystack.includes(
              normalized,
            );
          },
        );
      },
      [
        filter,
        query,
        v1ProcurementItems,
      ],
    );


  const toOrder =
    v1ProcurementItems.filter(
      (row) =>
        procurementStage(
          row,
        ).key
        === "to_order",
    ).length;

  const toReceive =
    v1ProcurementItems.filter(
      (row) =>
        procurementStage(
          row,
        ).key
        === "receiving",
    ).length;

  const toRegularize =
    v1ProcurementItems.filter(
      (row) =>
        procurementStage(
          row,
        ).key
        === "qc"
        || asString(
          row.payment_status,
        ) === "disputed",
    ).length;


  function refreshAll() {
    resource.refresh();
    stock.refresh();
    beacons.refresh();
  }


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OPS · Procurement"
        title="Commandes fournisseurs"
        description="Travaillez dossier par dossier. L’action principale affichée correspond toujours à la prochaine étape opérationnelle."
        icon={Truck}
        actions={
          <ResourceActionButtons
            resource="ops_procurement"
            actions={
              localizedActions
            }
            row={null}
            scope="global"
            onComplete={
              refreshAll
            }
          />
        }
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
            1 action principale à la fois
          </span>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Dossiers"
          value={
            formatNumber(
              v1ProcurementItems.length,
            )
          }
          detail="Lots V1 physiques"
          icon={FileText}
          accent="brand"
        />

        <MetricCard
          label="À commander"
          value={
            formatNumber(
              toOrder,
            )
          }
          detail="BC à créer"
          icon={PackageOpen}
          accent="violet"
        />

        <MetricCard
          label="À réceptionner"
          value={
            formatNumber(
              toReceive,
            )
          }
          detail="BC actif"
          icon={Truck}
          accent="amber"
        />

        <MetricCard
          label="À régulariser"
          value={
            formatNumber(
              toRegularize,
            )
          }
          detail="QC ou litige"
          icon={AlertTriangle}
          accent="teal"
        />
      </section>

      <div className="rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3">
        <p className="text-sm font-semibold text-teal-950">
          Parcours simplifié
        </p>
        <p className="mt-1 text-xs leading-5 text-teal-800">
          1. Créer le BC
          {"  →  "}
          2. Finaliser / envoyer le BC
          {"  →  "}
          3. Enregistrer la réception et le QC
          {"  →  "}
          4. Créer la facture
          {"  →  "}
          5. Enregistrer le règlement.
        </p>
      </div>

      <SectionCard
        title="Dossiers fournisseurs"
        description="Cliquez sur l’action suivante du dossier. Les informations secondaires restent repliées pour garder l’écran lisible."
        icon={ClipboardCheck}
        actions={
          <button
            type="button"
            onClick={
              refreshAll
            }
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={query}
                onChange={
                  (event) =>
                    setQuery(
                      event.target.value,
                    )
                }
                placeholder="Rechercher un lot, fournisseur ou document…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                [
                  "all",
                  "Tous",
                ],
                [
                  "to_order",
                  "À commander",
                ],
                [
                  "receiving",
                  "À réceptionner",
                ],
                [
                  "qc",
                  "QC à revoir",
                ],
                [
                  "complete",
                  "Terminés",
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setFilter(
                        key as ProcurementFilter,
                      )
                    }
                    className={[
                      "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                      filter === key
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>

          {resource.loading
            || stock.loading
            || beacons.loading ? (
            <LoadingState label="Chargement des dossiers fournisseurs V1…" />
          ) : resource.error
            || stock.error
            || beacons.error ? (
            <ErrorState
              title="Dossiers fournisseurs V1 indisponibles"
              description={
                resource.error
                || stock.error
                || beacons.error
              }
              onRetry={
                refreshAll
              }
            />
          ) : rows.length ? (
            <div className="grid gap-3">
              {rows.map(
                (row) => {
                  const stage =
                    procurementStage(
                      row,
                    );

                  const quantity =
                    asNumber(
                      row.quantity,
                    );

                  const received =
                    asNumber(
                      row.quantity_received_total,
                    );

                  const accepted =
                    asNumber(
                      row.quantity_accepted_total,
                    );

                  const remaining =
                    asNumber(
                      row.quantity_remaining,
                    );

                  const rowActions =
                    procurementActionsForRow(
                      localizedActions,
                      row,
                    );

                  const primaryActions =
                    primaryProcurementAction(
                      localizedActions,
                      row,
                    );

                  const primaryKey =
                    primaryActions[0]
                      ?.key
                    ?? "";

                  const secondaryActions =
                    rowActions.filter(
                      (action) =>
                        action.key
                        !== primaryKey,
                    );

                  const supplier =
                    asString(
                      row.supplier_name,
                    )
                    || asString(
                      row.legacy_supplier,
                    )
                    || "Fournisseur non renseigné";

                  const stockRow =
                    stockByLot.get(
                      asString(
                        row.id,
                      ),
                    );

                  const actualAvailable =
                    asNumber(
                      stockRow
                        ?.quantity_available,
                    );

                  const invoiceOutstanding =
                    Math.max(
                      0,
                      asNumber(
                        row.invoice_amount_ttc,
                      )
                      - asNumber(
                          row.amount_paid,
                        ),
                    );

                  const qcGap =
                    Math.max(
                      0,
                      received
                      - accepted,
                    );

                  return (
                    <article
                      key={
                        asString(
                          row.id,
                        )
                      }
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-950">
                              {asString(
                                row.lot_code,
                              )
                              || "Lot sans code"}
                            </h3>

                            <StatusBadge
                              status={
                                stage.key
                              }
                              label={
                                stage.label
                              }
                            />
                          </div>

                          <p className="mt-1 text-sm text-slate-600">
                            {supplier}
                            {" · "}
                            {categoryLabel(
                              row.category,
                            )}
                            {" · "}
                            {formatNumber(
                              quantity,
                            )}
                            {" unité(s)"}
                          </p>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                BC
                              </p>
                              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                                {asString(
                                  row.po_number,
                                )
                                || "À créer"}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Reçu
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatNumber(
                                  received,
                                )}
                                {" / "}
                                {formatNumber(
                                  quantity,
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                QC conforme
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatNumber(
                                  accepted,
                                )}
                                {" / "}
                                {formatNumber(
                                  quantity,
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Disponible
                              </p>
                              <p className="mt-1 text-sm font-semibold text-teal-700">
                                {formatNumber(
                                  actualAvailable,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
                            Action suivante
                          </p>

                          <p className="mt-2 text-xs leading-5 text-teal-900">
                            {stage.detail}
                          </p>

                          <div className="mt-3 [&_button]:w-full [&_button]:border-teal-700 [&_button]:bg-teal-700 [&_button]:px-4 [&_button]:py-3 [&_button]:font-semibold [&_button]:text-white [&_button]:hover:bg-teal-800">
                            <ResourceActionButtons
                              resource="ops_procurement"
                              actions={
                                primaryActions
                              }
                              row={row}
                              scope="row"
                              onComplete={
                                refreshAll
                              }
                            />
                          </div>

                          {!primaryActions.length ? (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                              Aucune action prioritaire : dossier à jour.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <details className="group mt-4 border-t border-slate-100 pt-3">
                        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
                          Voir les détails, documents et autres actions
                        </summary>

                        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Bon de commande
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {asString(
                                  row.po_number,
                                )
                                || "Non créé"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {asString(
                                  row.purchase_order_status,
                                )
                                  ? poStatusLabel(
                                      asString(
                                        row.purchase_order_status,
                                      ),
                                    )
                                  : "—"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                TTC :
                                {" "}
                                {formatMoney(
                                  row.purchase_order_amount_ttc,
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Livraison / réception
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatNumber(
                                  received,
                                )}
                                {" reçue(s), "}
                                {formatNumber(
                                  remaining,
                                )}
                                {" restante(s)"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Prévue :
                                {" "}
                                {formatDateOnly(
                                  row.expected_delivery,
                                )}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatNumber(
                                  asNumber(
                                    row.delivery_count,
                                  ),
                                )}
                                {" livraison(s) · "}
                                {asString(
                                  row.dn_number,
                                )
                                || "Aucun BL"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Facture / règlement
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {asString(
                                  row.invoice_number,
                                )
                                || "Aucune facture"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {asString(
                                  row.payment_status,
                                )
                                  ? paymentStatusLabel(
                                      asString(
                                        row.payment_status,
                                      ),
                                    )
                                  : "—"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Reste :
                                {" "}
                                {formatMoney(
                                  invoiceOutstanding,
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Contrôle qualité
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatNumber(
                                  accepted,
                                )}
                                {" conforme(s)"}
                              </p>
                              <p className={[
                                "mt-1 text-xs",
                                qcGap > 0
                                  ? "font-semibold text-rose-600"
                                  : "text-slate-500",
                              ].join(" ")}
                              >
                                Écart QC :
                                {" "}
                                {formatNumber(
                                  qcGap,
                                )}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Conditions
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {asString(
                                  row.payment_terms,
                                )
                                || "Non renseignées"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {asString(
                                  row.po_notes,
                                )
                                || "Aucune note BC"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                État du lot
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {lotStatusLabel(
                                  asString(
                                    row.lot_status,
                                  ),
                                )}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatNumber(
                                  actualAvailable,
                                )}
                                {" disponible(s)"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                              Autres actions
                            </p>

                            <div className="mt-3">
                              <ResourceActionButtons
                                resource="ops_procurement"
                                actions={
                                  secondaryActions
                                }
                                row={row}
                                scope="row"
                                onComplete={
                                  refreshAll
                                }
                              />
                            </div>

                            {stage.key
                              === "complete"
                              && actualAvailable
                                === 0 ? (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                                  Réception et QC complets, mais aucune balise du lot n’est actuellement disponible.
                                  {" "}
                                  <Link
                                    href="/ops/balises"
                                    className="font-semibold underline underline-offset-2"
                                  >
                                    Vérifier le registre
                                  </Link>
                                  .
                                </div>
                              ) : null}
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                },
              )}
            </div>
          ) : (
            <EmptyState
              title="Aucun dossier correspondant"
              description="Modifiez la recherche ou le filtre sélectionné."
            />
          )}
        </div>
      </SectionCard>
    </div>
  );
}



export function OpsStockPage() {
  const resource =
    useOpsResource(
      "ops_stock",
    );

  const beacons =
    useOpsResource(
      "ops_beacons",
    );

  const actions =
    useOpsActions(
      "ops_stock",
    );

  const localizedActions =
    useMemo(
      () =>
        localizeOpsActions(
          actions,
        ),
      [
        actions,
      ],
    );

  const [
    query,
    setQuery,
  ] = useState("");


  const v1LotCodes =
    useMemo(
      () =>
        collectV1LotCodes(
          beacons.items,
        ),
      [
        beacons.items,
      ],
    );


  const v1StockItems =
    useMemo(
      () =>
        resource.items.filter(
          (row) =>
            v1LotCodes.has(
              asString(
                row.code,
              ),
            ),
        ),
      [
        resource.items,
        v1LotCodes,
      ],
    );


  const rows =
    useMemo(
      () => {
        const normalized =
          query.trim()
            .toLowerCase();

        if (!normalized) {
          return v1StockItems;
        }

        return v1StockItems.filter(
          (row) =>
            [
              row.code,
              row.category,
              row.supplier,
              row.status,
            ]
              .map(
                asString,
              )
              .join(" ")
              .toLowerCase()
              .includes(
                normalized,
              ),
        );
      },
      [
        query,
        v1StockItems,
      ],
    );


  const ordered =
    v1StockItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_ordered,
          ),
      0,
    );

  const generated =
    v1StockItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_generated,
          ),
      0,
    );

  const available =
    v1StockItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_available,
          ),
      0,
    );

  const engaged =
    v1StockItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_assigned,
          )
        + asNumber(
            row.quantity_installed,
          )
        + asNumber(
            row.quantity_active,
          ),
      0,
    );


  const suspended =
    v1StockItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_suspended,
          ),
      0,
    );

  const cancelled =
    v1StockItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.quantity_cancelled,
          ),
      0,
    );

  const receivedLots =
    v1StockItems.filter(
      (row) =>
        asString(
          row.status,
        ) === "received",
    ).length;

  const receivedWithoutAvailable =
    v1StockItems.filter(
      (row) =>
        asString(
          row.status,
        ) === "received"
        && asNumber(
          row.quantity_available,
        ) === 0,
    ).length;

  const inventoryTracked =
    generated
    + available
    + engaged
    + suspended
    + cancelled;


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OPS · Inventaire"
        title="Stock & disponibilité"
        description="Visualisez uniquement le stock lié à la nouvelle codification V1, sans mélanger les anciens lots legacy."
        icon={Warehouse}
        actions={
          <Link
            href="/ops/commandes-fournisseurs"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0F766E] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115E59]"
          >
            <Truck className="h-4 w-4" />
            Réceptions fournisseur
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Quantité commandée"
          value={
            formatNumber(
              ordered,
            )
          }
          detail={`${formatNumber(
            v1StockItems.length,
          )} lot(s) V1`}
          icon={Boxes}
          accent="brand"
        />

        <MetricCard
          label="Encore générées"
          value={
            formatNumber(
              generated,
            )
          }
          detail="Identités sans libération physique"
          icon={PackageOpen}
          accent="violet"
        />

        <MetricCard
          label="Disponibles"
          value={
            formatNumber(
              available,
            )
          }
          detail="Plaques reçues et QC conformes"
          icon={PackageCheck}
          accent="teal"
        />

        <MetricCard
          label="Engagées terrain"
          value={
            formatNumber(
              engaged,
            )
          }
          detail="Affectées + installées + actives"
          icon={Sparkles}
          accent="amber"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Lots réceptionnés"
          value={
            formatNumber(
              receivedLots,
            )
          }
          detail={`${formatNumber(
            v1StockItems.length,
          )} lot(s) V1 physique(s)`}
          icon={CheckCircle2}
          accent="brand"
        />

        <MetricCard
          label="Suspendues"
          value={
            formatNumber(
              suspended,
            )
          }
          detail="Balises temporairement hors service"
          icon={AlertTriangle}
          accent="amber"
        />

        <MetricCard
          label="Annulées"
          value={
            formatNumber(
              cancelled,
            )
          }
          detail="Balises sorties du cycle opérationnel"
          icon={ShieldCheck}
          accent="violet"
        />

        <MetricCard
          label="Inventaire suivi"
          value={
            formatNumber(
              inventoryTracked,
            )
          }
          detail={`${formatNumber(
            receivedWithoutAvailable,
          )} lot(s) reçu(s) sans disponible`}
          icon={Activity}
          accent="teal"
        />
      </section>

      <SectionCard
        title="Lecture opérationnelle du stock"
        description="Vue de contrôle pour identifier rapidement les écarts entre lot, disponibilité physique et consommation terrain."
        icon={Activity}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">
              À approvisionner
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatNumber(
                generated,
              )}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Balises encore générées, non libérées physiquement.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
              Prêt terrain
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatNumber(
                available,
              )}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Balises réellement disponibles après réception et QC conforme.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">
              À contrôler
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatNumber(
                receivedWithoutAvailable,
              )}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Lots reçus dont aucune balise n’est actuellement disponible.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 text-sm text-cyan-950">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="leading-6">
          Le statut logistique du lot et le statut individuel des balises sont deux informations distinctes.
          {" "}
          <strong>
            Seule la réception fournisseur avec QC conforme libère des balises `available`.
          </strong>
          {" "}
          OPS ne réalise aucune affectation terrain.
        </p>
      </div>

      <SectionCard
        title="Inventaire par lot"
        description="Quantités réelles par étape du cycle de vie."
        icon={Boxes}
        actions={
          <button
            type="button"
            onClick={() => {
              resource.refresh();
              beacons.refresh();
            }}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        }
      >
        <div className="relative mb-5 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            value={query}
            onChange={
              (event) =>
                setQuery(
                  event.target.value,
                )
            }
            placeholder="Rechercher un lot, fournisseur, type ou statut…"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          />
        </div>

        {resource.loading
          || beacons.loading ? (
          <LoadingState label="Chargement du stock V1…" />
        ) : resource.error
          || beacons.error ? (
          <ErrorState
            title="Stock V1 indisponible"
            description={
              resource.error
              || beacons.error
            }
            onRetry={() => {
              resource.refresh();
              beacons.refresh();
            }}
          />
        ) : rows.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1380px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    Lot
                  </th>
                  <th className="px-4 py-3">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-right">
                    Commandées
                  </th>
                  <th className="px-4 py-3 text-right">
                    Générées
                  </th>
                  <th className="px-4 py-3 text-right">
                    Disponibles
                  </th>
                  <th className="px-4 py-3 text-right">
                    Affectées
                  </th>
                  <th className="px-4 py-3 text-right">
                    Installées
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actives
                  </th>
                  <th className="px-4 py-3 text-right">
                    Suspendues
                  </th>
                  <th className="px-4 py-3 text-right">
                    Annulées
                  </th>
                  <th className="px-4 py-3">
                    Utilisation
                  </th>
                  <th className="px-4 py-3">
                    Actions lot
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map(
                  (row) => {
                    const orderedRow =
                      asNumber(
                        row.quantity_ordered,
                      );

                    const availableRow =
                      asNumber(
                        row.quantity_available,
                      );

                    const consumption =
                      asNumber(
                        row.taux_consommation,
                      );

                    return (
                      <tr
                        key={
                          asString(
                            row.id,
                          )
                        }
                        className="align-top hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">
                            {asString(
                              row.code,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {asString(
                              row.supplier,
                            )
                            || "Fournisseur non renseigné"}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {asString(
                              row.category,
                            )
                            || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={
                              asString(
                                row.status,
                              )
                            }
                            label={
                              lotStatusLabel(
                                asString(
                                  row.status,
                                ),
                              )
                            }
                          />

                          {asString(
                            row.status,
                          ) === "received"
                          && availableRow === 0 ? (
                            <p className="mt-2 max-w-40 text-[11px] leading-4 text-amber-700">
                              QC reçu ≠ stock actuellement disponible
                            </p>
                          ) : null}
                        </td>

                        {[
                          row.quantity_ordered,
                          row.quantity_generated,
                          row.quantity_available,
                          row.quantity_assigned,
                          row.quantity_installed,
                          row.quantity_active,
                          row.quantity_suspended,
                          row.quantity_cancelled,
                        ].map(
                          (
                            value,
                            index,
                          ) => (
                            <td
                              key={index}
                              className="px-4 py-4 text-right text-sm font-semibold text-slate-800"
                            >
                              {formatNumber(
                                asNumber(
                                  value,
                                ),
                              )}
                            </td>
                          ),
                        )}

                        <td className="px-4 py-4">
                          <div className="w-36">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {formatNumber(
                                  consumption,
                                )}
                                {" %"}
                              </span>

                              <span>
                                {formatNumber(
                                  availableRow,
                                )}
                                {" dispo."}
                              </span>
                            </div>

                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-teal-600"
                                style={{
                                  width:
                                    `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        consumption,
                                      ),
                                    )}%`,
                                }}
                              />
                            </div>

                            <p className="mt-2 text-[11px] text-slate-400">
                              {formatNumber(
                                orderedRow,
                              )}
                              {" commandée(s)"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <ResourceActionButtons
                            resource="ops_stock"
                            actions={localizedActions}
                            row={row}
                            scope="row"
                            onComplete={
                              resource.refresh
                            }
                          />
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Aucun lot en stock"
            description="Les lots générés et approvisionnés apparaîtront ici."
          />
        )}
      </SectionCard>
    </div>
  );
}


export function OpsBeaconsPage() {
  const resource =
    useOpsResource(
      "ops_beacons",
    );

  const v1Beacons =
    useMemo(
      () =>
        resource.items.filter(
          isV1Beacon,
        ),
      [
        resource.items,
      ],
    );

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("");

  const [
    lotCode,
    setLotCode,
  ] = useState("");


  const statuses =
    useMemo(
      () =>
        Array.from(
          new Set(
            v1Beacons
              .map(
                (row) =>
                  asString(
                    row.status,
                  ),
              )
              .filter(
                Boolean,
              ),
          ),
        ).sort(),
      [
        v1Beacons,
      ],
    );


  const categories =
    useMemo(
      () =>
        Array.from(
          new Set(
            v1Beacons
              .map(
                (row) =>
                  asString(
                    row.category,
                  ),
              )
              .filter(
                Boolean,
              ),
          ),
        ).sort(),
      [
        v1Beacons,
      ],
    );


  const lotCodes =
    useMemo(
      () =>
        Array.from(
          new Set(
            v1Beacons
              .map(
                (row) =>
                  asString(
                    row.lot_code,
                  ),
              )
              .filter(
                Boolean,
              ),
          ),
        ).sort(),
      [
        v1Beacons,
      ],
    );


  const rows =
    useMemo(
      () => {
        const normalized =
          query.trim()
            .toLowerCase();

        return v1Beacons.filter(
          (row) => {
            if (
              status
              && asString(
                row.status,
              ) !== status
            ) {
              return false;
            }

            if (
              category
              && asString(
                row.category,
              ) !== category
            ) {
              return false;
            }

            if (
              lotCode
              && asString(
                row.lot_code,
              ) !== lotCode
            ) {
              return false;
            }

            if (!normalized) {
              return true;
            }

            return [
              row.public_number,
              row.lot_code,
              row.category,
              row.commune_code_at_issue,
              row.assigned_agent,
            ]
              .map(
                asString,
              )
              .join(" ")
              .toLowerCase()
              .includes(
                normalized,
              );
          },
        );
      },
      [
        category,
        lotCode,
        query,
        v1Beacons,
        status,
      ],
    );


  const countStatus =
    (value: string) =>
      v1Beacons.filter(
        (row) =>
          asString(
            row.status,
          ) === value,
      ).length;


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OPS · Parc physique"
        title="Balises & traçabilité"
        description="Consultez uniquement les balises physiques de la nouvelle codification V1. Les références legacy et digital_only sont exclues de cette vue opérationnelle."
        icon={Eye}
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            V1 uniquement · CCCCC-NNNNNNNN-C
          </span>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Parc V1 physique"
          value={
            formatNumber(
              v1Beacons.length,
            )
          }
          detail={`${formatNumber(
            lotCodes.length,
          )} lot(s) référencé(s)`}
          icon={Boxes}
          accent="brand"
        />

        {[
          [
            "Générées",
            "generated",
            "Numéros non libérés",
          ],
          [
            "Disponibles",
            "available",
            "QC conforme",
          ],
          [
            "Affectées",
            "assigned",
            "Prises en charge terrain",
          ],
          [
            "Installées",
            "installed",
            "Pose effectuée",
          ],
          [
            "Actives",
            "active",
            "Validation Supervisor",
          ],
        ].map(
          ([
            label,
            key,
            detail,
          ]) => (
            <MetricCard
              key={key}
              label={label}
              value={
                formatNumber(
                  countStatus(
                    key,
                  ),
                )
              }
              detail={detail}
              icon={Boxes}
              accent={
                key === "available"
                  ? "teal"
                  : key === "active"
                    ? "amber"
                    : "brand"
              }
            />
          ),
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Contrôle du cycle de vie"
          description="Statuts nécessitant une attention particulière dans le parc physique."
          icon={ShieldCheck}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">
                Suspendues
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">
                {formatNumber(
                  countStatus(
                    "suspended",
                  ),
                )}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Balises temporairement hors service.
              </p>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">
                Annulées
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">
                {formatNumber(
                  countStatus(
                    "cancelled",
                  ),
                )}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Balises sorties du cycle opérationnel.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Répartition du parc"
          description="Lecture rapide des types de balises physiques V1 actuellement suivis."
          icon={Activity}
        >
          <div className="space-y-2">
            {categories.length ? (
              categories.map(
                (item) => {
                  const count =
                    v1Beacons.filter(
                      (row) =>
                        asString(
                          row.category,
                        ) === item,
                    ).length;

                  return (
                    <div
                      key={item}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                    >
                      <span className="text-sm text-slate-600">
                        {categoryLabel(
                          item,
                        )}
                      </span>
                      <strong className="text-sm text-slate-950">
                        {formatNumber(
                          count,
                        )}
                      </strong>
                    </div>
                  );
                },
              )
            ) : (
              <p className="text-sm text-slate-500">
                Aucune catégorie disponible.
              </p>
            )}
          </div>
        </SectionCard>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
        <p className="leading-6">
          OPS peut observer toute la progression du parc, mais ne choisit ni la demande bénéficiaire, ni l’agent, ni la planification terrain. Dès qu’une balise est
          {" "}
          <strong>Disponible</strong>
          , la responsabilité opérationnelle passe au Supervisor.
        </p>
      </div>

      <SectionCard
        title="Registre opérationnel"
        description="Recherche locale sur l’ensemble du parc accessible à OPS."
        icon={Boxes}
        actions={
          <button
            type="button"
            onClick={
              resource.refresh
            }
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        }
      >
        <div className="mb-5 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={
                (event) =>
                  setQuery(
                    event.target.value,
                  )
              }
              placeholder="Numéro, lot, commune, type ou agent…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
            />
          </div>

          <select
            value={status}
            onChange={
              (event) =>
                setStatus(
                  event.target.value,
                )
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-600"
          >
            <option value="">
              Tous les statuts
            </option>

            {statuses.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item === "generated"
                    ? "Générée"
                    : item === "available"
                      ? "Disponible"
                      : item === "assigned"
                        ? "Affectée"
                        : item === "installed"
                          ? "Installée"
                          : item === "active"
                            ? "Active"
                            : item}
                </option>
              ),
            )}
          </select>

          <select
            value={category}
            onChange={
              (event) =>
                setCategory(
                  event.target.value,
                )
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-600"
          >
            <option value="">
              Tous les types
            </option>

            {categories.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {categoryLabel(
                    item,
                  )}
                </option>
              ),
            )}
          </select>

          <select
            value={lotCode}
            onChange={
              (event) =>
                setLotCode(
                  event.target.value,
                )
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-600"
          >
            <option value="">
              Tous les lots
            </option>

            {lotCodes.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {formatNumber(
              rows.length,
            )}
            {" résultat(s) sur "}
            {formatNumber(
              v1Beacons.length,
            )}
          </span>

          {(query
            || status
            || category
            || lotCode) ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatus("");
                setCategory("");
                setLotCode("");
              }}
              className="font-semibold text-teal-700 hover:text-teal-800"
            >
              Réinitialiser les filtres
            </button>
          ) : null}
        </div>

        {resource.loading ? (
          <LoadingState label="Chargement du parc OPS…" />
        ) : resource.error ? (
          <ErrorState
            title="Parc indisponible"
            description={
              resource.error
            }
            onRetry={
              resource.refresh
            }
          />
        ) : rows.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    Numéro
                  </th>
                  <th className="px-4 py-3">
                    Statut
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Lot
                  </th>
                  <th className="px-4 py-3">
                    Commune
                  </th>
                  <th className="px-4 py-3">
                    Agent
                  </th>
                  <th className="px-4 py-3">
                    Création
                  </th>
                  <th className="px-4 py-3">
                    Activation
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map(
                  (row) => (
                    <tr
                      key={
                        asString(
                          row.id,
                        )
                      }
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-950">
                        {formatV1PublicNumber(
                          row.public_number,
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            asString(
                              row.status,
                            )
                          }
                        />
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-600">
                        {asString(
                          row.category,
                        )
                        || "—"}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-600">
                        {asString(
                          row.lot_code,
                        )
                        || "—"}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-600">
                        {asString(
                          row.commune_code_at_issue,
                        )
                        || "—"}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-600">
                        {asString(
                          row.assigned_agent,
                        )
                        || "—"}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(
                          row.created_at,
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(
                          row.activated_at,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Aucune balise correspondante"
            description="Modifiez la recherche ou le filtre de statut."
          />
        )}
      </SectionCard>
    </div>
  );
}


export function OpsExportsPage() {
  const resource =
    useOpsResource(
      "ops_exports",
    );

  const beacons =
    useOpsResource(
      "ops_beacons",
    );

  const actions =
    useOpsActions(
      "ops_exports",
    );

  const [
    query,
    setQuery,
  ] = useState("");

  const v1LotCodes =
    useMemo(
      () =>
        collectV1LotCodes(
          beacons.items,
        ),
      [
        beacons.items,
      ],
    );

  const v1ExportItems =
    useMemo(
      () =>
        resource.items.filter(
          (row) =>
            v1LotCodes.has(
              asString(
                row.code,
              ),
            ),
        ),
      [
        resource.items,
        v1LotCodes,
      ],
    );

  const rows =
    useMemo(
      () => {
        const normalized =
          query.trim()
            .toLowerCase();

        if (!normalized) {
          return v1ExportItems;
        }

        return v1ExportItems.filter(
          (row) =>
            [
              row.code,
              row.category,
              row.status,
              row.supplier,
            ]
              .map(
                asString,
              )
              .join(" ")
              .toLowerCase()
              .includes(
                normalized,
              ),
        );
      },
      [
        query,
        v1ExportItems,
      ],
    );

  const beaconTotal =
    v1ExportItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.balises_total,
          ),
      0,
    );

  const qrTotal =
    v1ExportItems.reduce(
      (
        total,
        row,
      ) =>
        total
        + asNumber(
            row.qr_disponibles,
          ),
      0,
    );

  const coverage =
    beaconTotal > 0
      ? Math.round(
          (
            qrTotal
            / beaconTotal
          )
          * 100,
        )
      : 0;

  const completeLots =
    v1ExportItems.filter(
      (row) =>
        asNumber(
          row.balises_total,
        ) > 0
        && asNumber(
          row.qr_disponibles,
        ) >= asNumber(
          row.balises_total,
        ),
    ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OPS · Documents"
        title="Documents & exports opérationnels"
        description="Préparez les supports QR des lots V1 physiques : planches PDF, fichiers PNG et manifeste CSV, sans inclure les anciennes codifications."
        icon={FileText}
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            V1 physique uniquement
          </span>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Lots exportables"
          value={
            formatNumber(
              v1ExportItems.length,
            )
          }
          detail={`${formatNumber(
            completeLots,
          )} lot(s) QR complet(s)`}
          icon={Boxes}
          accent="brand"
        />

        <MetricCard
          label="Balises concernées"
          value={
            formatNumber(
              beaconTotal,
            )
          }
          detail="Balises V1 physiques des lots suivis"
          icon={PackageOpen}
          accent="violet"
        />

        <MetricCard
          label="QR disponibles"
          value={
            formatNumber(
              qrTotal,
            )
          }
          detail="QR pouvant être exportés"
          icon={PackageCheck}
          accent="teal"
        />

        <MetricCard
          label="Couverture QR"
          value={`${formatNumber(
            coverage,
          )} %`}
          detail="QR disponibles / balises du périmètre"
          icon={Activity}
          accent="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Planches PDF"
          description="Document prêt à imprimer pour contrôle, production ou préparation logistique."
          icon={FileText}
        >
          <p className="text-sm leading-6 text-slate-600">
            Utilisez l’action
            {" "}
            <strong>PDF planches QR</strong>
            {" "}
            sur le lot concerné. Le document reste rattaché au lot sélectionné.
          </p>
        </SectionCard>

        <SectionCard
          title="Archive PNG"
          description="Fichiers QR individuels regroupés dans une archive ZIP."
          icon={Boxes}
        >
          <p className="text-sm leading-6 text-slate-600">
            Utilisez
            {" "}
            <strong>ZIP PNG QR</strong>
            {" "}
            lorsque les visuels doivent être transmis à un prestataire ou intégrés à une chaîne de production.
          </p>
        </SectionCard>

        <SectionCard
          title="Manifeste CSV"
          description="Liste structurée des données du lot pour rapprochement et contrôle."
          icon={ClipboardCheck}
        >
          <p className="text-sm leading-6 text-slate-600">
            Utilisez
            {" "}
            <strong>Manifeste CSV</strong>
            {" "}
            pour les contrôles de lot, les rapprochements et les traitements externes.
          </p>
        </SectionCard>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 text-sm text-cyan-950">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="leading-6">
          Les exports sont générés lot par lot. Cette vue ne modifie aucun statut métier et n’effectue aucune réception, affectation ou activation.
        </p>
      </div>

      <SectionCard
        title="Lots & disponibilité des QR"
        description="Choisissez un lot V1 physique et lancez uniquement l’export nécessaire."
        icon={FileText}
        actions={
          <button
            type="button"
            onClick={() => {
              resource.refresh();
              beacons.refresh();
            }}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        }
      >
        <div className="relative mb-5 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            value={query}
            onChange={
              (event) =>
                setQuery(
                  event.target.value,
                )
            }
            placeholder="Rechercher un lot, type, statut ou fournisseur…"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
          />
        </div>

        {resource.loading
          || beacons.loading ? (
          <LoadingState label="Chargement des exports V1…" />
        ) : resource.error
          || beacons.error ? (
          <ErrorState
            title="Exports indisponibles"
            description={
              resource.error
              || beacons.error
            }
            onRetry={() => {
              resource.refresh();
              beacons.refresh();
            }}
          />
        ) : rows.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">
                    Lot
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Statut
                  </th>
                  <th className="px-4 py-3">
                    Fournisseur
                  </th>
                  <th className="px-4 py-3 text-right">
                    Quantité
                  </th>
                  <th className="px-4 py-3 text-right">
                    Balises
                  </th>
                  <th className="px-4 py-3 text-right">
                    QR
                  </th>
                  <th className="px-4 py-3">
                    Réception
                  </th>
                  <th className="px-4 py-3">
                    Exports
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map(
                  (row) => {
                    const total =
                      asNumber(
                        row.balises_total,
                      );

                    const qr =
                      asNumber(
                        row.qr_disponibles,
                      );

                    const rowCoverage =
                      total > 0
                        ? Math.round(
                            (
                              qr
                              / total
                            )
                            * 100,
                          )
                        : 0;

                    return (
                      <tr
                        key={
                          asString(
                            row.id,
                          )
                        }
                        className="align-top hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">
                            {asString(
                              row.code,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Couverture QR :
                            {" "}
                            {formatNumber(
                              rowCoverage,
                            )}
                            {" %"}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {categoryLabel(
                            row.category,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={
                              asString(
                                row.status,
                              )
                            }
                            label={
                              lotStatusLabel(
                                asString(
                                  row.status,
                                ),
                              )
                            }
                          />
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {asString(
                            row.supplier,
                          )
                          || "Non renseigné"}
                        </td>

                        <td className="px-4 py-4 text-right text-sm font-semibold text-slate-800">
                          {formatNumber(
                            asNumber(
                              row.quantity,
                            ),
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-sm font-semibold text-slate-800">
                          {formatNumber(
                            total,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <span className={[
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            qr >= total
                            && total > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-800",
                          ].join(" ")}
                          >
                            {formatNumber(
                              qr,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-500">
                          {formatDate(
                            row.received_at,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <ResourceActionButtons
                            resource="ops_exports"
                            actions={actions}
                            row={row}
                            scope="row"
                            onComplete={
                              resource.refresh
                            }
                          />
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Aucun lot exportable"
            description="Les lots V1 physiques disposant de balises apparaîtront ici."
          />
        )}
      </SectionCard>
    </div>
  );
}
