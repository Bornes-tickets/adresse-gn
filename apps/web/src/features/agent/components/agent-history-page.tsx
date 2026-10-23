"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AgentApiError,
  type AgentHistoryItem,
  type AgentIdentity,
  getAgentMe,
  listAgentHistory,
} from "@/features/agent/api";

import {
  AgentBottomNav,
} from "@/features/agent/components/agent-bottom-nav";

import {
  getAccessToken,
  supabase,
} from "@/lib/supabase/browser";


function initials(
  name: string | null | undefined,
) {
  if (!name) {
    return "AG";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ?? "",
    )
    .join("");
}


function formatAddressNumber(
  value: string,
) {
  const normalized =
    value.trim().toUpperCase();

  const match =
    normalized.match(
      /^([A-Z]{3}[0-9]{2})-([0-9]{8})([0-9])$/,
    );

  if (!match) {
    return normalized;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}


function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Date inconnue";
  }

  const date =
    new Date(value);

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
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}


function formatAccuracy(
  value: number | null,
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 2,
    },
  ).format(value)} m`;
}


function labelCategory(
  value: string | null,
) {
  if (!value) {
    return "Non renseignée";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}


export function AgentHistoryPage() {
  const router =
    useRouter();

  const [
    agent,
    setAgent,
  ] =
    useState<AgentIdentity | null>(
      null,
    );

  const [
    items,
    setItems,
  ] =
    useState<AgentHistoryItem[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    online,
    setOnline,
  ] =
    useState(true);


  useEffect(() => {
    function updateOnline() {
      setOnline(
        navigator.onLine,
      );
    }

    updateOnline();

    window.addEventListener(
      "online",
      updateOnline,
    );

    window.addEventListener(
      "offline",
      updateOnline,
    );

    return () => {
      window.removeEventListener(
        "online",
        updateOnline,
      );

      window.removeEventListener(
        "offline",
        updateOnline,
      );
    };
  }, []);


  const loadHistory =
    useCallback(
      async (
        signal?: AbortSignal,
        silent = false,
      ) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const token =
            await getAccessToken();

          if (!token) {
            router.replace(
              "/agent/login",
            );

            return;
          }

          const [
            me,
            history,
          ] =
            await Promise.all([
              getAgentMe(
                token,
                signal,
              ),
              listAgentHistory(
                token,
                signal,
              ),
            ]);

          setAgent(
            me.agent,
          );

          setItems(
            history.items,
          );
        } catch (caught) {
          if (
            caught instanceof
              DOMException &&
            caught.name ===
              "AbortError"
          ) {
            return;
          }

          if (
            caught instanceof
              AgentApiError &&
            (
              caught.statusCode ===
                401 ||
              caught.statusCode ===
                403
            )
          ) {
            await supabase.auth
              .signOut();

            router.replace(
              "/agent/login",
            );

            return;
          }

          setError(
            caught instanceof Error
              ? caught.message
              : "Impossible de charger l’historique.",
          );
        } finally {
          if (silent) {
            setRefreshing(false);
          } else {
            setLoading(false);
          }
        }
      },
      [
        router,
      ],
    );


  useEffect(() => {
    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(() => {
        void loadHistory(
          controller.signal,
        );
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
      controller.abort();
    };
  }, [
    loadHistory,
  ]);


  return (
    <div
      className="
        flex min-h-[100dvh] flex-col
        bg-slate-50
      "
    >
      <header
        className="
          bg-gradient-to-r
          from-orange-500
          via-rose-500
          to-pink-600
          px-4 py-4
          text-white shadow-lg
        "
      >
        <div
          className="
            flex items-center
            justify-between gap-4
          "
        >
          <div
            className="
              flex min-w-0
              items-center gap-3
            "
          >
            <div
              className="
                relative flex h-11 w-11
                shrink-0 items-center
                justify-center rounded-xl
                bg-white/20
                text-sm font-bold
                shadow-sm
                ring-1 ring-white/25
              "
            >
              {initials(
                agent?.full_name,
              )}

              <span
                className="
                  absolute -bottom-0.5
                  -right-0.5 h-3 w-3
                  rounded-full
                  border-2 border-rose-500
                  bg-emerald-400
                "
              />
            </div>

            <div className="min-w-0">
              <p
                className="
                  truncate text-[10px]
                  font-medium uppercase
                  tracking-widest
                  text-white/75
                "
              >
                AGENT ·{" "}
                {agent?.badge_number ??
                  "—"}
              </p>

              <p
                className="
                  truncate text-base
                  font-bold
                "
              >
                {agent?.full_name ??
                  "Agent Adresse GN"}
              </p>
            </div>
          </div>

          <div
            className="
              flex shrink-0
              items-center gap-1.5
              rounded-full
              bg-white/15
              px-3 py-1.5
              text-xs font-semibold
              ring-1 ring-white/20
            "
          >
            {online ? (
              <Wifi
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            ) : (
              <WifiOff
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            )}

            {online
              ? "En ligne"
              : "Hors ligne"}
          </div>
        </div>
      </header>


      <main
        className="
          w-full flex-1
          space-y-4
          px-2 py-4 pb-28
          sm:px-4
        "
      >
        <div
          className="
            flex items-center
            justify-between gap-3
          "
        >
          <div>
            <div
              className="
                flex items-center gap-2
              "
            >
              <Clock3
                className="
                  h-5 w-5
                  text-slate-700
                "
                aria-hidden="true"
              />

              <h1
                className="
                  text-lg font-bold
                  text-slate-900
                "
              >
                Historique
              </h1>
            </div>

            <p
              className="
                mt-1 text-sm
                text-slate-500
              "
            >
              {loading
                ? "Chargement des poses…"
                : `${items.length} pose${
                    items.length > 1
                      ? "s"
                      : ""
                  } enregistrée${
                    items.length > 1
                      ? "s"
                      : ""
                  }`}
            </p>
          </div>

          <button
            type="button"
            aria-label="Actualiser l’historique"
            disabled={
              loading ||
              refreshing
            }
            onClick={() => {
              void loadHistory(
                undefined,
                true,
              );
            }}
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-full bg-white
              text-slate-600 shadow-sm
              ring-1 ring-slate-200
              transition
              hover:text-orange-600
              disabled:opacity-50
            "
          >
            <RefreshCw
              className={
                refreshing
                  ? "h-4 w-4 animate-spin"
                  : "h-4 w-4"
              }
              aria-hidden="true"
            />
          </button>
        </div>


        {loading ? (
          <div
            className="
              flex min-h-[280px]
              items-center
              justify-center
              rounded-2xl bg-white
              shadow-sm
            "
          >
            <div
              className="
                flex flex-col
                items-center gap-3
                text-sm text-slate-500
              "
            >
              <LoaderCircle
                className="
                  h-7 w-7
                  animate-spin
                  text-orange-500
                "
                aria-hidden="true"
              />

              Chargement de l’historique…
            </div>
          </div>
        ) : null}


        {!loading && error ? (
          <div
            className="
              rounded-2xl
              border border-red-200
              bg-red-50 p-5
              text-red-800
            "
          >
            <div
              className="
                flex items-start gap-3
              "
            >
              <AlertTriangle
                className="
                  mt-0.5 h-5 w-5
                  shrink-0
                "
                aria-hidden="true"
              />

              <div>
                <p className="font-semibold">
                  Historique indisponible
                </p>

                <p
                  className="
                    mt-1 text-sm
                    text-red-700
                  "
                >
                  {error}
                </p>
              </div>
            </div>
          </div>
        ) : null}


        {!loading &&
        !error &&
        items.length === 0 ? (
          <div
            className="
              flex min-h-[360px]
              w-full flex-col
              items-center justify-center
              rounded-2xl
              border-2 border-dashed
              border-slate-200
              bg-white px-6
              text-center
            "
          >
            <div
              className="
                flex h-16 w-16
                items-center justify-center
                rounded-full
                bg-orange-100
                text-orange-600
              "
            >
              <Clock3
                className="h-7 w-7"
                aria-hidden="true"
              />
            </div>

            <h2
              className="
                mt-4 text-lg
                font-bold
                text-slate-900
              "
            >
              Aucun historique
            </h2>

            <p
              className="
                mt-2 max-w-md
                text-sm
                text-slate-500
              "
            >
              Vos poses terminées
              apparaîtront ici.
            </p>
          </div>
        ) : null}


        {!loading &&
        !error &&
        items.length > 0 ? (
          <div
            className="
              grid gap-3
              lg:grid-cols-2
            "
          >
            {items.map(
              (item) => {
                const validated =
                  Boolean(
                    item.validated_at,
                  );

                const placeName =
                  item.address.name ??
                  item.site.place_name ??
                  "Adresse sans nom";

                return (
                  <article
                    key={
                      item.installation_id
                    }
                    className="
                      overflow-hidden
                      rounded-2xl
                      border
                      border-slate-200
                      bg-white
                      shadow-sm
                    "
                  >
                    <div
                      className="
                        flex items-start
                        justify-between
                        gap-3 p-4
                      "
                    >
                      <div className="min-w-0">
                        <p
                          className="
                            text-[11px]
                            font-semibold
                            uppercase
                            tracking-wide
                            text-orange-600
                          "
                        >
                          {
                            formatAddressNumber(
                              item.beacon
                                .public_number,
                            )
                          }
                        </p>

                        <h2
                          className="
                            mt-1 truncate
                            text-base
                            font-bold
                            text-slate-900
                          "
                        >
                          {placeName}
                        </h2>

                        <p
                          className="
                            mt-1 text-xs
                            text-slate-500
                          "
                        >
                          {formatDate(
                            item.installed_at,
                          )}
                        </p>
                      </div>

                      <span
                        className={
                          validated
                            ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
                            : "inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200"
                        }
                      >
                        {validated ? (
                          <CheckCircle2
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <Clock3
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}

                        {validated
                          ? "Validée"
                          : "En attente QC"}
                      </span>
                    </div>


                    <div
                      className="
                        grid grid-cols-2
                        gap-px
                        border-y
                        border-slate-100
                        bg-slate-100
                      "
                    >
                      <div
                        className="
                          bg-white px-4 py-3
                        "
                      >
                        <p
                          className="
                            text-[10px]
                            uppercase
                            tracking-wide
                            text-slate-400
                          "
                        >
                          Précision GPS
                        </p>

                        <p
                          className="
                            mt-1 text-sm
                            font-semibold
                            text-slate-800
                          "
                        >
                          {formatAccuracy(
                            item.gps
                              .accuracy_m,
                          )}
                        </p>
                      </div>

                      <div
                        className="
                          bg-white px-4 py-3
                        "
                      >
                        <p
                          className="
                            text-[10px]
                            uppercase
                            tracking-wide
                            text-slate-400
                          "
                        >
                          Catégorie
                        </p>

                        <p
                          className="
                            mt-1 text-sm
                            font-semibold
                            text-slate-800
                          "
                        >
                          {labelCategory(
                            item.address
                              .category,
                          )}
                        </p>
                      </div>
                    </div>


                    <div
                      className="
                        space-y-2 px-4 py-3
                        text-xs text-slate-500
                      "
                    >
                      {item.order
                        .reference ? (
                        <p>
                          Commande{" "}
                          <span
                            className="
                              font-semibold
                              text-slate-700
                            "
                          >
                            {
                              item.order
                                .reference
                            }
                          </span>
                        </p>
                      ) : null}

                      {item.site
                        .address_line ? (
                        <p
                          className="
                            flex items-start
                            gap-1.5
                          "
                        >
                          <MapPin
                            className="
                              mt-0.5 h-3.5
                              w-3.5 shrink-0
                            "
                            aria-hidden="true"
                          />

                          <span>
                            {
                              item.site
                                .address_line
                            }
                          </span>
                        </p>
                      ) : null}

                      <p>
                        Visibilité :{" "}
                        <span
                          className="
                            font-medium
                            text-slate-700
                          "
                        >
                          {item.address
                            .visibility ===
                          "private"
                            ? "Privée"
                            : (
                              item.address
                                .visibility ??
                              "—"
                            )}
                        </span>
                      </p>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        ) : null}
      </main>

      <AgentBottomNav
        active="history"
      />
    </div>
  );
}