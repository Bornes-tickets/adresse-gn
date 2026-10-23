"use client";

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Gauge,
  History,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Navigation,
  Radio,
  ShieldCheck,
  Target,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AgentApiError,
  type AgentHistoryItem,
  type AgentIdentity,
  type AgentTask,
  getAgentMe,
  listAgentHistory,
  listAgentTasks,
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
    return "Aucune";
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


function formatDecimal(
  value: number,
) {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}


export function AgentProfilePage() {
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
    tasks,
    setTasks,
  ] =
    useState<AgentTask[]>(
      [],
    );

  const [
    history,
    setHistory,
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

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);


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


  useEffect(() => {
    const controller =
      new AbortController();

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

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
          taskResponse,
          historyResponse,
        ] =
          await Promise.all([
            getAgentMe(
              token,
              controller.signal,
            ),
            listAgentTasks(
              token,
              controller.signal,
            ),
            listAgentHistory(
              token,
              controller.signal,
            ),
          ]);

        setAgent(
          me.agent,
        );

        setTasks(
          taskResponse.items,
        );

        setHistory(
          historyResponse.items,
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
            : "Impossible de charger le profil.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      controller.abort();
    };
  }, [
    router,
  ]);


  const stats =
    useMemo(
      () => {
        const total =
          history.length;

        const validated =
          history.filter(
            (item) =>
              Boolean(
                item.validated_at,
              ),
          ).length;

        const pendingQc =
          total -
          validated;

        const accuracies =
          history
            .map(
              (item) =>
                item.gps
                  .accuracy_m,
            )
            .filter(
              (
                value,
              ): value is number =>
                typeof value ===
                  "number" &&
                Number.isFinite(
                  value,
                ),
            );

        const averageAccuracy =
          accuracies.length > 0
            ? accuracies.reduce(
                (
                  sum,
                  value,
                ) =>
                  sum +
                  value,
                0,
              ) /
              accuracies.length
            : null;

        const qcRate =
          total > 0
            ? Math.round(
                (
                  validated /
                  total
                ) *
                  100,
              )
            : 0;

        const categories =
          new Set(
            history
              .map(
                (item) =>
                  item.address
                    .category,
              )
              .filter(Boolean),
          ).size;

        return {
          total,
          validated,
          pendingQc,
          averageAccuracy,
          qcRate,
          categories,
          pendingTasks:
            tasks.length,
          lastInstallation:
            history[0] ??
            null,
        };
      },
      [
        history,
        tasks,
      ],
    );


  async function logout() {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await supabase.auth
        .signOut();

      router.replace(
        "/agent/login",
      );

      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }


  return (
    <div
      className="
        flex min-h-[100dvh]
        flex-col bg-slate-50
      "
    >
      <header
        className="
          bg-gradient-to-r
          from-orange-500
          via-rose-500
          to-pink-600
          px-4 py-4
          text-white
          shadow-lg
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
                relative flex
                h-11 w-11
                shrink-0
                items-center
                justify-center
                rounded-xl
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
                  absolute
                  -bottom-0.5
                  -right-0.5
                  h-3 w-3
                  rounded-full
                  border-2
                  border-rose-500
                  bg-emerald-400
                "
              />
            </div>

            <div className="min-w-0">
              <p
                className="
                  truncate
                  text-[10px]
                  font-medium
                  uppercase
                  tracking-widest
                  text-white/75
                "
              >
                AGENT ·{" "}
                {agent
                  ?.badge_number ??
                  "—"}
              </p>

              <p
                className="
                  truncate
                  text-base
                  font-bold
                "
              >
                {agent
                  ?.full_name ??
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
              text-xs
              font-semibold
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
          px-3 py-5 pb-28
          sm:px-4
        "
      >
        {loading ? (
          <div
            className="
              flex min-h-[420px]
              items-center
              justify-center
            "
          >
            <div
              className="
                flex flex-col
                items-center gap-3
                text-sm
                text-slate-500
              "
            >
              <LoaderCircle
                className="
                  h-8 w-8
                  animate-spin
                  text-orange-500
                "
              />

              Chargement du profil…
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
                flex items-start
                gap-3
              "
            >
              <AlertTriangle
                className="
                  mt-0.5 h-5 w-5
                  shrink-0
                "
              />

              <div>
                <p className="font-semibold">
                  Profil indisponible
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
        agent ? (
          <div
            className="
              mx-auto w-full
              max-w-6xl
              space-y-5
            "
          >
            <div>
              <div
                className="
                  flex items-center
                  gap-2
                "
              >
                <CircleUserRound
                  className="
                    h-5 w-5
                    text-slate-700
                  "
                />

                <h1
                  className="
                    text-lg font-bold
                    text-slate-900
                  "
                >
                  Mon profil
                </h1>
              </div>

              <p
                className="
                  mt-1 text-sm
                  text-slate-500
                "
              >
                Compte, activité et
                performances terrain
              </p>
            </div>


            <section
              className="
                relative overflow-hidden
                rounded-3xl
                bg-gradient-to-br
                from-slate-950
                via-slate-900
                to-slate-800
                p-6 text-white
                shadow-xl
                sm:p-7
              "
            >
              <div
                className="
                  absolute
                  -right-16 -top-20
                  h-64 w-64
                  rounded-full
                  bg-orange-500/20
                  blur-3xl
                "
              />

              <div
                className="
                  absolute
                  -bottom-24 left-1/3
                  h-60 w-60
                  rounded-full
                  bg-pink-500/15
                  blur-3xl
                "
              />

              <div
                className="
                  relative flex
                  flex-col gap-6
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >
                <div
                  className="
                    flex items-center
                    gap-4
                  "
                >
                  <div
                    className="
                      flex h-20 w-20
                      shrink-0
                      items-center
                      justify-center
                      rounded-3xl
                      bg-gradient-to-br
                      from-orange-500
                      to-rose-500
                      text-2xl
                      font-bold
                      shadow-lg
                      ring-4
                      ring-white/10
                    "
                  >
                    {initials(
                      agent.full_name,
                    )}
                  </div>

                  <div>
                    <div
                      className="
                        mb-2
                        flex flex-wrap
                        items-center
                        gap-2
                      "
                    >
                      <span
                        className="
                          inline-flex
                          items-center gap-1
                          rounded-full
                          bg-emerald-500/15
                          px-2.5 py-1
                          text-[11px]
                          font-semibold
                          text-emerald-300
                          ring-1
                          ring-emerald-400/25
                        "
                      >
                        <ShieldCheck
                          className="h-3.5 w-3.5"
                        />

                        Agent actif
                      </span>

                      <span
                        className="
                          inline-flex
                          items-center gap-1
                          rounded-full
                          bg-white/10
                          px-2.5 py-1
                          text-[11px]
                          font-medium
                          text-white/80
                        "
                      >
                        <Radio
                          className="h-3.5 w-3.5"
                        />

                        Terrain
                      </span>
                    </div>

                    <h2
                      className="
                        text-2xl
                        font-bold
                        tracking-tight
                      "
                    >
                      {agent.full_name ??
                        "Agent Adresse GN"}
                    </h2>

                    <p
                      className="
                        mt-1 text-sm
                        text-white/60
                      "
                    >
                      Badge{" "}
                      <span
                        className="
                          font-semibold
                          text-white
                        "
                      >
                        {agent.badge_number ??
                          "—"}
                      </span>
                    </p>
                  </div>
                </div>


                <div
                  className="
                    grid grid-cols-2
                    gap-2
                    sm:min-w-[260px]
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/agent/tasks",
                      )
                    }
                    className="
                      rounded-2xl
                      bg-white/10
                      px-4 py-3
                      text-left
                      transition
                      hover:bg-white/15
                    "
                  >
                    <ListChecks
                      className="
                        h-5 w-5
                        text-orange-300
                      "
                    />

                    <p
                      className="
                        mt-2 text-xs
                        text-white/55
                      "
                    >
                      Mes tâches
                    </p>

                    <p
                      className="
                        text-lg
                        font-bold
                      "
                    >
                      {
                        stats.pendingTasks
                      }
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/agent/history",
                      )
                    }
                    className="
                      rounded-2xl
                      bg-white/10
                      px-4 py-3
                      text-left
                      transition
                      hover:bg-white/15
                    "
                  >
                    <History
                      className="
                        h-5 w-5
                        text-rose-300
                      "
                    />

                    <p
                      className="
                        mt-2 text-xs
                        text-white/55
                      "
                    >
                      Mes poses
                    </p>

                    <p
                      className="
                        text-lg
                        font-bold
                      "
                    >
                      {stats.total}
                    </p>
                  </button>
                </div>
              </div>
            </section>


            <section>
              <div
                className="
                  mb-3
                  flex items-center
                  justify-between
                "
              >
                <div>
                  <h2
                    className="
                      text-base font-bold
                      text-slate-900
                    "
                  >
                    Activité terrain
                  </h2>

                  <p
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    Synthèse de vos
                    interventions
                  </p>
                </div>

                <Activity
                  className="
                    h-5 w-5
                    text-slate-400
                  "
                />
              </div>

              <div
                className="
                  grid grid-cols-2
                  gap-3
                  lg:grid-cols-4
                "
              >
                <div
                  className="
                    rounded-2xl
                    border border-slate-200
                    bg-white p-4
                    shadow-sm
                  "
                >
                  <div
                    className="
                      flex h-10 w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-orange-50
                      text-orange-600
                    "
                  >
                    <Target
                      className="h-5 w-5"
                    />
                  </div>

                  <p
                    className="
                      mt-4 text-2xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {stats.total}
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    Poses réalisées
                  </p>
                </div>


                <div
                  className="
                    rounded-2xl
                    border border-slate-200
                    bg-white p-4
                    shadow-sm
                  "
                >
                  <div
                    className="
                      flex h-10 w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-emerald-50
                      text-emerald-600
                    "
                  >
                    <CheckCircle2
                      className="h-5 w-5"
                    />
                  </div>

                  <p
                    className="
                      mt-4 text-2xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {stats.validated}
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    Validées QC
                  </p>
                </div>


                <div
                  className="
                    rounded-2xl
                    border border-slate-200
                    bg-white p-4
                    shadow-sm
                  "
                >
                  <div
                    className="
                      flex h-10 w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-amber-50
                      text-amber-600
                    "
                  >
                    <Clock3
                      className="h-5 w-5"
                    />
                  </div>

                  <p
                    className="
                      mt-4 text-2xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {stats.pendingQc}
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    En attente QC
                  </p>
                </div>


                <div
                  className="
                    rounded-2xl
                    border border-slate-200
                    bg-white p-4
                    shadow-sm
                  "
                >
                  <div
                    className="
                      flex h-10 w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-blue-50
                      text-blue-600
                    "
                  >
                    <Gauge
                      className="h-5 w-5"
                    />
                  </div>

                  <p
                    className="
                      mt-4 text-2xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {stats.qcRate}%
                  </p>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    Taux validé QC
                  </p>
                </div>
              </div>
            </section>


            <div
              className="
                grid gap-4
                lg:grid-cols-2
              "
            >
              <section
                className="
                  overflow-hidden
                  rounded-2xl
                  border border-slate-200
                  bg-white
                  shadow-sm
                "
              >
                <div
                  className="
                    border-b
                    border-slate-100
                    px-5 py-4
                  "
                >
                  <h2
                    className="
                      font-bold
                      text-slate-900
                    "
                  >
                    Dernière intervention
                  </h2>

                  <p
                    className="
                      mt-0.5 text-xs
                      text-slate-500
                    "
                  >
                    Dernière pose enregistrée
                  </p>
                </div>

                {stats.lastInstallation ? (
                  <div className="p-5">
                    <div
                      className="
                        flex items-start
                        justify-between
                        gap-3
                      "
                    >
                      <div>
                        <p
                          className="
                            text-xs
                            font-semibold
                            uppercase
                            tracking-wide
                            text-orange-600
                          "
                        >
                          {formatAddressNumber(
                            stats
                              .lastInstallation
                              .beacon
                              .public_number,
                          )}
                        </p>

                        <p
                          className="
                            mt-1
                            font-bold
                            text-slate-900
                          "
                        >
                          {stats
                            .lastInstallation
                            .address
                            .name ??
                            stats
                              .lastInstallation
                              .site
                              .place_name ??
                            "Adresse sans nom"}
                        </p>
                      </div>

                      {stats
                        .lastInstallation
                        .validated_at ? (
                        <span
                          className="
                            rounded-full
                            bg-emerald-50
                            px-2.5 py-1
                            text-[11px]
                            font-semibold
                            text-emerald-700
                          "
                        >
                          Validée
                        </span>
                      ) : (
                        <span
                          className="
                            rounded-full
                            bg-amber-50
                            px-2.5 py-1
                            text-[11px]
                            font-semibold
                            text-amber-700
                          "
                        >
                          En attente QC
                        </span>
                      )}
                    </div>

                    <div
                      className="
                        mt-4 grid
                        grid-cols-2 gap-3
                      "
                    >
                      <div
                        className="
                          rounded-xl
                          bg-slate-50
                          p-3
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
                          Date
                        </p>

                        <p
                          className="
                            mt-1 text-xs
                            font-semibold
                            text-slate-700
                          "
                        >
                          {formatDate(
                            stats
                              .lastInstallation
                              .installed_at,
                          )}
                        </p>
                      </div>

                      <div
                        className="
                          rounded-xl
                          bg-slate-50
                          p-3
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
                          Précision
                        </p>

                        <p
                          className="
                            mt-1 text-xs
                            font-semibold
                            text-slate-700
                          "
                        >
                          {stats
                            .lastInstallation
                            .gps
                            .accuracy_m !==
                          null
                            ? `${formatDecimal(
                                stats
                                  .lastInstallation
                                  .gps
                                  .accuracy_m,
                              )} m`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/agent/history",
                        )
                      }
                      className="
                        mt-4 flex w-full
                        items-center
                        justify-between
                        rounded-xl
                        bg-slate-50
                        px-4 py-3
                        text-sm
                        font-semibold
                        text-slate-700
                        transition
                        hover:bg-slate-100
                      "
                    >
                      Voir tout l’historique

                      <ChevronRight
                        className="h-4 w-4"
                      />
                    </button>
                  </div>
                ) : (
                  <div
                    className="
                      p-8 text-center
                      text-sm
                      text-slate-500
                    "
                  >
                    Aucune intervention enregistrée.
                  </div>
                )}
              </section>


              <section
                className="
                  overflow-hidden
                  rounded-2xl
                  border border-slate-200
                  bg-white
                  shadow-sm
                "
              >
                <div
                  className="
                    border-b
                    border-slate-100
                    px-5 py-4
                  "
                >
                  <h2
                    className="
                      font-bold
                      text-slate-900
                    "
                  >
                    Indicateurs terrain
                  </h2>

                  <p
                    className="
                      mt-0.5 text-xs
                      text-slate-500
                    "
                  >
                    Qualité et activité
                  </p>
                </div>

                <div
                  className="
                    divide-y
                    divide-slate-100
                  "
                >
                  <div
                    className="
                      flex items-center
                      justify-between
                      gap-4 px-5 py-4
                    "
                  >
                    <div
                      className="
                        flex items-center
                        gap-3
                      "
                    >
                      <Navigation
                        className="
                          h-5 w-5
                          text-blue-500
                        "
                      />

                      <div>
                        <p
                          className="
                            text-sm
                            font-medium
                            text-slate-800
                          "
                        >
                          Précision GPS moyenne
                        </p>

                        <p
                          className="
                            text-xs
                            text-slate-500
                          "
                        >
                          Sur les poses disponibles
                        </p>
                      </div>
                    </div>

                    <span
                      className="
                        font-bold
                        text-slate-900
                      "
                    >
                      {stats.averageAccuracy !==
                      null
                        ? `${formatDecimal(
                            stats.averageAccuracy,
                          )} m`
                        : "—"}
                    </span>
                  </div>


                  <div
                    className="
                      flex items-center
                      justify-between
                      gap-4 px-5 py-4
                    "
                  >
                    <div
                      className="
                        flex items-center
                        gap-3
                      "
                    >
                      <ListChecks
                        className="
                          h-5 w-5
                          text-orange-500
                        "
                      />

                      <div>
                        <p
                          className="
                            text-sm
                            font-medium
                            text-slate-800
                          "
                        >
                          Tâches assignées
                        </p>

                        <p
                          className="
                            text-xs
                            text-slate-500
                          "
                        >
                          À traiter actuellement
                        </p>
                      </div>
                    </div>

                    <span
                      className="
                        font-bold
                        text-slate-900
                      "
                    >
                      {stats.pendingTasks}
                    </span>
                  </div>


                  <div
                    className="
                      flex items-center
                      justify-between
                      gap-4 px-5 py-4
                    "
                  >
                    <div
                      className="
                        flex items-center
                        gap-3
                      "
                    >
                      <Target
                        className="
                          h-5 w-5
                          text-rose-500
                        "
                      />

                      <div>
                        <p
                          className="
                            text-sm
                            font-medium
                            text-slate-800
                          "
                        >
                          Types de lieux
                        </p>

                        <p
                          className="
                            text-xs
                            text-slate-500
                          "
                        >
                          Catégories déjà installées
                        </p>
                      </div>
                    </div>

                    <span
                      className="
                        font-bold
                        text-slate-900
                      "
                    >
                      {stats.categories}
                    </span>
                  </div>
                </div>
              </section>
            </div>


            <section
              className="
                overflow-hidden
                rounded-2xl
                border border-slate-200
                bg-white
                shadow-sm
              "
            >
              <div
                className="
                  border-b
                  border-slate-100
                  px-5 py-4
                "
              >
                <h2
                  className="
                    font-bold
                    text-slate-900
                  "
                >
                  Compte & affectation
                </h2>

                <p
                  className="
                    mt-0.5 text-xs
                    text-slate-500
                  "
                >
                  Informations du compte terrain
                </p>
              </div>

              <div
                className="
                  grid
                  sm:grid-cols-2
                  lg:grid-cols-4
                "
              >
                <div
                  className="
                    border-b
                    border-slate-100
                    p-5
                    sm:border-r
                    lg:border-b-0
                  "
                >
                  <BadgeCheck
                    className="
                      h-5 w-5
                      text-orange-500
                    "
                  />

                  <p
                    className="
                      mt-3 text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-400
                    "
                  >
                    Badge
                  </p>

                  <p
                    className="
                      mt-1 font-semibold
                      text-slate-800
                    "
                  >
                    {agent.badge_number ??
                      "Non renseigné"}
                  </p>
                </div>


                <div
                  className="
                    border-b
                    border-slate-100
                    p-5
                    lg:border-b-0
                    lg:border-r
                  "
                >
                  <MapPin
                    className="
                      h-5 w-5
                      text-blue-500
                    "
                  />

                  <p
                    className="
                      mt-3 text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-400
                    "
                  >
                    Zone
                  </p>

                  <p
                    className="
                      mt-1 break-all
                      text-sm
                      font-semibold
                      text-slate-800
                    "
                  >
                    {agent.zone_id ??
                      "Non définie"}
                  </p>
                </div>


                <div
                  className="
                    border-b
                    border-slate-100
                    p-5
                    sm:border-r
                    lg:border-b-0
                  "
                >
                  <UserRound
                    className="
                      h-5 w-5
                      text-violet-500
                    "
                  />

                  <p
                    className="
                      mt-3 text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-400
                    "
                  >
                    Rôle
                  </p>

                  <p
                    className="
                      mt-1 font-semibold
                      text-slate-800
                    "
                  >
                    Agent terrain
                  </p>
                </div>


                <div className="p-5">
                  <ShieldCheck
                    className="
                      h-5 w-5
                      text-emerald-500
                    "
                  />

                  <p
                    className="
                      mt-3 text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-slate-400
                    "
                  >
                    État du compte
                  </p>

                  <p
                    className="
                      mt-1 font-semibold
                      text-emerald-700
                    "
                  >
                    Actif
                  </p>
                </div>
              </div>


              <div
                className="
                  border-t
                  border-slate-100
                  bg-slate-50/70
                  px-5 py-4
                "
              >
                <p
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-slate-400
                  "
                >
                  Identifiant technique
                </p>

                <p
                  className="
                    mt-1 break-all
                    font-mono
                    text-xs
                    text-slate-500
                  "
                >
                  {agent.user_id}
                </p>
              </div>
            </section>


            <section
              className="
                rounded-2xl
                border border-slate-200
                bg-white
                p-5 shadow-sm
              "
            >
              <div
                className="
                  flex items-start
                  gap-3
                "
              >
                <div
                  className="
                    flex h-10 w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-emerald-50
                    text-emerald-600
                  "
                >
                  <LockKeyhole
                    className="h-5 w-5"
                  />
                </div>

                <div className="flex-1">
                  <h2
                    className="
                      font-bold
                      text-slate-900
                    "
                  >
                    Sécurité & session
                  </h2>

                  <p
                    className="
                      mt-1 text-sm
                      text-slate-500
                    "
                  >
                    Votre session Agent est
                    authentifiée et votre compte
                    est actuellement actif.
                  </p>

                  <div
                    className="
                      mt-4 flex
                      items-center gap-2
                      text-xs
                    "
                  >
                    <span
                      className="
                        inline-flex
                        items-center gap-1.5
                        rounded-full
                        bg-emerald-50
                        px-2.5 py-1
                        font-semibold
                        text-emerald-700
                      "
                    >
                      <ShieldCheck
                        className="h-3.5 w-3.5"
                      />

                      Authentifié
                    </span>

                    <span
                      className="
                        inline-flex
                        items-center gap-1.5
                        rounded-full
                        bg-slate-100
                        px-2.5 py-1
                        font-medium
                        text-slate-600
                      "
                    >
                      {online ? (
                        <Wifi
                          className="h-3.5 w-3.5"
                        />
                      ) : (
                        <WifiOff
                          className="h-3.5 w-3.5"
                        />
                      )}

                      {online
                        ? "Connexion active"
                        : "Hors ligne"}
                    </span>
                  </div>
                </div>
              </div>
            </section>


            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                void logout();
              }}
              className="
                flex w-full
                items-center
                justify-center gap-2
                rounded-2xl
                border border-red-200
                bg-white
                px-4 py-4
                text-sm
                font-semibold
                text-red-600
                shadow-sm
                transition
                hover:bg-red-50
                disabled:opacity-50
              "
            >
              {loggingOut ? (
                <LoaderCircle
                  className="
                    h-4 w-4
                    animate-spin
                  "
                />
              ) : (
                <LogOut
                  className="h-4 w-4"
                />
              )}

              {loggingOut
                ? "Déconnexion…"
                : "Se déconnecter"}
            </button>
          </div>
        ) : null}
      </main>

      <AgentBottomNav
        active="profile"
      />
    </div>
  );
}