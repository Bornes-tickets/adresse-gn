"use client";

import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  HardHat,
  ListChecks,
  LoaderCircle,
  LogOut,
  MapPin,
  Package,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  toast,
} from "sonner";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

import {
  AgentApiError,
  type AgentIdentity,
  type AgentTask,
  getAgentMe,
  listAgentTasks,
} from "@/features/agent/api";

import { AgentBottomNav } from "@/features/agent/components/agent-bottom-nav";

import {
  cn,
} from "@/lib/utils";

import {
  getAccessToken,
  supabase,
} from "@/lib/supabase/browser";


function initials(
  name:
    | string
    | null
    | undefined,
) {
  if (!name) {
    return "AG";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(
      0,
      2,
    )
    .map(
      (part) =>
        part[0]
          ?.toUpperCase() ??
        "",
    )
    .join("");
}


function communeCode(
  number: string,
) {
  const normalized =
    number
      .trim()
      .toUpperCase();

  const match =
    normalized.match(
      /^([A-Z]{3}[0-9]{2})-/,
    );

  return (
    match?.[1] ??
    "?"
  );
}


function scheduleLabel(
  value: string | null,
) {
  if (!value) {
    return (
      "Date à planifier"
    );
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

  return date.toLocaleString(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


/*
 * AGENT_V1_DISPLAY_FORMAT
 *
 * DB/API canonical:
 *   CCCCC-NNNNNNNNC
 *
 * UI presentation:
 *   CCCCC-NNNNNNNN-C
 */
function formatAgentV1AddressNumber(
  value: string,
) {
  const normalized =
    value
      .trim()
      .toUpperCase();

  const match =
    normalized.match(
      /^([A-Z]{3}[0-9]{2})-([0-9]{8})([0-9])$/,
    );

  if (!match) {
    return normalized;
  }

  return (
    `${match[1]}-`
    + `${match[2]}-`
    + `${match[3]}`
  );
}


function taskStatusLabel(
  task: AgentTask,
) {
  if (
    task.status ===
      "planned" &&
    task.can_start_installation
  ) {
    return "Prête à poser";
  }

  if (
    task.status ===
    "assigned"
  ) {
    return "Assignée";
  }

  return "Planifiée";
}


export function AgentTasksPage() {
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
    query,
    setQuery,
  ] =
    useState("");

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


  const loadTasks =
    useCallback(
      async (
        signal?:
          AbortSignal,
        silent = false,
      ) => {
        if (!silent) {
          setLoading(
            true,
          );
        } else {
          setRefreshing(
            true,
          );
        }

        setError(
          null,
        );

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
            response,
          ] =
            await Promise.all([
              getAgentMe(
                token,
                signal,
              ),

              listAgentTasks(
                token,
                signal,
              ),
            ]);

          setAgent(
            me.agent,
          );

          setTasks(
            response.items,
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
              : (
                "Impossible de charger les tâches."
              ),
          );
        } finally {
          if (!silent) {
            setLoading(
              false,
            );
          }

          setRefreshing(
            false,
          );
        }
      },
      [
        router,
      ],
    );


  useEffect(() => {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        () => {
          void loadTasks(
            controller.signal,
          );
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );

      controller.abort();
    };
  }, [
    loadTasks,
  ]);


  const filtered =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        if (!needle) {
          return tasks;
        }

        return tasks.filter(
          (task) => {
            const values = [
              task.beacon
                .public_number,
              task.order
                .reference,
              task.plan
                .name,
              task.plan
                .code,
              task.site
                .place_name,
              task.site
                .address_line,
            ];

            return values.some(
              (value) =>
                String(
                  value ?? "",
                )
                  .toLowerCase()
                  .includes(
                    needle,
                  ),
            );
          },
        );
      },
      [
        query,
        tasks,
      ],
    );


  async function logout() {
    await supabase.auth
      .signOut();

    router.replace(
      "/agent/login",
    );

    router.refresh();
  }


  function openInstallation(
    task: AgentTask,
  ) {
    if (
      !task
        .can_start_installation
    ) {
      toast.info(
        "Installation non démarrable",
        {
          description:
            "Cette intervention doit d'abord être planifiée.",
        },
      );

      return;
    }

    router.push(
      `/agent/tasks/${encodeURIComponent(
        task.pending_installation_id,
      )}/install`,
    );
  }

  const total =
    tasks.length;


  return (
    <div
      className="
        flex min-h-[100dvh]
        flex-col
        bg-gradient-to-br
        from-slate-50 via-white
        to-orange-50/30
      "
    >
      <header
        className="
          relative overflow-hidden
          bg-gradient-to-br
          from-orange-500
          via-rose-500
          to-pink-600
          text-white
          shadow-lg
        "
        style={{
          paddingTop:
            "env(safe-area-inset-top)",
        }}
      >
        <div
          className="
            absolute inset-0
            bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_60%)]
          "
        />

        <div
          className="
            relative px-4 py-4
          "
        >
          <div
            className="
              flex items-center
              justify-between gap-3
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
                  relative shrink-0
                "
              >
                <div
                  className="
                    flex h-11 w-11
                    items-center
                    justify-center
                    rounded-xl
                    bg-white/20
                    font-bold text-white
                    shadow-md
                    ring-2 ring-white/30
                    backdrop-blur
                  "
                >
                  {initials(
                    agent
                      ?.full_name,
                  )}
                </div>

                <span
                  className={cn(
                    `
                      absolute
                      -bottom-0.5
                      -right-0.5
                      h-3.5 w-3.5
                      rounded-full
                      border-2
                      border-white
                    `,
                    online
                      ? "bg-emerald-400"
                      : "bg-slate-400",
                  )}
                />
              </div>

              <div
                className="
                  min-w-0
                "
              >
                <div
                  className="
                    text-[10px]
                    font-medium
                    uppercase
                    tracking-widest
                    text-white/70
                  "
                >
                  Agent ·{" "}
                  {agent
                    ?.badge_number ??
                    "—"}
                </div>

                <div
                  className="
                    truncate
                    text-base
                    font-bold
                  "
                >
                  {agent
                    ?.full_name ??
                    "Agent"}
                </div>
              </div>
            </div>

            <div
              className="
                flex items-center
                gap-2
              "
            >
              <div
                className={cn(
                  `
                    inline-flex
                    items-center gap-1.5
                    rounded-full
                    px-2.5 py-1
                    text-xs
                    font-semibold
                    shadow-md
                    backdrop-blur
                  `,
                  online
                    ? "bg-emerald-500/80"
                    : "bg-slate-800/60",
                )}
              >
                {online ? (
                  <Wifi
                    className="h-3 w-3"
                  />
                ) : (
                  <WifiOff
                    className="h-3 w-3"
                  />
                )}

                {online
                  ? "En ligne"
                  : "Hors ligne"}
              </div>

              <button
                type="button"
                onClick={() =>
                  void logout()
                }
                aria-label="Se déconnecter"
                className="
                  hidden flex h-9 w-9
                  items-center
                  justify-center
                  rounded-full
                  bg-white/15
                  backdrop-blur
                  transition
                  hover:bg-white/25
                "
              >
                <LogOut
                  className="h-4 w-4"
                />
              </button>
            </div>
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
            <h1
              className="
                flex items-center
                gap-2
                text-2xl
                font-bold
                text-slate-900
              "
            >
              <ListChecks
                className="
                  h-6 w-6
                  text-orange-600
                "
              />

              Mes tâches
            </h1>

            <p
              className="
                mt-0.5 text-sm
                text-slate-500
              "
            >
              {total > 0
                ? `${total} intervention${
                    total > 1
                      ? "s"
                      : ""
                  } assignée${
                    total > 1
                      ? "s"
                      : ""
                  }`
                : "Aucune tâche assignée"}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              refreshing ||
              loading ||
              !online
            }
            onClick={() =>
              void loadTasks(
                undefined,
                true,
              )
            }
            className="
              h-11 min-h-11
              rounded-full
              bg-white
              shadow-sm
            "
            aria-label="Actualiser"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                refreshing &&
                  "animate-spin",
              )}
            />
          </Button>
        </div>


        {total > 0 && (
          <Card
            className="
              border-orange-200
              bg-gradient-to-br
              from-orange-50
              via-white
              to-rose-50
            "
          >
            <CardContent
              className="p-4"
            >
              <div
                className="
                  flex items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex h-12 w-12
                    items-center
                    justify-center
                    rounded-xl
                    bg-gradient-to-br
                    from-orange-500
                    to-rose-600
                    text-white
                    shadow-md
                  "
                >
                  <Target
                    className="h-6 w-6"
                  />
                </div>

                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <div
                    className="
                      flex items-baseline
                      gap-1
                    "
                  >
                    <span
                      className="
                        text-3xl
                        font-bold
                        text-slate-900
                      "
                    >
                      {total}
                    </span>

                    <span
                      className="
                        text-sm
                        text-slate-500
                      "
                    >
                      tâche
                      {total > 1
                        ? "s"
                        : ""}
                    </span>
                  </div>

                  <div
                    className="
                      mt-0.5 text-xs
                      text-slate-600
                    "
                  >
                    Objectif de la tournée
                  </div>
                </div>

                <div
                  className="
                    inline-flex
                    items-center gap-1
                    rounded-full
                    bg-orange-100
                    px-2 py-0.5
                    text-xs
                    font-semibold
                    text-orange-700
                  "
                >
                  <Sparkles
                    className="h-3 w-3"
                  />

                  En cours
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {!online && (
          <div
            className="
              flex items-start
              gap-2
              rounded-xl
              border border-amber-200
              bg-amber-50
              px-3 py-3
              text-sm
              text-amber-800
            "
          >
            <WifiOff
              className="
                mt-0.5
                h-4 w-4
                shrink-0
              "
            />

            Le chargement des tâches
            nécessite actuellement une
            connexion réseau.
          </div>
        )}


        {error && (
          <div
            className="
              flex items-start
              gap-2
              rounded-xl
              border border-rose-200
              bg-rose-50
              px-3 py-3
              text-sm
              text-rose-800
            "
          >
            <AlertTriangle
              className="
                mt-0.5
                h-4 w-4
                shrink-0
              "
            />

            <div
              className="flex-1"
            >
              <div
                className="font-semibold"
              >
                Chargement impossible
              </div>

              <div
                className="mt-0.5"
              >
                {error}
              </div>
            </div>
          </div>
        )}


        {total > 5 && (
          <div
            className="relative"
          >
            <Search
              className="
                absolute left-3
                top-1/2 h-4 w-4
                -translate-y-1/2
                text-slate-400
              "
            />

            <Input
              value={query}
              onChange={(
                event,
              ) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder={
                "Rechercher une tâche…"
              }
              className="
                h-11 rounded-xl
                border-slate-200
                bg-white pl-9
                shadow-sm
              "
            />
          </div>
        )}


        {loading && (
          <div
            className="
              space-y-3
            "
          >
            {[1, 2, 3].map(
              (item) => (
                <div
                  key={item}
                  className="
                    h-28 w-full
                    animate-pulse
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                  "
                />
              ),
            )}

            <div
              className="
                flex items-center
                justify-center gap-2
                py-2 text-xs
                text-slate-400
              "
            >
              <LoaderCircle
                className="
                  h-4 w-4
                  animate-spin
                "
              />

              Chargement des tâches…
            </div>
          </div>
        )}


        {!loading &&
          !error &&
          total === 0 && (
          <Card
            className="
              border-2
              border-dashed
              border-slate-200
              bg-white
            "
          >
            <CardContent
              className="
                flex min-h-[230px]
                w-full flex-col
                items-center justify-center
                py-12 text-center
                sm:min-h-[235px]
                "
            >
              <div
                className="
                  mx-auto mb-4
                  flex h-16 w-16
                  items-center
                  justify-center
                  rounded-full
                  bg-gradient-to-br
                  from-orange-100
                  to-rose-100
                "
              >
                <Package
                  className="
                    h-8 w-8
                    text-orange-600
                  "
                />
              </div>

              <p
                className="
                  text-base
                  font-semibold
                  text-slate-900
                "
              >
                Aucune balise assignée
              </p>

              <p
                className="
                  mx-auto mt-2
                  max-w-xs
                  text-sm
                  text-slate-500
                "
              >
                Vos balises à installer
                apparaîtront ici dès qu&apos;un
                lot vous sera attribué.
              </p>
            </CardContent>
          </Card>
        )}


        {!loading &&
          total > 0 &&
          filtered.length === 0 && (
          <Card>
            <CardContent
              className="
                py-8 text-center
                text-sm
                text-slate-500
              "
            >
              Aucune tâche ne correspond
              à « {query} ».
            </CardContent>
          </Card>
        )}


        {!loading && (
          <ul
            className="space-y-3"
          >
            {filtered.map(
              (task) => {
                const commune =
                  communeCode(
                    task.beacon
                      .public_number,
                  );

                const ready =
                  task
                    .can_start_installation;

                return (
                  <li
                    key={
                      task
                        .pending_installation_id
                    }
                  >
                    <Card
                      className="
                        overflow-hidden
                        border-slate-200
                        bg-white
                        transition
                        hover:shadow-md
                      "
                    >
                      <div
                        className="flex"
                      >
                        <div
                          className="
                            w-1.5 shrink-0
                            bg-gradient-to-b
                            from-orange-500
                            to-rose-600
                          "
                        />

                        <div
                          className="
                            min-w-0
                            flex-1 p-4
                          "
                        >
                          <div
                            className="
                              flex items-start
                              justify-between
                              gap-3
                            "
                          >
                            <div
                              className="
                                min-w-0
                                flex-1
                              "
                            >
                              <div
                                className="
                                  mb-2 flex
                                  items-center gap-2
                                "
                              >
                                <div
                                  className="
                                    flex h-9 w-9
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-lg
                                    bg-gradient-to-br
                                    from-orange-500
                                    to-rose-600
                                    text-white
                                    shadow-sm
                                  "
                                >
                                  <Radio
                                    className="
                                      h-4 w-4
                                    "
                                  />
                                </div>

                                <div
                                  className="
                                    min-w-0
                                  "
                                >
                                  <div
                                    className="
                                      truncate
                                      font-mono
                                      text-base
                                      font-bold
                                      tracking-tight
                                      text-slate-900
                                    "
                                  >
                                    {formatAgentV1AddressNumber(task.beacon.public_number)}
                                  </div>

                                  <div
                                    className="
                                      text-[10px]
                                      font-semibold
                                      uppercase
                                      tracking-widest
                                      text-slate-400
                                    "
                                  >
                                    Commune {commune}
                                  </div>
                                </div>
                              </div>

                              <div
                                className="
                                  flex flex-wrap
                                  items-center
                                  gap-1.5
                                "
                              >
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    `
                                      border-0
                                      text-[10px]
                                      font-semibold
                                    `,
                                    ready
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-sky-100 text-sky-700",
                                  )}
                                >
                                  {
                                    taskStatusLabel(
                                      task,
                                    )
                                  }
                                </Badge>

                                <Badge
                                  variant="outline"
                                  className="
                                    border-violet-200
                                    bg-violet-50
                                    text-[10px]
                                    text-violet-700
                                  "
                                >
                                  {
                                    task
                                      .plan
                                      .name
                                  }
                                </Badge>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                openInstallation(
                                  task,
                                )
                              }
                              className={cn(
                                `
                                  flex shrink-0
                                  items-center gap-1.5
                                  rounded-xl
                                  px-3 py-2.5
                                  text-sm
                                  font-semibold
                                  text-white
                                  shadow-md
                                  transition
                                `,
                                ready
                                  ? "bg-gradient-to-br from-orange-500 to-rose-600 active:scale-[0.98]"
                                  : "bg-slate-400",
                              )}
                            >
                              <Wrench
                                className="
                                  h-4 w-4
                                "
                              />

                              <span>
                                {ready
                                  ? "Poser"
                                  : "Attente"}
                              </span>

                              <ChevronRight
                                className="
                                  h-4 w-4
                                "
                              />
                            </button>
                          </div>

                          <div
                            className="
                              mt-3 grid
                              gap-2
                              border-t
                              border-slate-100
                              pt-3
                              text-xs
                              text-slate-600
                            "
                          >
                            <div
                              className="
                                flex items-start
                                gap-2
                              "
                            >
                              <CalendarClock
                                className="
                                  mt-0.5
                                  h-3.5 w-3.5
                                  shrink-0
                                  text-slate-400
                                "
                              />

                              <span>
                                {scheduleLabel(
                                  task
                                    .scheduled_at,
                                )}
                              </span>
                            </div>

                            {(
                              task.site
                                .place_name ||
                              task.site
                                .address_line
                            ) && (
                              <div
                                className="
                                  flex items-start
                                  gap-2
                                "
                              >
                                <MapPin
                                  className="
                                    mt-0.5
                                    h-3.5 w-3.5
                                    shrink-0
                                    text-slate-400
                                  "
                                />

                                <span>
                                  {[
                                    task.site
                                      .place_name,
                                    task.site
                                      .address_line,
                                  ]
                                    .filter(
                                      Boolean,
                                    )
                                    .join(
                                      " · ",
                                    )}
                                </span>
                              </div>
                            )}

                            <div
                              className="
                                text-[10px]
                                uppercase
                                tracking-wide
                                text-slate-400
                              "
                            >
                              Commande{" "}
                              {
                                task.order
                                  .reference
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              },
            )}
          </ul>
        )}


        <div
          className="
            hidden pt-3 text-center
            text-[10px]
            text-slate-400
          "
        >
          <HardHat
            className="
              mr-1 inline
              h-3 w-3
            "
          />
          Adresse GN · Espace agent
        </div>
        <AgentBottomNav active="tasks" />
      </main>
    </div>
  );
}
