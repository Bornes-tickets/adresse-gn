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
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Wrench,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  type BackofficeActionDefinition,
  getBackofficeActionCatalog,
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


type AssignmentFilter =
  | "all"
  | "pending"
  | "assigned"
  | "planned";


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


function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "fr-FR",
  ).format(value);
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


function categoryLabel(
  value: unknown,
) {
  const key =
    asString(value)
      .toLowerCase();

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
    ?? asString(value)
    ?? "—";
}


function assignmentStatusLabel(
  value: unknown,
) {
  const key =
    asString(value);

  const labels:
    Record<string, string> = {
      pending:
        "À affecter",
      assigned:
        "Affectée",
      planned:
        "Planifiée",
      completed:
        "Terminée",
      cancelled:
        "Annulée",
    };

  return labels[key]
    ?? key
    ?? "—";
}


function validationStatusLabel(
  value: unknown,
) {
  const key =
    asString(value);

  const labels:
    Record<string, string> = {
      pending:
        "QC à valider",
      validated:
        "Validée",
      uninstalled:
        "Déposée",
    };

  return labels[key]
    ?? key
    ?? "—";
}


function planningStatusLabel(
  value: unknown,
) {
  const key =
    asString(value);

  const labels:
    Record<string, string> = {
      planned:
        "Planifiée",
      in_progress:
        "En cours",
      completed:
        "Terminée",
      cancelled:
        "Annulée",
    };

  return labels[key]
    ?? key
    ?? "—";
}


function isV1Row(
  row: Row,
) {
  return (
    asString(
      row.numbering_version,
    ).toLowerCase()
    === "v1"
  );
}


function looksLikeV1Number(
  value: unknown,
) {
  return /^[A-Z]{3}[0-9]{2}-[0-9]{9}$/.test(
    asString(value),
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


function useSupervisorResource(
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
          controller.signal.aborted
        ) {
          return;
        }

        setData(result);
      }
      catch (loadError) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les données.",
        );
      }
      finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  },[
    resource,
    revision,
  ]);


  return {
    items:
      data.items,
    total:
      data.total,
    loading,
    error,
    refresh: () =>
      setRevision(
        (value) =>
          value + 1,
      ),
  };
}


function useSupervisorActions(
  resource: string,
) {
  const [
    actions,
    setActions,
  ] = useState<
    BackofficeActionDefinition[]
  >([]);

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
          await getBackofficeActionCatalog(
            token,
            resource,
            controller.signal,
          );

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setActions(
          result.actions,
        );
      }
      catch (loadError) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Actions indisponibles.",
        );
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  },[
    resource,
    revision,
  ]);


  return {
    actions,
    error,
    refresh: () =>
      setRevision(
        (value) =>
          value + 1,
      ),
  };
}


function actionsByKeys(
  actions:
    BackofficeActionDefinition[],
  keys: string[],
) {
  const accepted =
    new Set(keys);

  return actions.filter(
    (action) =>
      accepted.has(
        action.key,
      ),
  );
}


function searchRows(
  rows: Row[],
  query: string,
  keys: string[],
) {
  const normalized =
    query.trim()
      .toLowerCase();

  if (!normalized) {
    return rows;
  }

  return rows.filter(
    (row) =>
      keys.some(
        (key) =>
          asString(
            row[key],
          )
            .toLowerCase()
            .includes(
              normalized,
            ),
      ),
  );
}


function RefreshButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Actualiser
    </button>
  );
}


function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

      <input
        value={value}
        onChange={
          (event) =>
            onChange(
              event.target.value,
            )
        }
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-600/10"
      />
    </div>
  );
}


export function SupervisorDashboardPage() {
  const available =
    useSupervisorResource(
      "supervisor_available_beacons",
    );

  const installations =
    useSupervisorResource(
      "supervisor_installations",
    );

  const planning =
    useSupervisorResource(
      "supervisor_planning",
    );


  const dispatchRows =
    useMemo(
      () =>
        installations.items.filter(
          (row) =>
            asString(
              row.record_kind,
            ) === "dispatch"
            && isV1Row(row),
        ),
      [
        installations.items,
      ],
    );


  const qcRows =
    useMemo(
      () =>
        installations.items.filter(
          (row) =>
            asString(
              row.record_kind,
            ) === "qc"
            && isV1Row(row),
        ),
      [
        installations.items,
      ],
    );


  const pending =
    dispatchRows.filter(
      (row) =>
        asString(
          row.status,
        ) === "pending",
    ).length;

  const assigned =
    dispatchRows.filter(
      (row) =>
        asString(
          row.status,
        ) === "assigned",
    ).length;

  const planned =
    dispatchRows.filter(
      (row) =>
        asString(
          row.status,
        ) === "planned",
    ).length;

  const qcPending =
    qcRows.filter(
      (row) =>
        asString(
          row.validation_status,
        ) === "pending",
    ).length;

  const qcValidated =
    qcRows.filter(
      (row) =>
        asString(
          row.validation_status,
        ) === "validated",
    ).length;


  function refreshAll() {
    available.refresh();
    installations.refresh();
    planning.refresh();
  }


  const loading =
    available.loading
    || installations.loading
    || planning.loading;

  const error =
    available.error
    || installations.error
    || planning.error;


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Supervision · Terrain"
        title="Pilotage des affectations"
        description="Suivez le passage du stock physique reçu vers l’affectation, la planification, l’installation et le contrôle qualité."
        icon={ShieldCheck}
        actions={
          <RefreshButton
            onClick={
              refreshAll
            }
          />
        }
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800">
            Nouvelle codification V1 uniquement
          </span>
        }
      />

      {loading ? (
        <LoadingState label="Chargement du pilotage Supervisor…" />
      ) : error ? (
        <ErrorState
          title="Pilotage Supervisor indisponible"
          description={error}
          onRetry={
            refreshAll
          }
        />
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Balises disponibles"
              value={
                formatNumber(
                  available.items.length,
                )
              }
              detail="Stock reçu par OPS"
              icon={Boxes}
              accent="teal"
            />

            <MetricCard
              label="À affecter"
              value={
                formatNumber(
                  pending,
                )
              }
              detail="Demandes terrain en attente"
              icon={ClipboardList}
              accent="amber"
            />

            <MetricCard
              label="Affectées"
              value={
                formatNumber(
                  assigned,
                )
              }
              detail="À planifier"
              icon={UserRoundCheck}
              accent="violet"
            />

            <MetricCard
              label="Planifiées"
              value={
                formatNumber(
                  planned,
                )
              }
              detail="Terrain programmé"
              icon={CalendarDays}
              accent="brand"
            />

            <MetricCard
              label="QC à valider"
              value={
                formatNumber(
                  qcPending,
                )
              }
              detail={`${formatNumber(
                qcValidated,
              )} déjà validée(s)`}
              icon={ClipboardCheck}
              accent="rose"
            />
          </section>

          <SectionCard
            title="Chaîne terrain"
            description="Chaque étape a désormais son écran et son action principale."
            icon={Activity}
          >
            <WorkflowStepper
              steps={[
                {
                  key:
                    "available",
                  label:
                    "Disponible",
                  description:
                    "Balise physique reçue et QC conforme.",
                  state:
                    available.items.length
                      ? "complete"
                      : "upcoming",
                },
                {
                  key:
                    "assignment",
                  label:
                    "Affectation",
                  description:
                    "Demande compatible + agent.",
                  state:
                    pending
                      ? "current"
                      : assigned
                        ? "complete"
                        : "upcoming",
                },
                {
                  key:
                    "planning",
                  label:
                    "Planification",
                  description:
                    "Date et organisation du terrain.",
                  state:
                    assigned
                      ? "current"
                      : planned
                        ? "complete"
                        : "upcoming",
                },
                {
                  key:
                    "installation",
                  label:
                    "Installation",
                  description:
                    "Pose effectuée par l’agent.",
                  state:
                    planned
                      ? "current"
                      : qcRows.length
                        ? "complete"
                        : "upcoming",
                },
                {
                  key:
                    "qc",
                  label:
                    "Contrôle QC",
                  description:
                    "Validation Supervisor.",
                  state:
                    qcPending
                      ? "current"
                      : qcValidated
                        ? "complete"
                        : "upcoming",
                },
              ]}
            />
          </SectionCard>

          <section className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="À traiter maintenant"
              description="Les actions qui font avancer le flux terrain."
              icon={AlertTriangle}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/supervisor/balises-disponibles"
                  className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 transition hover:bg-teal-50"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">
                    Stock prêt terrain
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">
                    {formatNumber(
                      available.items.length,
                    )}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-teal-700">
                    Voir les balises
                    <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>

                <Link
                  href="/supervisor/affectations"
                  className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 transition hover:bg-amber-50"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">
                    Demandes à affecter
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">
                    {formatNumber(
                      pending,
                    )}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-700">
                    Ouvrir les affectations
                    <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>

                <Link
                  href="/supervisor/planning"
                  className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 transition hover:bg-violet-50"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">
                    Affectées à planifier
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">
                    {formatNumber(
                      assigned,
                    )}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-violet-700">
                    Organiser le terrain
                    <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>

                <Link
                  href="/supervisor/installations"
                  className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 transition hover:bg-rose-50"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">
                    QC à valider
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">
                    {formatNumber(
                      qcPending,
                    )}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-700">
                    Contrôler les installations
                    <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>
              </div>
            </SectionCard>

            <SectionCard
              title="Lecture opérationnelle"
              description="Le Supervisor commence là où OPS s’arrête."
              icon={ShieldCheck}
            >
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <p className="rounded-xl bg-slate-50 p-3">
                  <strong className="text-slate-900">
                    OPS
                  </strong>
                  {" "}
                  libère le stock après réception et QC fournisseur.
                </p>

                <p className="rounded-xl bg-slate-50 p-3">
                  <strong className="text-slate-900">
                    Supervisor
                  </strong>
                  {" "}
                  rattache ensuite une balise disponible à une demande physique et à un agent.
                </p>

                <p className="rounded-xl bg-slate-50 p-3">
                  La planification vient
                  {" "}
                  <strong className="text-slate-900">
                    après l’affectation
                  </strong>
                  , jamais avant.
                </p>

                <p className="rounded-xl bg-slate-50 p-3">
                  Le contrôle QC terrain ne présente plus les références legacy dans l’espace de travail V1.
                </p>
              </div>
            </SectionCard>
          </section>
        </>
      )}
    </div>
  );
}


export function SupervisorAvailableBeaconsPage() {
  const resource =
    useSupervisorResource(
      "supervisor_available_beacons",
    );

  const actionCatalog =
    useSupervisorActions(
      "supervisor_available_beacons",
    );

  const [
    query,
    setQuery,
  ] = useState("");


  const rows =
    useMemo(
      () =>
        searchRows(
          resource.items.filter(
            (row) =>
              isV1Row(row)
              && asString(
                row.status,
              ) === "available",
          ),
          query,
          [
            "public_number",
            "commune_code_at_issue",
            "category",
            "lot_code",
            "supplier",
          ],
        ),
      [
        query,
        resource.items,
      ],
    );


  function refreshAll() {
    resource.refresh();
    actionCatalog.refresh();
  }


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Supervision · Stock terrain"
        title="Balises disponibles"
        description="Stock physique V1 reçu par OPS et prêt à être affecté. L’action Affecter reste visible sans défilement horizontal."
        icon={Boxes}
        actions={
          <RefreshButton
            onClick={
              refreshAll
            }
          />
        }
        meta={
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            {formatNumber(
              rows.length,
            )}
            {" balise(s) prête(s)"}
          </span>
        }
      />

      <SectionCard
        title="Stock prêt terrain"
        description="Numéro, compatibilité territoriale et action d’affectation au même endroit."
        icon={PackageCheck}
      >
        <div className="mb-4 max-w-xl">
          <SearchBox
            value={query}
            onChange={
              setQuery
            }
            placeholder="Rechercher un numéro, une commune, un type ou un lot…"
          />
        </div>

        {resource.loading ? (
          <LoadingState label="Chargement des balises disponibles…" />
        ) : resource.error
          || actionCatalog.error ? (
          <ErrorState
            title="Stock Supervisor indisponible"
            description={
              resource.error
              || actionCatalog.error
            }
            onRetry={
              refreshAll
            }
          />
        ) : rows.length ? (
          <div className="grid gap-3">
            {rows.map(
              (row) => (
                <article
                  key={
                    asString(
                      row.id,
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-slate-950">
                          {formatV1PublicNumber(
                            row.public_number,
                          )}
                        </p>

                        <StatusBadge
                          status="available"
                          label="Disponible"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Commune
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {asString(
                              row.commune_code_at_issue,
                            )
                            || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Type
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {categoryLabel(
                              row.category,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Lot
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                            {asString(
                              row.lot_code,
                            )
                            || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Réception
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {formatDate(
                              row.received_at,
                            )}
                          </p>
                        </div>
                      </div>

                      <details className="mt-3 text-xs text-slate-500">
                        <summary className="cursor-pointer font-semibold text-slate-600">
                          Voir les détails techniques
                        </summary>
                        <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
                          <p>
                            Fournisseur :
                            {" "}
                            {asString(
                              row.supplier,
                            )
                            || "Non renseigné"}
                          </p>
                          <p>
                            Lot :
                            {" "}
                            {asString(
                              row.lot_status,
                            )
                            || "—"}
                          </p>
                          <p className="truncate">
                            ID :
                            {" "}
                            {asString(
                              row.id,
                            )}
                          </p>
                        </div>
                      </details>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                        Action principale
                      </p>
                      <p className="mt-2 text-xs leading-5 text-emerald-900">
                        Rattacher cette balise à une demande physique compatible et à un agent.
                      </p>
                      <div className="mt-3 [&_button]:w-full [&_button]:border-emerald-700 [&_button]:bg-emerald-700 [&_button]:px-4 [&_button]:py-3 [&_button]:font-semibold [&_button]:text-white [&_button]:hover:bg-emerald-800">
                        <ResourceActionButtons
                          resource="supervisor_available_beacons"
                          actions={
                            actionsByKeys(
                              actionCatalog.actions,
                              [
                                "assign_to_request",
                              ],
                            )
                          }
                          row={row}
                          scope="row"
                          onComplete={
                            refreshAll
                          }
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          <EmptyState
            title="Aucune balise disponible"
            description="Les balises V1 réceptionnées par OPS avec QC conforme apparaîtront ici."
          />
        )}
      </SectionCard>
    </div>
  );
}


export function SupervisorAssignmentsPage() {
  const resource =
    useSupervisorResource(
      "supervisor_installations",
    );

  const actionCatalog =
    useSupervisorActions(
      "supervisor_installations",
    );

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<AssignmentFilter>(
    "all",
  );


  const dispatchRows =
    useMemo(
      () =>
        resource.items.filter(
          (row) =>
            asString(
              row.record_kind,
            ) === "dispatch"
            && isV1Row(row)
            && [
              "pending",
              "assigned",
              "planned",
            ].includes(
              asString(
                row.status,
              ),
            ),
        ),
      [
        resource.items,
      ],
    );


  const rows =
    useMemo(
      () => {
        const filtered =
          filter === "all"
            ? dispatchRows
            : dispatchRows.filter(
                (row) =>
                  asString(
                    row.status,
                  ) === filter,
              );

        return searchRows(
          filtered,
          query,
          [
            "order_ref",
            "customer_name",
            "customer_phone",
            "public_number",
            "commune_code_at_issue",
            "beacon_category",
            "agent_badge",
            "agent_name",
          ],
        );
      },
      [
        dispatchRows,
        filter,
        query,
      ],
    );


  const counts =
    useMemo(
      () => ({
        pending:
          dispatchRows.filter(
            (row) =>
              asString(
                row.status,
              ) === "pending",
          ).length,
        assigned:
          dispatchRows.filter(
            (row) =>
              asString(
                row.status,
              ) === "assigned",
          ).length,
        planned:
          dispatchRows.filter(
            (row) =>
              asString(
                row.status,
              ) === "planned",
          ).length,
      }),
      [
        dispatchRows,
      ],
    );


  function refreshAll() {
    resource.refresh();
    actionCatalog.refresh();
  }


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Supervision · Affectation"
        title="Affectations terrain"
        description="Traitez les demandes physiques V1 : choisissez la balise reçue, l’agent puis planifiez l’intervention."
        icon={UserRoundCheck}
        actions={
          <RefreshButton
            onClick={
              refreshAll
            }
          />
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="À affecter"
          value={
            formatNumber(
              counts.pending,
            )
          }
          detail="Demande + balise + agent"
          icon={ClipboardList}
          accent="amber"
        />

        <MetricCard
          label="Affectées"
          value={
            formatNumber(
              counts.assigned,
            )
          }
          detail="Prêtes à planifier"
          icon={UserRoundCheck}
          accent="violet"
        />

        <MetricCard
          label="Planifiées"
          value={
            formatNumber(
              counts.planned,
            )
          }
          detail="Interventions programmées"
          icon={CalendarDays}
          accent="brand"
        />
      </section>

      <SectionCard
        title="Demandes terrain V1"
        description="Une seule action principale est mise en avant selon l’état de la demande."
        icon={ClipboardCheck}
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-xl">
            <SearchBox
              value={query}
              onChange={
                setQuery
              }
              placeholder="Rechercher une commande, un client, une commune ou un agent…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              [
                "all",
                "Toutes",
              ],
              [
                "pending",
                "À affecter",
              ],
              [
                "assigned",
                "Affectées",
              ],
              [
                "planned",
                "Planifiées",
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
                      key as AssignmentFilter,
                    )
                  }
                  className={[
                    "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                    filter === key
                      ? "border-violet-700 bg-violet-700 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {resource.loading ? (
          <LoadingState label="Chargement des affectations V1…" />
        ) : resource.error
          || actionCatalog.error ? (
          <ErrorState
            title="Affectations indisponibles"
            description={
              resource.error
              || actionCatalog.error
            }
            onRetry={
              refreshAll
            }
          />
        ) : rows.length ? (
          <div className="grid gap-3">
            {rows.map(
              (row) => {
                const status =
                  asString(
                    row.status,
                  );

                const primaryKeys =
                  status === "pending"
                    ? [
                        "assign",
                      ]
                    : status === "assigned"
                      ? [
                          "schedule",
                        ]
                      : [];

                const secondaryKeys =
                  status === "assigned"
                  || status === "planned"
                    ? [
                        "reassign",
                      ]
                    : [];

                return (
                  <article
                    key={
                      asString(
                        row.id,
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-950">
                            {asString(
                              row.order_ref,
                            )
                            || "Demande physique"}
                          </p>

                          <StatusBadge
                            status={status}
                            label={
                              assignmentStatusLabel(
                                status,
                              )
                            }
                          />
                        </div>

                        <p className="mt-1 text-sm text-slate-600">
                          {asString(
                            row.customer_name,
                          )
                          || "Client non renseigné"}

                          {asString(
                            row.customer_phone,
                          )
                            ? (
                                <>
                                  {" · "}
                                  {asString(
                                    row.customer_phone,
                                  )}
                                </>
                              )
                            : null}
                        </p>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Commune
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {asString(
                                row.commune_code_at_issue,
                              )
                              || "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Type
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {categoryLabel(
                                row.beacon_category,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Agent
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {asString(
                                row.agent_name,
                              )
                              || asString(
                                row.agent_badge,
                              )
                              || "À choisir"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Planification
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {formatDate(
                                row.scheduled_at,
                              )}
                            </p>
                          </div>
                        </div>

                        {status !== "pending"
                          && asString(
                            row.public_number,
                          ) ? (
                            <p className="mt-3 text-xs text-slate-500">
                              Balise affectée :
                              {" "}
                              <strong className="text-slate-700">
                                {formatV1PublicNumber(
                                  row.public_number,
                                )}
                              </strong>
                            </p>
                          ) : null}
                      </div>

                      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700">
                          Action suivante
                        </p>

                        <p className="mt-2 text-xs leading-5 text-violet-900">
                          {status === "pending"
                            ? "Choisir une balise reçue disponible et un agent actif."
                            : status === "assigned"
                              ? "Programmer la date d’intervention terrain."
                              : "Intervention planifiée : suivre l’exécution terrain."}
                        </p>

                        {primaryKeys.length ? (
                          <div className="mt-3 [&_button]:w-full [&_button]:border-violet-700 [&_button]:bg-violet-700 [&_button]:px-4 [&_button]:py-3 [&_button]:font-semibold [&_button]:text-white [&_button]:hover:bg-violet-800">
                            <ResourceActionButtons
                              resource="supervisor_installations"
                              actions={
                                actionsByKeys(
                                  actionCatalog.actions,
                                  primaryKeys,
                                )
                              }
                              row={row}
                              scope="row"
                              onComplete={
                                refreshAll
                              }
                            />
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700">
                            Suivi terrain en cours
                          </div>
                        )}

                        {secondaryKeys.length ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-semibold text-violet-800">
                              Autres actions
                            </summary>
                            <div className="mt-2">
                              <ResourceActionButtons
                                resource="supervisor_installations"
                                actions={
                                  actionsByKeys(
                                    actionCatalog.actions,
                                    secondaryKeys,
                                  )
                                }
                                row={row}
                                scope="row"
                                onComplete={
                                  refreshAll
                                }
                              />
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <EmptyState
            title="Aucune affectation correspondante"
            description="Les demandes physiques V1 à traiter apparaîtront ici."
          />
        )}
      </SectionCard>
    </div>
  );
}


export function SupervisorPlanningPage() {
  const resource =
    useSupervisorResource(
      "supervisor_planning",
    );

  const actionCatalog =
    useSupervisorActions(
      "supervisor_planning",
    );

  const [
    query,
    setQuery,
  ] = useState("");


  const rows =
    useMemo(
      () =>
        searchRows(
          resource.items.filter(
            (row) =>
              looksLikeV1Number(
                row.public_number,
              ),
          ),
          query,
          [
            "public_number",
            "agent_badge",
            "agent_name",
            "commune_name",
            "address_hint",
            "status",
          ],
        ),
      [
        query,
        resource.items,
      ],
    );


  const planned =
    rows.filter(
      (row) =>
        asString(
          row.status,
        ) === "planned",
    ).length;

  const inProgress =
    rows.filter(
      (row) =>
        asString(
          row.status,
        ) === "in_progress",
    ).length;


  function refreshAll() {
    resource.refresh();
    actionCatalog.refresh();
  }


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Supervision · Organisation terrain"
        title="Planification"
        description="Pilotez uniquement les interventions déjà affectées. La création manuelle par UUID n’est plus mise en avant."
        icon={CalendarDays}
        actions={
          <Link
            href="/supervisor/affectations"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-semibold text-violet-800 transition hover:bg-violet-100"
          >
            Voir les affectations
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Planifiées"
          value={
            formatNumber(
              planned,
            )
          }
          detail="Interventions programmées"
          icon={CalendarDays}
          accent="brand"
        />

        <MetricCard
          label="En cours"
          value={
            formatNumber(
              inProgress,
            )
          }
          detail="Terrain en exécution"
          icon={Wrench}
          accent="amber"
        />

        <MetricCard
          label="Total suivi V1"
          value={
            formatNumber(
              rows.length,
            )
          }
          detail="Plannings nouvelle codification"
          icon={ClipboardList}
          accent="violet"
        />
      </section>

      <SectionCard
        title="Agenda terrain"
        description="Les informations techniques restent secondaires ; l’agent, la commune, la date et le statut sont prioritaires."
        icon={CalendarDays}
        actions={
          <RefreshButton
            onClick={
              refreshAll
            }
          />
        }
      >
        <div className="mb-4 max-w-xl">
          <SearchBox
            value={query}
            onChange={
              setQuery
            }
            placeholder="Rechercher un numéro, un agent, une commune ou un statut…"
          />
        </div>

        {resource.loading ? (
          <LoadingState label="Chargement du planning V1…" />
        ) : resource.error
          || actionCatalog.error ? (
          <ErrorState
            title="Planning indisponible"
            description={
              resource.error
              || actionCatalog.error
            }
            onRetry={
              refreshAll
            }
          />
        ) : rows.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map(
              (row) => (
                <article
                  key={
                    asString(
                      row.id,
                    )
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {formatV1PublicNumber(
                          row.public_number,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {asString(
                          row.commune_name,
                        )
                        || "Commune non renseignée"}
                      </p>
                    </div>

                    <StatusBadge
                      status={
                        asString(
                          row.status,
                        )
                      }
                      label={
                        planningStatusLabel(
                          row.status,
                        )
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Date terrain
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDateOnly(
                          row.scheduled_date,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Agent
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {asString(
                          row.agent_name,
                        )
                        || asString(
                          row.agent_badge,
                        )
                        || "Non affecté"}
                      </p>
                    </div>
                  </div>

                  {asString(
                    row.address_hint,
                  )
                    || asString(
                      row.notes,
                    ) ? (
                    <div className="mt-3 rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-600">
                      {asString(
                        row.address_hint,
                      )
                        ? (
                            <p>
                              <strong>
                                Indication :
                              </strong>
                              {" "}
                              {asString(
                                row.address_hint,
                              )}
                            </p>
                          )
                        : null}

                      {asString(
                        row.notes,
                      )
                        ? (
                            <p className="mt-1">
                              <strong>
                                Notes :
                              </strong>
                              {" "}
                              {asString(
                                row.notes,
                              )}
                            </p>
                          )
                        : null}
                    </div>
                  ) : null}

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <ResourceActionButtons
                      resource="supervisor_planning"
                      actions={
                        actionsByKeys(
                          actionCatalog.actions,
                          [
                            "update",
                            "delete",
                          ],
                        )
                      }
                      row={row}
                      scope="row"
                      onComplete={
                        refreshAll
                      }
                    />
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          <EmptyState
            title="Aucune intervention planifiée"
            description="Affectez d’abord une balise et un agent, puis utilisez Planifier depuis l’écran Affectations."
          />
        )}
      </SectionCard>
    </div>
  );
}


export function SupervisorInstallationsQcPage() {
  const resource =
    useSupervisorResource(
      "supervisor_installations",
    );

  const actionCatalog =
    useSupervisorActions(
      "supervisor_installations",
    );

  const [
    query,
    setQuery,
  ] = useState("");


  const qcRows =
    useMemo(
      () =>
        resource.items.filter(
          (row) =>
            asString(
              row.record_kind,
            ) === "qc"
            && isV1Row(row),
        ),
      [
        resource.items,
      ],
    );


  const rows =
    useMemo(
      () =>
        searchRows(
          qcRows,
          query,
          [
            "public_number",
            "order_ref",
            "agent_badge",
            "agent_name",
            "validation_status",
          ],
        ),
      [
        qcRows,
        query,
      ],
    );


  const pending =
    qcRows.filter(
      (row) =>
        asString(
          row.validation_status,
        ) === "pending",
    ).length;

  const validated =
    qcRows.filter(
      (row) =>
        asString(
          row.validation_status,
        ) === "validated",
    ).length;

  const uninstalled =
    qcRows.filter(
      (row) =>
        asString(
          row.validation_status,
        ) === "uninstalled",
    ).length;


  function refreshAll() {
    resource.refresh();
    actionCatalog.refresh();
  }


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Supervision · Installation terrain"
        title="Installations & contrôle QC"
        description="Contrôlez uniquement les installations de la nouvelle codification V1. Les références legacy restent hors de cet écran opérationnel."
        icon={ClipboardCheck}
        actions={
          <ResourceActionButtons
            resource="supervisor_installations"
            actions={
              actionsByKeys(
                actionCatalog.actions,
                [
                  "draw_qc",
                ],
              )
            }
            row={null}
            scope="global"
            onComplete={
              refreshAll
            }
          />
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="QC à valider"
          value={
            formatNumber(
              pending,
            )
          }
          detail="Installations en attente"
          icon={Clock}
          accent="amber"
        />

        <MetricCard
          label="Validées"
          value={
            formatNumber(
              validated,
            )
          }
          detail="Contrôles terminés"
          icon={CheckCircle2}
          accent="teal"
        />

        <MetricCard
          label="Déposées"
          value={
            formatNumber(
              uninstalled,
            )
          }
          detail="Balises retirées"
          icon={Wrench}
          accent="rose"
        />
      </section>

      <SectionCard
        title="Contrôle des installations V1"
        description="Photo, GPS, précision, agent et décision QC sans afficher les URLs techniques complètes."
        icon={Camera}
        actions={
          <RefreshButton
            onClick={
              refreshAll
            }
          />
        }
      >
        <div className="mb-4 max-w-xl">
          <SearchBox
            value={query}
            onChange={
              setQuery
            }
            placeholder="Rechercher un numéro, une commande, un agent ou un statut QC…"
          />
        </div>

        {resource.loading ? (
          <LoadingState label="Chargement des installations V1…" />
        ) : resource.error
          || actionCatalog.error ? (
          <ErrorState
            title="Installations indisponibles"
            description={
              resource.error
              || actionCatalog.error
            }
            onRetry={
              refreshAll
            }
          />
        ) : rows.length ? (
          <div className="grid gap-3">
            {rows.map(
              (row) => {
                const validation =
                  asString(
                    row.validation_status,
                  );

                const pendingQc =
                  validation === "pending";

                return (
                  <article
                    key={
                      asString(
                        row.id,
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-950">
                            {formatV1PublicNumber(
                              row.public_number,
                            )}
                          </p>

                          <StatusBadge
                            status={validation}
                            label={
                              validationStatusLabel(
                                validation,
                              )
                            }
                          />
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Agent
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {asString(
                                row.agent_name,
                              )
                              || asString(
                                row.agent_badge,
                              )
                              || "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Installée le
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {formatDate(
                                row.installed_at,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              GPS
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {asString(
                                row.gps_lat,
                              )
                              || "—"}
                              {asString(
                                row.gps_lng,
                              )
                                ? (
                                    <>
                                      {" / "}
                                      {asString(
                                        row.gps_lng,
                                      )}
                                    </>
                                  )
                                : null}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Précision
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {asString(
                                row.accuracy_m,
                              )
                                ? `${asString(
                                    row.accuracy_m,
                                  )} m`
                                : "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Preuve
                            </p>
                            {asString(
                              row.photo_url,
                            ) ? (
                              <a
                                href={
                                  asString(
                                    row.photo_url,
                                  )
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:underline"
                              >
                                <Camera className="h-3.5 w-3.5" />
                                Voir la photo
                              </a>
                            ) : (
                              <p className="mt-1 text-sm font-semibold text-slate-500">
                                —
                              </p>
                            )}
                          </div>
                        </div>

                        {asString(
                          row.order_ref,
                        ) ? (
                          <p className="mt-3 text-xs text-slate-500">
                            Commande :
                            {" "}
                            <strong className="text-slate-700">
                              {asString(
                                row.order_ref,
                              )}
                            </strong>
                          </p>
                        ) : null}
                      </div>

                      <div className={[
                        "rounded-2xl border p-4",
                        pendingQc
                          ? "border-amber-200 bg-amber-50"
                          : "border-emerald-200 bg-emerald-50",
                      ].join(" ")}
                      >
                        <p className={[
                          "text-[10px] font-bold uppercase tracking-[0.14em]",
                          pendingQc
                            ? "text-amber-700"
                            : "text-emerald-700",
                        ].join(" ")}
                        >
                          Contrôle Supervisor
                        </p>

                        {pendingQc ? (
                          <>
                            <p className="mt-2 text-xs leading-5 text-amber-900">
                              Vérifiez la preuve terrain avant de valider ou demander une reprise.
                            </p>

                            <div className="mt-3">
                              <ResourceActionButtons
                                resource="supervisor_installations"
                                actions={
                                  actionsByKeys(
                                    actionCatalog.actions,
                                    [
                                      "validate",
                                      "reject",
                                    ],
                                  )
                                }
                                row={row}
                                scope="row"
                                onComplete={
                                  refreshAll
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">
                            {validationStatusLabel(
                              validation,
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <EmptyState
            title="Aucune installation V1 à contrôler"
            description="Les installations de la nouvelle codification apparaîtront ici après exécution terrain."
          />
        )}
      </SectionCard>
    </div>
  );
}
