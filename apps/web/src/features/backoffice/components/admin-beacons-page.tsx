"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,

  PackageCheck,
  Search,
  X,
} from "lucide-react";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {

  type BackofficeBeaconDetailResponse,
  type BackofficeBeaconListItem,
  type BackofficeBeaconListResponse,
  getBackofficeBeacon,
  listBackofficeBeacons,
} from "../api";


const STATUSES = [
  "",
  "active",
  "suspended",
  "cancelled",
  "replaced",
  "generated",
  "assigned",
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


function statusLabel(
  status: string,
) {
  const labels:
    Record<string, string> = {
      active: "Active",
      suspended: "Suspendue",
      cancelled: "Annulée",
      replaced: "Remplacée",
      generated: "Générée",
      assigned: "Affectée",
    };

  return labels[status] ?? status;
}


function statusClass(
  status: string,
) {
  const classes:
    Record<string, string> = {
      active:
        "bg-emerald-50 text-emerald-700 ring-emerald-200",

      suspended:
        "bg-amber-50 text-amber-700 ring-amber-200",

      cancelled:
        "bg-red-50 text-red-700 ring-red-200",

      replaced:
        "bg-violet-50 text-violet-700 ring-violet-200",

      generated:
        "bg-blue-50 text-blue-700 ring-blue-200",

      assigned:
        "bg-cyan-50 text-cyan-700 ring-cyan-200",
    };

  return (
    classes[status]
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
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[180px_1fr]">
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
  detail: BackofficeBeaconDetailResponse;
  onClose: () => void;
}) {
  const beacon =
    detail.beacon;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Fermer le détail"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Fiche balise
            </p>

            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              {beacon.public_number}
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
          <section className="rounded-2xl border p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold">
                Balise
              </h3>

              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                  statusClass(
                    beacon.status,
                  ),
                ].join(" ")}
              >
                {statusLabel(
                  beacon.status,
                )}
              </span>
            </div>

            <dl className="mt-3">
              <DetailRow
                label="Numéro public"
                value={beacon.public_number}
              />

              <DetailRow
                label="Catégorie"
                value={beacon.category}
              />

              <DetailRow
                label="Version"
                value={beacon.numbering_version}
              />

              <DetailRow
                label="National ID"
                value={beacon.national_id}
              />

              <DetailRow
                label="Check digit"
                value={beacon.check_digit}
              />

              <DetailRow
                label="Code commune"
                value={beacon.commune_code_at_issue}
              />

              <DetailRow
                label="Créée le"
                value={formatDate(
                  beacon.created_at,
                )}
              />

              <DetailRow
                label="Activée le"
                value={formatDate(
                  beacon.activated_at,
                )}
              />

              <DetailRow
                label="Agent affecté"
                value={beacon.assigned_agent_id}
              />
            </dl>
          </section>

          <section className="rounded-2xl border p-5">
            <h3 className="font-semibold">
              Lot
            </h3>

            {beacon.lot
              ? (
                  <dl className="mt-3">
                    <DetailRow
                      label="Code"
                      value={beacon.lot.code}
                    />

                    <DetailRow
                      label="Fournisseur"
                      value={beacon.lot.supplier}
                    />

                    <DetailRow
                      label="Statut"
                      value={beacon.lot.status}
                    />

                    <DetailRow
                      label="Catégorie"
                      value={beacon.lot.category}
                    />
                  </dl>
                )
              : (
                  <p className="mt-3 text-sm text-slate-500">
                    Cette balise n’est rattachée à aucun lot.
                  </p>
                )}
          </section>

          <section className="rounded-2xl border p-5">
            <h3 className="font-semibold">
              Adresse
            </h3>

            {detail.address
              ? (
                  <dl className="mt-3">
                    <DetailRow
                      label="Nom"
                      value={detail.address.name}
                    />

                    <DetailRow
                      label="Catégorie"
                      value={detail.address.category}
                    />

                    <DetailRow
                      label="Visibilité"
                      value={detail.address.visibility}
                    />

                    <DetailRow
                      label="Vérification"
                      value={detail.address.verification_level}
                    />

                    <DetailRow
                      label="Statut"
                      value={detail.address.status}
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
                )
              : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucune adresse liée.
                  </p>
                )}
          </section>

          <section className="rounded-2xl border p-5">
            <h3 className="font-semibold">
              Dernière installation
            </h3>

            {detail.installation
              ? (
                  <dl className="mt-3">
                    <DetailRow
                      label="Installée le"
                      value={formatDate(
                        detail.installation
                          .installed_at,
                      )}
                    />

                    <DetailRow
                      label="Validée le"
                      value={formatDate(
                        detail.installation
                          .validated_at,
                      )}
                    />

                    <DetailRow
                      label="Désinstallée le"
                      value={formatDate(
                        detail.installation
                          .uninstalled_at,
                      )}
                    />

                    <DetailRow
                      label="Agent"
                      value={
                        detail.installation
                          .agent_id
                      }
                    />

                    <DetailRow
                      label="Latitude"
                      value={
                        detail.installation
                          .gps_lat
                      }
                    />

                    <DetailRow
                      label="Longitude"
                      value={
                        detail.installation
                          .gps_lng
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
                )
              : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucune installation liée.
                  </p>
                )}
          </section>
        </div>
      </aside>
    </div>
  );
}


export function AdminBeaconsPage() {
  const [
    data,
    setData,
  ] = useState<
    BackofficeBeaconListResponse | null
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
          await listBackofficeBeacons(
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
          );

        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setData(result);
      } catch (loadError) {
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
      } finally {
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
    search,
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
    item: BackofficeBeaconListItem,
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
    } catch (detailError) {
      const message =
        detailError instanceof Error
          ? detailError.message
          : "Impossible de charger la balise.";

      setError(message);
    } finally {
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
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <PackageCheck className="h-4 w-4" />
            Parc de balises
          </div>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Balises
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Consultation du parc physique et numérique Adresse GN.
          </p>
        </div>

        {data && (
          <div className="rounded-xl border bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs text-slate-500">
              Total
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
              className="h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-500"
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
                    : "Tous les statuts"}
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
          <table className="w-full min-w-[1000px] text-left">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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

            <tbody className="divide-y">
              {loading
                ? Array.from({
                    length: 8,
                  }).map(
                    (_, index) => (
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
                          key={item.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-950">
                              {item.public_number}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                              {item.commune_code_at_issue
                                || "—"}
                            </div>
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

                          <td className="px-4 py-3 text-sm text-slate-600">
                            {item.category
                              || "—"}
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
                              disabled={detailLoading}
                              onClick={() =>
                                void openDetail(
                                  item,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
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
              {" balises"}
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
        <BeaconDetail
          detail={detail}
          onClose={() =>
            setDetail(null)
          }
        />
      )}
    </div>
  );
}