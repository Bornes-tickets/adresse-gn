"use client";

import type { FormEvent } from "react";

import {
  useEffect,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Hash,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  type BackofficeActionDefinition,
  type BackofficeBeaconDetailResponse,
  type BackofficeBeaconListItem,
  type BackofficeBeaconListResponse,
  executeBackofficeAction,
  getAdminDashboard,
  getBackofficeActionCatalog,
  getBackofficeBeacon,
  listBackofficeBeacons,
} from "../api";

import {
  MetricCard,
  PageHeader,
  SectionCard,
  StatusBadge,
  WorkflowStepper,
} from "./professional-ui";


const FILTER_STATUSES = [
  "",
  "generated",
  "assigned",
  "active",
  "suspended",
  "cancelled",
  "replaced",
];


const CATEGORY_LABELS:
  Record<string, string> = {
    residential:
      "Résidentielle — standard",
    residential_plus:
      "Résidentielle — premium",
    professional:
      "Professionnelle",
    institutional:
      "Institutionnelle",
    custom:
      "Sur mesure",
  };


function formatNumber(
  value: number,
) {
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


function statusLabel(
  status: string,
) {
  const labels:
    Record<string, string> = {
      generated: "Générée",
      available: "Disponible",
      assigned: "Affectée",
      installed: "Installée",
      active: "Active",
      suspended: "Suspendue",
      cancelled: "Annulée",
      replaced: "Remplacée",
    };

  return (
    labels[status]
    ?? status
  );
}


function categoryLabel(
  category: string | null,
) {
  if (!category) {
    return "—";
  }

  return (
    CATEGORY_LABELS[category]
    ?? category
  );
}


function DetailRow({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number
    | null
    | undefined;
}) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[180px_1fr]">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd className="break-words text-sm text-slate-800">
        {value ?? "—"}
      </dd>
    </div>
  );
}


function BeaconDetail({
  detail,
  onClose,
}: {
  detail:
    BackofficeBeaconDetailResponse;
  onClose:
    () => void;
}) {
  const beacon =
    detail.beacon;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Fermer le détail"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
      />

      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2E4A7B]">
              Fiche balise
            </p>

            <h2 className="mt-1 font-mono text-xl font-semibold text-slate-950">
              {beacon.public_number}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <SectionCard
            title="Identité nationale"
            description="Numéro et état courant dans le cycle Adresse GN."
            icon={Hash}
            actions={
              <StatusBadge
                status={
                  beacon.status
                }
              />
            }
          >
            <dl>
              <DetailRow
                label="Numéro public"
                value={
                  beacon.public_number
                }
              />
              <DetailRow
                label="Catégorie"
                value={
                  categoryLabel(
                    beacon.category,
                  )
                }
              />
              <DetailRow
                label="Version"
                value={
                  beacon.numbering_version
                }
              />
              <DetailRow
                label="Identifiant national"
                value={
                  beacon.national_id
                }
              />
              <DetailRow
                label="Clé de contrôle"
                value={
                  beacon.check_digit
                }
              />
              <DetailRow
                label="Code commune"
                value={
                  beacon.commune_code_at_issue
                }
              />
              <DetailRow
                label="Créée le"
                value={
                  formatDate(
                    beacon.created_at,
                  )
                }
              />
              <DetailRow
                label="Activée le"
                value={
                  formatDate(
                    beacon.activated_at,
                  )
                }
              />
            </dl>
          </SectionCard>

          <SectionCard
            title="Approvisionnement"
            description="Lot physique associé à la balise."
            icon={PackageCheck}
          >
            {beacon.lot ? (
              <dl>
                <DetailRow
                  label="Code lot"
                  value={
                    beacon.lot.code
                  }
                />
                <DetailRow
                  label="Fournisseur"
                  value={
                    beacon.lot.supplier
                  }
                />
                <DetailRow
                  label="Statut du lot"
                  value={
                    beacon.lot.status
                  }
                />
                <DetailRow
                  label="Catégorie"
                  value={
                    categoryLabel(
                      beacon.lot.category,
                    )
                  }
                />
              </dl>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Aucun lot physique n’est encore associé à cette balise.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Adresse liée"
            description="Adresse créée ou rattachée à cette balise."
          >
            {detail.address ? (
              <dl>
                <DetailRow
                  label="Nom"
                  value={
                    detail.address.name
                  }
                />
                <DetailRow
                  label="Catégorie"
                  value={
                    detail.address.category
                  }
                />
                <DetailRow
                  label="Visibilité"
                  value={
                    detail.address.visibility
                  }
                />
                <DetailRow
                  label="Vérification"
                  value={
                    detail.address
                      .verification_level
                  }
                />
                <DetailRow
                  label="Statut"
                  value={
                    detail.address.status
                  }
                />
                <DetailRow
                  label="Latitude"
                  value={
                    detail.address.point
                      ?.lat
                  }
                />
                <DetailRow
                  label="Longitude"
                  value={
                    detail.address.point
                      ?.lng
                  }
                />
              </dl>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Aucune adresse liée pour le moment.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Installation terrain"
            description="Dernière installation connue pour cette balise."
          >
            {detail.installation ? (
              <dl>
                <DetailRow
                  label="Installée le"
                  value={
                    formatDate(
                      detail.installation
                        .installed_at,
                    )
                  }
                />
                <DetailRow
                  label="Validée le"
                  value={
                    formatDate(
                      detail.installation
                        .validated_at,
                    )
                  }
                />
                <DetailRow
                  label="Désinstallée le"
                  value={
                    formatDate(
                      detail.installation
                        .uninstalled_at,
                    )
                  }
                />
                <DetailRow
                  label="Agent"
                  value={
                    detail.installation
                      .agent_id
                  }
                />
                <DetailRow
                  label="Précision GPS"
                  value={
                    detail.installation
                      .accuracy_m != null
                      ? `${detail.installation.accuracy_m} m`
                      : null
                  }
                />
              </dl>
            ) : (
              <p className="text-sm leading-6 text-slate-500">
                Aucune installation liée pour le moment.
              </p>
            )}
          </SectionCard>
        </div>
      </aside>
    </div>
  );
}


type GenerateForm = {
  commune_id: string;
  category: string;
  quantity: string;
  expected_delivery: string;
  notes: string;
};


const EMPTY_FORM:
  GenerateForm = {
    commune_id: "",
    category: "",
    quantity: "100",
    expected_delivery: "",
    notes: "",
  };


export function AdminBeaconsPage() {
  const [
    data,
    setData,
  ] = useState<
    BackofficeBeaconListResponse | null
  >(null);

  const [
    actions,
    setActions,
  ] = useState<
    BackofficeActionDefinition[]
  >([]);

  const [
    counts,
    setCounts,
  ] = useState<
    Record<string, number>
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    status,
    setStatus,
  ] = useState("");

  const [
    searchDraft,
    setSearchDraft,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    detail,
    setDetail,
  ] = useState<
    BackofficeBeaconDetailResponse | null
  >(null);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    revision,
    setRevision,
  ] = useState(0);

  const [
    generationOpen,
    setGenerationOpen,
  ] = useState(false);

  const [
    confirmationOpen,
    setConfirmationOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState<GenerateForm>(
    EMPTY_FORM,
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    success,
    setSuccess,
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
          listResult,
          catalogResult,
          dashboardResult,
        ] = await Promise.all([
          listBackofficeBeacons(
            token,
            {
              page,
              pageSize: 20,
              status:
                status || null,
              query:
                search || null,
            },
            controller.signal,
          ),
          getBackofficeActionCatalog(
            token,
            "admin_beacons",
            controller.signal,
          ),
          getAdminDashboard(
            token,
            controller.signal,
          ),
        ]);

        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setData(listResult);
        setActions(
          catalogResult.actions,
        );

        setCounts(
          Object.fromEntries(
            dashboardResult
              .statutsBalises
              .map(
                (item) => [
                  item.statut,
                  item.total,
                ],
              ),
          ),
        );
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
            : "Impossible de charger les balises.",
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
    page,
    revision,
    search,
    status,
  ]);


  const generateAction =
    actions.find(
      (item) =>
        item.key
        === "generate_batch",
    ) ?? null;

  const communeField =
    generateAction
      ?.fields
      .find(
        (field) =>
          field.name
          === "commune_id",
      );

  const categoryField =
    generateAction
      ?.fields
      .find(
        (field) =>
          field.name
          === "category",
      );


  function submitSearch(
    event: FormEvent,
  ) {
    event.preventDefault();
    setPage(1);
    setSearch(
      searchDraft.trim(),
    );
  }


  function submitGeneration(
    event: FormEvent,
  ) {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    if (!generateAction) {
      setFormError(
        "L’action de génération n’est pas disponible pour cette session.",
      );
      return;
    }

    if (
      !form.commune_id
      || !form.category
      || !form.quantity.trim()
    ) {
      setFormError(
        "Commune, type de balise et quantité sont obligatoires.",
      );
      return;
    }

    const quantity =
      Number(
        form.quantity,
      );

    if (
      !Number.isInteger(quantity)
      || quantity < 1
      || quantity > 5000
    ) {
      setFormError(
        "La quantité doit être un entier compris entre 1 et 5 000.",
      );
      return;
    }

    setConfirmationOpen(
      true,
    );
  }


  async function confirmGeneration() {
    setFormError("");
    setSuccess("");

    if (!generateAction) {
      setConfirmationOpen(
        false,
      );
      setFormError(
        "L’action de génération n’est pas disponible pour cette session.",
      );
      return;
    }

    const quantity =
      Number(
        form.quantity,
      );

    if (
      !form.commune_id
      || !form.category
      || !Number.isInteger(quantity)
      || quantity < 1
      || quantity > 5000
    ) {
      setConfirmationOpen(
        false,
      );
      setFormError(
        "Les données du lot sont invalides. Vérifiez le formulaire avant de confirmer.",
      );
      return;
    }

    setSaving(true);

    try {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          "Session expirée.",
        );
      }

      await executeBackofficeAction(
        token,
        "admin_beacons",
        "generate_batch",
        {
          rowId: null,
          data: {
            commune_id:
              form.commune_id,
            category:
              form.category,
            quantity,
            expected_delivery:
              form.expected_delivery,
            notes:
              form.notes,
            _origin:
              window.location.origin,
          },
        },
      );

      setSuccess(
        `${formatNumber(quantity)} numéro(s) Adresse GN ont été générés et réservés. Ils restent au statut Générée jusqu’à leur prise en charge physique par OPS.`,
      );

      setConfirmationOpen(
        false,
      );

      setForm(
        EMPTY_FORM,
      );

      setGenerationOpen(
        false,
      );

      setPage(1);

      setRevision(
        (value) =>
          value + 1,
      );
    }
    catch(actionError) {
      setConfirmationOpen(
        false,
      );

      setFormError(
        actionError instanceof Error
          ? actionError.message
          : "La génération du lot a échoué.",
      );
    }
    finally {
      setSaving(false);
    }
  }


  async function openDetail(
    item:
      BackofficeBeaconListItem,
  ) {
    setDetailLoading(true);
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
        await getBackofficeBeacon(
          token,
          item.id,
        );

      setDetail(result);
    }
    catch(detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Impossible de charger la balise.",
      );
    }
    finally {
      setDetailLoading(false);
    }
  }


  const totalPages =
    data
      ? Math.max(
          1,
          Math.ceil(
            data.total
            / data.page_size,
          ),
        )
      : 1;


  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Référentiel national · V1"
        title="Balises Adresse GN"
        description="Générez les numéros nationaux, suivez leur progression et gardez une séparation stricte entre identité numérique et disponibilité physique."
        icon={Hash}
        actions={
          <button
            type="button"
            aria-expanded={generationOpen}
            disabled={
              loading
              || !generateAction
            }
            onClick={() => {
              setFormError("");
              setGenerationOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E3660] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2E4A7B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PackagePlus className="h-4 w-4" />
            {generationOpen
              ? "Formulaire ouvert"
              : "Générer un nouveau lot"}
          </button>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Autorité : Administration
            </span>

            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Format : CCCCC-NNNNNNNNC
            </span>
          </>
        }
      />

      {generationOpen ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
        <SectionCard
          title="Nouveau lot de balises"
          description="Réserver une série de numéros nationaux V1. Aucun stock physique n’est créé à cette étape."
          icon={PackagePlus}
          actions={
            <button
              type="button"
              aria-label="Fermer le formulaire"
              onClick={() =>
                setGenerationOpen(
                  false,
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          <form
            onSubmit={
              submitGeneration
            }
            className="grid gap-6 xl:grid-cols-[1fr_360px]"
          >
            <div className="space-y-5">
              {formError ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-800">
                  1. Commune d’émission
                </span>

                <select
                  required
                  value={
                    form.commune_id
                  }
                  onChange={
                    (event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          commune_id:
                            event.target.value,
                        }),
                      )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#2E4A7B] focus:ring-2 focus:ring-[#2E4A7B]/10"
                >
                  <option value="">
                    Sélectionner une commune officielle…
                  </option>

                  {(communeField
                    ?.options
                    ?? [])
                    .map(
                      (option) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {option.label}
                        </option>
                      ),
                    )}
                </select>

                {communeField?.help ? (
                  <span className="block text-xs leading-5 text-slate-500">
                    {communeField.help}
                  </span>
                ) : null}
              </label>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-800">
                  2. Type de balise
                </legend>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(categoryField
                    ?.options
                    ?? [])
                    .map(
                      (option) => {
                        const selected =
                          form.category
                          === option.value;

                        return (
                          <label
                            key={
                              option.value
                            }
                            className={[
                              "cursor-pointer rounded-2xl border p-4 transition",
                              selected
                                ? "border-[#2E4A7B] bg-[#2E4A7B]/5 ring-2 ring-[#2E4A7B]/10"
                                : "border-slate-200 bg-white hover:border-slate-300",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name="category"
                              value={
                                option.value
                              }
                              checked={
                                selected
                              }
                              onChange={
                                (event) =>
                                  setForm(
                                    (current) => ({
                                      ...current,
                                      category:
                                        event.target.value,
                                    }),
                                  )
                              }
                              className="sr-only"
                            />

                            <span className="block text-sm font-semibold text-slate-900">
                              {option.label}
                            </span>
                          </label>
                        );
                      },
                    )}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-800">
                    3. Quantité
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="5000"
                    required
                    value={
                      form.quantity
                    }
                    onChange={
                      (event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            quantity:
                              event.target.value,
                          }),
                        )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-[#2E4A7B] focus:ring-2 focus:ring-[#2E4A7B]/10"
                  />

                  <span className="block text-xs text-slate-500">
                    De 1 à 5 000 numéros par lot.
                  </span>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-800">
                    4. Livraison fournisseur prévue
                  </span>

                  <input
                    type="date"
                    value={
                      form.expected_delivery
                    }
                    onChange={
                      (event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            expected_delivery:
                              event.target.value,
                          }),
                        )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-[#2E4A7B] focus:ring-2 focus:ring-[#2E4A7B]/10"
                  />

                  <span className="block text-xs text-slate-500">
                    Facultatif — la commande fournisseur sera ensuite gérée par OPS.
                  </span>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-800">
                  5. Note interne
                </span>

                <textarea
                  rows={4}
                  value={
                    form.notes
                  }
                  onChange={
                    (event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          notes:
                            event.target.value,
                        }),
                      )
                  }
                  placeholder="Contexte, campagne, besoin ou instruction interne…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#2E4A7B] focus:ring-2 focus:ring-[#2E4A7B]/10"
                />
              </label>
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Résumé
              </p>

              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs text-slate-500">
                    Commune
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      communeField
                        ?.options
                        ?.find(
                          (option) =>
                            option.value
                            === form.commune_id,
                        )
                        ?.label
                      || "À sélectionner"
                    }
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-slate-500">
                    Type
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      categoryField
                        ?.options
                        ?.find(
                          (option) =>
                            option.value
                            === form.category,
                        )
                        ?.label
                      || "À sélectionner"
                    }
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-slate-500">
                    Quantité
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {form.quantity
                      || "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-slate-500">
                    Statut initial
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge
                      status="generated"
                      label="Générée"
                    />
                  </dd>
                </div>
              </dl>

              <button
                type="submit"
                disabled={
                  saving
                  || !generateAction
                }
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3660] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2E4A7B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PackagePlus className="h-4 w-4" />
                {saving
                  ? "Génération…"
                  : "Générer et réserver les numéros"}
              </button>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Cette action réserve les numéros nationaux. Elle ne confirme ni fabrication, ni réception, ni disponibilité physique.
              </p>
            </aside>
          </form>
        </SectionCard>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-6">
            {success}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">
              Référentiel indisponible
            </p>
            <p className="mt-1">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setRevision(
                (value) =>
                  value + 1,
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Réessayer
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Balises au total"
          value={
            formatNumber(
              data?.total
              ?? 0,
            )
          }
          detail="Parc numérique suivi"
          icon={Hash}
          accent="brand"
        />

        <MetricCard
          label="Générées"
          value={
            formatNumber(
              counts.generated
              ?? 0,
            )
          }
          detail="Numéros réservés, pas encore disponibles"
          icon={PackagePlus}
          accent="violet"
        />

        <MetricCard
          label="Disponibles"
          value={
            formatNumber(
              counts.available
              ?? 0,
            )
          }
          detail="Plaques reçues et QC conformes par OPS"
          icon={PackageCheck}
          accent="teal"
        />

        <MetricCard
          label="Actives"
          value={
            formatNumber(
              counts.active
              ?? 0,
            )
          }
          detail="Installations terrain validées"
          icon={Sparkles}
          accent="amber"
        />
      </section>

      <SectionCard
        title="Cycle d’une balise"
        description="Le numéro est créé par l’Administration ; la disponibilité physique dépend ensuite d’OPS."
        icon={Workflow}
      >
        <WorkflowStepper
          steps={[
            {
              key: "generated",
              label: "Numéro généré",
              description: "Identité nationale réservée.",
              state: "complete",
            },
            {
              key: "available",
              label: "Disponible",
              description: "Plaque reçue et QC conforme par OPS.",
              state: "current",
            },
            {
              key: "assigned",
              label: "Affectée",
              description: "Le Supervisor associe une balise disponible.",
            },
            {
              key: "planned",
              label: "Planifiée",
              description: "L’intervention terrain est programmée.",
            },
            {
              key: "installed",
              label: "Installée",
              description: "La pose est réalisée par l’Agent.",
            },
            {
              key: "active",
              label: "Active",
              description: "Le Supervisor valide l’installation.",
            },
          ]}
        />

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-900">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-6">
            <strong>Générée ≠ Disponible.</strong>
            {" "}
            Une balise générée est une identité numérique. Elle devient disponible uniquement après commande fournisseur, réception physique et contrôle qualité conformes par OPS.
          </p>
        </div>
      </SectionCard>


      <SectionCard
        title="Registre des balises"
        description="Recherche, filtres et consultation détaillée du parc Adresse GN."
        icon={PackageCheck}
        actions={
          <button
            type="button"
            onClick={() =>
              setRevision(
                (value) =>
                  value + 1,
              )
            }
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
        }
      >
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 lg:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={searchDraft}
              onChange={(event) =>
                setSearchDraft(
                  event.target.value,
                )
              }
              placeholder="Rechercher un numéro de balise…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#2E4A7B] focus:ring-2 focus:ring-[#2E4A7B]/10"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(
                event.target.value,
              );
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#2E4A7B]"
          >
            {FILTER_STATUSES.map(
              (value) => (
                <option
                  key={
                    value || "all"
                  }
                  value={value}
                >
                  {value
                    ? statusLabel(
                        value,
                      )
                    : "Tous les statuts"}
                </option>
              ),
            )}
          </select>

          <button
            type="submit"
            className="h-11 rounded-xl bg-[#1E3660] px-5 text-sm font-semibold text-white transition hover:bg-[#2E4A7B]"
          >
            Rechercher
          </button>
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Numéro
                  </th>
                  <th className="px-4 py-3">
                    Statut
                  </th>
                  <th className="px-4 py-3">
                    Catégorie
                  </th>
                  <th className="px-4 py-3">
                    Lot
                  </th>
                  <th className="px-4 py-3">
                    Numérotation
                  </th>
                  <th className="px-4 py-3">
                    Création
                  </th>
                  <th className="px-4 py-3 text-right">
                    Détail
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {loading
                  ? Array.from({
                      length: 6,
                    }).map(
                      (
                        _,
                        index,
                      ) => (
                        <tr key={index}>
                          <td
                            colSpan={7}
                            className="px-4 py-3"
                          >
                            <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
                          </td>
                        </tr>
                      ),
                    )
                  : data?.items.length
                    ? data.items.map(
                        (item) => (
                          <tr
                            key={
                              item.id
                            }
                            className="hover:bg-slate-50/70"
                          >
                            <td className="px-4 py-3">
                              <div className="font-mono font-semibold text-slate-950">
                                {item.public_number}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {item.commune_code_at_issue
                                  || "—"}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <StatusBadge
                                status={
                                  item.status
                                }
                              />
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-600">
                              {categoryLabel(
                                item.category,
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-600">
                              {item.lot_code
                                || "—"}
                            </td>

                            <td className="px-4 py-3">
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                {item.numbering_version}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-500">
                              {formatDate(
                                item.created_at,
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={
                                  detailLoading
                                }
                                onClick={() =>
                                  void openDetail(
                                    item,
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                <Eye className="h-4 w-4" />
                                Voir
                              </button>
                            </td>
                          </tr>
                        ),
                      )
                    : (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-6 py-16 text-center text-sm text-slate-500"
                          >
                            Aucune balise trouvée.
                          </td>
                        </tr>
                      )}
              </tbody>
            </table>
          </div>

          {data ? (
            <div className="flex flex-col justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-500">
                Page
                {" "}
                {data.page}
                {" / "}
                {totalPages}
                {" — "}
                {formatNumber(
                  data.total,
                )}
                {" balise(s)"}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    loading
                    || page <= 1
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
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </button>

                <button
                  type="button"
                  disabled={
                    loading
                    || page
                      >= totalPages
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
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {confirmationOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="generation-confirmation-title"
        >
          <button
            type="button"
            aria-label="Fermer la confirmation"
            disabled={saving}
            onClick={() =>
              setConfirmationOpen(
                false,
              )
            }
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px] disabled:cursor-wait"
          />

          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-gradient-to-br from-[#F8FBFF] via-white to-[#F3FAFA] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E3660] text-white shadow-sm">
                    <PackagePlus className="h-5 w-5" />
                  </span>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2E4A7B]">
                      Validation administrative
                    </p>

                    <h2
                      id="generation-confirmation-title"
                      className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
                    >
                      Confirmer la génération du lot
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Vérifiez les informations avant de réserver définitivement les numéros nationaux.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Fermer"
                  disabled={saving}
                  onClick={() =>
                    setConfirmationOpen(
                      false,
                    )
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <dl className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Commune
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      communeField
                        ?.options
                        ?.find(
                          (option) =>
                            option.value
                            === form.commune_id,
                        )
                        ?.label
                      || "—"
                    }
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Type
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      categoryField
                        ?.options
                        ?.find(
                          (option) =>
                            option.value
                            === form.category,
                        )
                        ?.label
                      || "—"
                    }
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Quantité
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    {formatNumber(
                      Number(
                        form.quantity,
                      )
                      || 0,
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Statut initial
                  </dt>
                  <dd className="mt-2">
                    <StatusBadge
                      status="generated"
                      label="Générée"
                    />
                  </dd>
                </div>
              </dl>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="leading-6">
                  Cette opération
                  {" "}
                  <strong>
                    réservera définitivement
                    {" "}
                    {formatNumber(
                      Number(
                        form.quantity,
                      )
                      || 0,
                    )}
                    {" "}
                    numéro(s) nationaux
                  </strong>
                  .
                  Elle ne crée aucun stock physique et ne rend aucune plaque disponible. La disponibilité sera établie ensuite par OPS après approvisionnement, réception et QC.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setConfirmationOpen(
                    false,
                  )
                }
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Retour
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void confirmGeneration()
                }
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1E3660] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2E4A7B] disabled:cursor-wait disabled:opacity-60"
              >
                <PackagePlus className="h-4 w-4" />
                {saving
                  ? "Génération en cours…"
                  : `Générer les ${formatNumber(
                      Number(
                        form.quantity,
                      )
                      || 0,
                    )} numéros`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <BeaconDetail
          detail={detail}
          onClose={() =>
            setDetail(
              null,
            )
          }
        />
      ) : null}
    </div>
  );
}
