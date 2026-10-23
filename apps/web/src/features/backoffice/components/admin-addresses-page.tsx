"use client";

import type {
  FormEvent,
} from "react";

import {
  useEffect,
  useState,
} from "react";

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  History,
  MapPin,
  RadioTower,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  type BackofficeAddressDetailResponse,
  type BackofficeAddressListResponse,
  getBackofficeAddress,
  listBackofficeAddresses,
} from "../api";

import {
  StandaloneResourceActions,
} from "./resource-actions";


const CATEGORIES = [
  "",
  "habitation",
  "restaurant",
  "hotel",
  "bar",
  "commerce",
  "entreprise",
  "administration",
  "ecole",
  "sante",
  "pharmacie",
  "banque",
  "tourisme",
  "other",
];


const VISIBILITIES = [
  "",
  "private",
  "public",
];


const VERIFICATIONS = [
  "",
  "unverified",
  "pending",
  "verified",
];


const STATUSES = [
  "",
  "active",
  "suspended",
  "deleted",
];


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


function categoryLabel(
  value: string,
) {
  const labels:
    Record<string, string> = {
      habitation: "Habitation",
      restaurant: "Restaurant",
      hotel: "Hôtel",
      bar: "Bar",
      commerce: "Commerce",
      entreprise: "Entreprise",
      administration: "Administration",
      ecole: "École",
      sante: "Santé",
      pharmacie: "Pharmacie",
      banque: "Banque",
      tourisme: "Tourisme",
      other: "Autre",
    };

  return labels[value] ?? value;
}


function visibilityLabel(
  value: string,
) {
  const labels:
    Record<string, string> = {
      private: "Privée",
      public: "Publique",
    };

  return labels[value] ?? value;
}


function verificationLabel(
  value: string,
) {
  const labels:
    Record<string, string> = {
      unverified: "Non vérifiée",
      pending: "En attente",
      verified: "Vérifiée",
    };

  return labels[value] ?? value;
}


function statusLabel(
  value: string,
) {
  const labels:
    Record<string, string> = {
      active: "Active",
      suspended: "Suspendue",
      deleted: "Supprimée",
    };

  return labels[value] ?? value;
}


function statusClass(
  value: string,
) {
  const classes:
    Record<string, string> = {
      active:
        "bg-emerald-50 text-emerald-700 ring-emerald-200",

      suspended:
        "bg-amber-50 text-amber-700 ring-amber-200",

      deleted:
        "bg-red-50 text-red-700 ring-red-200",
    };

  return (
    classes[value]
    ?? "bg-slate-50 text-slate-700 ring-slate-200"
  );
}


function verificationClass(
  value: string,
) {
  const classes:
    Record<string, string> = {
      verified:
        "bg-emerald-50 text-emerald-700 ring-emerald-200",

      pending:
        "bg-amber-50 text-amber-700 ring-amber-200",

      unverified:
        "bg-slate-100 text-slate-600 ring-slate-200",
    };

  return (
    classes[value]
    ?? "bg-slate-50 text-slate-700 ring-slate-200"
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
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[190px_1fr]">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd className="break-words text-sm text-slate-800">
        {value ?? "—"}
      </dd>
    </div>
  );
}


function normalizeJsonForDisplay(
  value: unknown,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}


function JsonBlock({
  value,
}: {
  value: unknown;
}) {
  if (value == null) {
    return (
      <span className="text-slate-400">
        —
      </span>
    );
  }

  const normalized =
    normalizeJsonForDisplay(value);

  return (
    <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
      {JSON.stringify(
        normalized,
        null,
        2,
      )}
    </pre>
  );
}


function AddressDetail({
  detail,
  onClose,
  onChanged,
}: {
  detail: BackofficeAddressDetailResponse;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const address =
    detail.address;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Fermer le détail"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Fiche adresse
            </p>

            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {address.name
                || "Adresse sans nom"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-2 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <section className="rounded-2xl border bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Actions administratives
            </p>

            <StandaloneResourceActions
              resource="admin_addresses"
              row={address as unknown as Record<string, unknown>}
              onComplete={onChanged}
            />
          </section>
          <section className="rounded-2xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-slate-400" />

                <h3 className="font-semibold">
                  Adresse
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                    statusClass(
                      address.status,
                    ),
                  ].join(" ")}
                >
                  {statusLabel(
                    address.status,
                  )}
                </span>

                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                    verificationClass(
                      address.verification_level,
                    ),
                  ].join(" ")}
                >
                  {verificationLabel(
                    address.verification_level,
                  )}
                </span>
              </div>
            </div>

            <dl className="mt-3">
              <DetailRow
                label="Nom"
                value={address.name}
              />

              <DetailRow
                label="Catégorie"
                value={categoryLabel(
                  address.category,
                )}
              />

              <DetailRow
                label="Visibilité"
                value={visibilityLabel(
                  address.visibility,
                )}
              />

              <DetailRow
                label="Statut adresse"
                value={statusLabel(
                  address.status,
                )}
              />

              <DetailRow
                label="Vérification"
                value={verificationLabel(
                  address.verification_level,
                )}
              />

              <DetailRow
                label="Précision"
                value={
                  address.accuracy_m != null
                    ? `${address.accuracy_m} m`
                    : null
                }
              />

              <DetailRow
                label="Point d'accès"
                value={
                  address.access_point_note
                }
              />

              <DetailRow
                label="Latitude"
                value={
                  address.point?.lat
                }
              />

              <DetailRow
                label="Longitude"
                value={
                  address.point?.lng
                }
              />

              <DetailRow
                label="Créée le"
                value={formatDate(
                  address.created_at,
                )}
              />

              <DetailRow
                label="Mise à jour"
                value={formatDate(
                  address.updated_at,
                )}
              />
            </dl>
          </section>

          <section className="rounded-2xl border p-5">
            <div className="flex items-center gap-2">
              <RadioTower className="h-5 w-5 text-slate-400" />

              <h3 className="font-semibold">
                Balise associée
              </h3>
            </div>

            {detail.beacon
              ? (
                  <dl className="mt-3">
                    <DetailRow
                      label="Numéro public"
                      value={
                        detail.beacon
                          .public_number
                      }
                    />

                    <DetailRow
                      label="Statut balise"
                      value={
                        detail.beacon.status
                      }
                    />

                    <DetailRow
                      label="Catégorie"
                      value={
                        detail.beacon.category
                      }
                    />

                    <DetailRow
                      label="Numérotation"
                      value={
                        detail.beacon
                          .numbering_version
                      }
                    />

                    <DetailRow
                      label="National ID"
                      value={
                        detail.beacon
                          .national_id
                      }
                    />

                    <DetailRow
                      label="Check digit"
                      value={
                        detail.beacon
                          .check_digit
                      }
                    />

                    <DetailRow
                      label="Code commune émission"
                      value={
                        detail.beacon
                          .commune_code_at_issue
                      }
                    />
                  </dl>
                )
              : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucune balise associée.
                  </p>
                )}
          </section>

          <section className="rounded-2xl border p-5">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-slate-400" />

              <h3 className="font-semibold">
                Propriétaire
              </h3>
            </div>

            {detail.owner
              ? (
                  <dl className="mt-3">
                    <DetailRow
                      label="Nom"
                      value={
                        detail.owner
                          .full_name
                      }
                    />

                    <DetailRow
                      label="Email"
                      value={
                        detail.owner.email
                      }
                    />

                    <DetailRow
                      label="Téléphone"
                      value={
                        detail.owner.phone
                      }
                    />

                    <DetailRow
                      label="Rôle"
                      value={
                        detail.owner.role
                      }
                    />

                    <DetailRow
                      label="Compte"
                      value={
                        detail.owner
                          .account_status
                      }
                    />
                  </dl>
                )
              : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun propriétaire rattaché.
                  </p>
                )}
          </section>

          <section className="rounded-2xl border p-5">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-slate-400" />

              <h3 className="font-semibold">
                Référentiel territorial
              </h3>
            </div>

            <dl className="mt-3">
              <DetailRow
                label="Commune"
                value={
                  detail.territory
                    .commune?.name
                }
              />

              <DetailRow
                label="Code commune"
                value={
                  detail.territory
                    .commune?.code
                }
              />

              <DetailRow
                label="Code statistique"
                value={
                  detail.territory
                    .commune?.stat_code
                }
              />

              <DetailRow
                label="Type administratif"
                value={
                  detail.territory
                    .commune
                    ?.administrative_type
                }
              />

              <DetailRow
                label="Quartier / district"
                value={
                  detail.territory
                    .district?.name
                }
              />

              <DetailRow
                label="Type district"
                value={
                  detail.territory
                    .district?.kind
                }
              />

              <DetailRow
                label="Secteur"
                value={
                  detail.territory
                    .sector?.name
                }
              />
            </dl>
          </section>

          <section className="rounded-2xl border p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-400" />

              <h3 className="font-semibold">
                Établissement
              </h3>
            </div>

            {detail.establishment
              ? (
                  <dl className="mt-3">
                    <DetailRow
                      label="Raison commerciale"
                      value={
                        detail.establishment
                          .business_name
                      }
                    />

                    <DetailRow
                      label="Téléphone"
                      value={
                        detail.establishment
                          .phone
                      }
                    />

                    <DetailRow
                      label="Description"
                      value={
                        detail.establishment
                          .description
                      }
                    />

                    <DetailRow
                      label="Couverture"
                      value={
                        detail.establishment
                          .cover_url
                      }
                    />

                    <div className="border-b py-3 last:border-b-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Horaires
                      </dt>

                      <dd>
                        <JsonBlock
                          value={
                            detail.establishment
                              .opening_hours
                          }
                        />
                      </dd>
                    </div>
                  </dl>
                )
              : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun établissement associé.
                  </p>
                )}
          </section>

          <section className="rounded-2xl border p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-slate-400" />

                <h3 className="font-semibold">
                  Historique d’audit
                </h3>
              </div>

              <span className="text-xs text-slate-400">
                {detail.journal.length}
                {" événement(s)"}
              </span>
            </div>

            {detail.journal.length
              ? (
                  <div className="mt-4 space-y-3">
                    {detail.journal.map(
                      (event) => (
                        <article
                          key={event.id}
                          className="rounded-xl border bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {event.action}
                            </span>

                            <span className="text-xs text-slate-500">
                              {formatDate(
                                event.created_at,
                              )}
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-slate-500">
                            Acteur :
                            {" "}
                            {event.actor_id
                              || "non renseigné"}
                          </p>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium text-slate-500">
                                Avant
                              </p>

                              <JsonBlock
                                value={
                                  event.before
                                }
                              />
                            </div>

                            <div>
                              <p className="text-xs font-medium text-slate-500">
                                Après
                              </p>

                              <JsonBlock
                                value={
                                  event.after
                                }
                              />
                            </div>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )
              : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun événement d’audit.
                  </p>
                )}
          </section>
        </div>
      </aside>
    </div>
  );
}


export function AdminAddressesPage() {
  const [
    data,
    setData,
  ] = useState<
    BackofficeAddressListResponse | null
  >(null);

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
    searchDraft,
    setSearchDraft,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    visibility,
    setVisibility,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("");

  const [
    verification,
    setVerification,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("");

  const [
    detail,
    setDetail,
  ] = useState<
    BackofficeAddressDetailResponse | null
  >(null);

  const [
    detailLoadingId,
    setDetailLoadingId,
  ] = useState<string | null>(
    null,
  );


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
          await listBackofficeAddresses(
            token,
            {
              page,
              pageSize: 20,
              visibility:
                visibility || null,
              category:
                category || null,
              verification:
                verification || null,
              status:
                status || null,
              query:
                search || null,
            },
            controller.signal,
          );

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setData(result);

      } catch (loadError) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les adresses.",
        );

      } finally {
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
  }, [
    page,
    search,
    visibility,
    category,
    verification,
    status,
  ]);


  function submitSearch(
    event: FormEvent,
  ) {
    event.preventDefault();

    setPage(1);

    setSearch(
      searchDraft.trim(),
    );
  }


  async function openDetail(
    addressId: string,
  ) {
    setDetailLoadingId(
      addressId,
    );

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
        await getBackofficeAddress(
          token,
          addressId,
        );

      setDetail(result);

    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Impossible de charger la fiche.",
      );

    } finally {
      setDetailLoadingId(
        null,
      );
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
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <MapPin className="h-4 w-4" />
            Référentiel des adresses
          </div>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Adresses
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Consultation administrative des adresses Adresse GN.
          </p>
        </div>

        {data && (
          <div className="rounded-xl border bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs text-slate-500">
              Résultats
            </p>

            <p className="text-2xl font-semibold">
              {data.total}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <form
          onSubmit={submitSearch}
          className="space-y-3"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={searchDraft}
              onChange={(event) =>
                setSearchDraft(
                  event.target.value,
                )
              }
              placeholder="Rechercher par nom d’adresse…"
              className="h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={visibility}
              onChange={(event) => {
                setPage(1);
                setVisibility(
                  event.target.value,
                );
              }}
              className="h-11 rounded-xl border bg-white px-3 text-sm"
            >
              {VISIBILITIES.map(
                (value) => (
                  <option
                    key={
                      value || "all"
                    }
                    value={value}
                  >
                    {value
                      ? visibilityLabel(
                          value,
                        )
                      : "Toutes visibilités"}
                  </option>
                ),
              )}
            </select>

            <select
              value={verification}
              onChange={(event) => {
                setPage(1);
                setVerification(
                  event.target.value,
                );
              }}
              className="h-11 rounded-xl border bg-white px-3 text-sm"
            >
              {VERIFICATIONS.map(
                (value) => (
                  <option
                    key={
                      value || "all"
                    }
                    value={value}
                  >
                    {value
                      ? verificationLabel(
                          value,
                        )
                      : "Toutes vérifications"}
                  </option>
                ),
              )}
            </select>

            <select
              value={category}
              onChange={(event) => {
                setPage(1);
                setCategory(
                  event.target.value,
                );
              }}
              className="h-11 rounded-xl border bg-white px-3 text-sm"
            >
              {CATEGORIES.map(
                (value) => (
                  <option
                    key={
                      value || "all"
                    }
                    value={value}
                  >
                    {value
                      ? categoryLabel(
                          value,
                        )
                      : "Toutes catégories"}
                  </option>
                ),
              )}
            </select>

            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(
                  event.target.value,
                );
              }}
              className="h-11 rounded-xl border bg-white px-3 text-sm"
            >
              {STATUSES.map(
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
                      : "Tous statuts"}
                  </option>
                ),
              )}
            </select>

            <button
              type="submit"
              className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Rechercher
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  Adresse
                </th>

                <th className="px-4 py-3">
                  Balise
                </th>

                <th className="px-4 py-3">
                  Commune
                </th>

                <th className="px-4 py-3">
                  Visibilité
                </th>

                <th className="px-4 py-3">
                  Vérification
                </th>

                <th className="px-4 py-3">
                  Statut
                </th>

                <th className="px-4 py-3">
                  Création
                </th>

                <th className="px-4 py-3 text-right">
                  Détail
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading
                ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-16 text-center text-sm text-slate-500"
                      >
                        Chargement des adresses…
                      </td>
                    </tr>
                  )
                : data?.items.length
                  ? data.items.map(
                      (item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-950">
                              {item.name
                                || "Adresse sans nom"}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {categoryLabel(
                                item.category,
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-700">
                              {item.beacon_number
                                || "—"}
                            </div>

                            {item.beacon_status && (
                              <div className="mt-1 text-xs text-slate-400">
                                {item.beacon_status}
                                {item.beacon_numbering_version
                                  ? ` · ${item.beacon_numbering_version}`
                                  : ""}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-600">
                            {item.commune_name
                              || "—"}
                          </td>

                          <td className="px-4 py-3 text-sm text-slate-600">
                            {visibilityLabel(
                              item.visibility,
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                                verificationClass(
                                  item.verification_level,
                                ),
                              ].join(" ")}
                            >
                              {verificationLabel(
                                item.verification_level,
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                                statusClass(
                                  item.status,
                                ),
                              ].join(" ")}
                            >
                              {statusLabel(
                                item.status,
                              )}
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
                                detailLoadingId
                                === item.id
                              }
                              onClick={() =>
                                void openDetail(
                                  item.id,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Eye className="h-4 w-4" />

                              {detailLoadingId
                                === item.id
                                ? "Chargement…"
                                : "Voir"}
                            </button>
                          </td>
                        </tr>
                      ),
                    )
                  : (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-16 text-center text-sm text-slate-500"
                        >
                          Aucune adresse trouvée.
                        </td>
                      </tr>
                    )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="flex flex-col justify-between gap-3 border-t px-4 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">
              Page
              {" "}
              {data.page}
              {" / "}
              {totalPages}
              {" — "}
              {data.total}
              {" adresse(s)"}
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
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

              <button
                type="button"
                disabled={
                  loading
                  || page >= totalPages
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
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {detail && (
        <AddressDetail
          detail={detail}
          onClose={() =>
            setDetail(null)
          }
          onChanged={() =>
            openDetail(
              detail.address.id,
            )
          }
        />
      )}
    </div>
  );
}