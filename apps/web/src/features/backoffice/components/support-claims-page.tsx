"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Headphones,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessageSquareWarning,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  cn,
} from "@/lib/utils";

import {
  BackofficeApiError,
  type BackofficeClaim,
  type BackofficeIdentity,
  type ClaimStatus,
  decideBackofficeClaim,
  getBackofficeMe,
  listBackofficeClaims,
} from "../api";


type DecisionState = {
  id: string;
  d:
    | "approved"
    | "rejected";
} | null;


const STATUTS = [
  {
    v: "pending" as const,
    l: "En attente",
    cls:
      "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  {
    v: "approved" as const,
    l: "Approuvées",
    cls:
      "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  {
    v: "rejected" as const,
    l: "Rejetées",
    cls:
      "bg-rose-100 text-rose-700",
    icon: XCircle,
  },
];


const GROUPS = [
  {
    label: "Pilotage",
    items: [
      {
        href: "/support",
        label:
          "Tableau de bord",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Tickets",
    items: [
      {
        href:
          "/support/signalements",
        label:
          "Signalements citoyens",
        icon: AlertTriangle,
      },
      {
        href:
          "/support/reclamations",
        label:
          "Réclamations",
        icon:
          MessageSquareWarning,
      },
      {
        href:
          "/support/messages",
        label:
          "Messages entrants",
        icon: MessageCircle,
      },
    ],
  },
];


function formatDateTimeFr(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

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
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}


function initiales(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "SP";
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]
          ?.toUpperCase() ??
        "",
    )
    .join("");
}


function csvCell(
  value: unknown,
) {
  const text =
    value == null
      ? ""
      : String(value);

  if (
    /[",\r\n]/.test(text)
  ) {
    return `"${text.replace(
      /"/g,
      '""',
    )}"`;
  }

  return text;
}


export function SupportClaimsPage() {
  const router =
    useRouter();

  const [
    identity,
    setIdentity,
  ] = useState<
    BackofficeIdentity | null
  >(null);

  const [
    accessToken,
    setAccessToken,
  ] = useState<string | null>(
    null,
  );

  const [
    filter,
    setFilter,
  ] = useState<
    ClaimStatus | null
  >("pending");

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    claims,
    setClaims,
  ] = useState<
    BackofficeClaim[]
  >([]);

  const [
    counts,
    setCounts,
  ] = useState<
    Record<ClaimStatus, number>
  >({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [
    loadingIdentity,
    setLoadingIdentity,
  ] = useState(true);

  const [
    loadingClaims,
    setLoadingClaims,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState<
    string | null
  >(null);

  const [
    decision,
    setDecision,
  ] = useState<
    DecisionState
  >(null);

  const [
    note,
    setNote,
  ] = useState("");

  const [
    deciding,
    setDeciding,
  ] = useState(false);


  useEffect(() => {
    const controller =
      new AbortController();

    async function bootstrap() {
      try {
        const token =
          await getAccessToken();

        if (!token) {
          router.replace(
            "/login?returnTo=%2Fsupport%2Freclamations",
          );

          return;
        }

        const me =
          await getBackofficeMe(
            token,
            controller.signal,
          );

        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setAccessToken(
          token,
        );

        setIdentity(
          me.user,
        );

      } catch (error) {
        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : (
                "Accès au support "
                + "impossible."
              );

        toast.error(
          message,
        );

        router.replace(
          "/login?returnTo=%2Fsupport%2Freclamations",
        );

      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingIdentity(
            false,
          );
        }
      }
    }

    void bootstrap();

    return () => {
      controller.abort();
    };
  }, [router]);


  const refreshClaims =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        if (!accessToken) {
          return;
        }

        setLoadingClaims(
          true,
        );

        setLoadError(
          null,
        );

        try {
          const data =
            await listBackofficeClaims(
              accessToken,
              filter,
              signal,
            );

          if (signal?.aborted) {
            return;
          }

          setClaims(
            data.items,
          );

          setCounts(
            data.counts,
          );

        } catch (error) {
          if (signal?.aborted) {
            return;
          }

          if (
            error instanceof
              BackofficeApiError
            && (
              error.statusCode ===
                401
              ||
              error.statusCode ===
                403
            )
          ) {
            toast.error(
              error.message,
            );

            router.replace(
              "/login?returnTo=%2Fsupport%2Freclamations",
            );

            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : (
                  "Impossible de "
                  + "charger les "
                  + "réclamations."
                );

          setLoadError(
            message,
          );

          toast.error(
            message,
          );

        } finally {
          if (!signal?.aborted) {
            setLoadingClaims(
              false,
            );
          }
        }
      },
      [
        accessToken,
        filter,
        router,
      ],
    );


  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const controller =
      new AbortController();

    void refreshClaims(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [
    accessToken,
    filter,
    refreshClaims,
  ]);


  const filtered =
    useMemo(() => {
      const search =
        query
          .trim()
          .toLowerCase();

      if (!search) {
        return claims;
      }

      return claims.filter(
        (claim) => {
          return [
            claim.requester_name,
            claim.requester_email,
            claim.requester_phone,
            claim.beacon_number,
            claim.reason,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    search,
                  ),
            );
        },
      );
    }, [
      claims,
      query,
    ]);


  async function handleRefresh() {
    await refreshClaims();

    toast.success(
      "Actualisé.",
    );
  }


  function exportCsv() {
    if (
      filtered.length === 0
    ) {
      return;
    }

    const header = [
      "demandeur",
      "email",
      "telephone",
      "adresse",
      "motif",
      "statut",
      "cree",
    ].join(",");

    const lines =
      filtered.map(
        (claim) =>
          [
            claim.requester_name,
            claim.requester_email,
            claim.requester_phone,
            claim.beacon_number,
            claim.reason,
            claim.status,
            claim.created_at,
          ]
            .map(csvCell)
            .join(","),
      );

    const csv =
      [
        header,
        ...lines,
      ].join("\n");

    const blob =
      new Blob(
        [csv],
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

    anchor.href = url;

    anchor.download =
      `reclamations_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(
      anchor,
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url,
    );
  }


  async function confirmDecision() {
    if (
      !decision
      || !accessToken
    ) {
      return;
    }

    setDeciding(
      true,
    );

    try {
      await decideBackofficeClaim(
        accessToken,
        decision.id,
        {
          decision:
            decision.d,
          note:
            note.trim()
              || null,
        },
      );

      toast.success(
        "Décision enregistrée.",
      );

      setDecision(
        null,
      );

      setNote("");

      await refreshClaims();

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : (
              "La décision n'a "
              + "pas pu être "
              + "enregistrée."
            );

      toast.error(
        message,
      );

    } finally {
      setDeciding(
        false,
      );
    }
  }


  if (loadingIdentity) {
    return (
      <div className="
        flex min-h-screen
        items-center justify-center
        bg-gradient-to-br
        from-slate-50 via-white
        to-sky-50/40
      ">
        <div
          className="
            h-9 w-9
            animate-spin
            rounded-full
            border-2
            border-slate-300
            border-t-sky-600
          "
          aria-label="Chargement"
        />
      </div>
    );
  }


  if (!identity) {
    return null;
  }


  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br
        from-slate-50 via-white
        to-sky-50/40
      "
    >
      <aside
        className="
          fixed inset-y-0 left-0
          z-30 w-72
          border-r
          border-slate-200/80
          bg-white/70
          backdrop-blur-xl
          shadow-sm
        "
      >
        <div
          className="
            flex h-20 items-center
            gap-3 border-b
            border-slate-200/60
            px-6
          "
        >
          <div className="relative shrink-0">
            <div
              className="
                flex h-11 w-11
                items-center justify-center
                rounded-xl
                bg-gradient-to-br
                from-sky-500
                via-blue-600
                to-indigo-600
                shadow-lg
                shadow-sky-500/30
                transition-transform
                hover:scale-110
                hover:rotate-3
              "
            >
              <Headphones
                className="
                  h-6 w-6
                  text-white
                "
              />
            </div>

            <span
              className="
                absolute
                -bottom-1 -right-1
                h-4 w-4
                animate-pulse
                rounded-full
                border-2
                border-white
                bg-emerald-500
              "
            />
          </div>

          <div>
            <div
              className="
                text-[15px]
                font-bold
                tracking-tight
              "
            >
              Adresse GN
            </div>

            <div
              className="
                text-[11px]
                font-medium
                uppercase
                tracking-wider
                text-sky-600
              "
            >
              Espace support
            </div>
          </div>
        </div>

        <nav
          className="
            h-[calc(100vh-20rem)]
            space-y-5
            overflow-y-auto
            px-3 py-5
          "
        >
          {GROUPS.map(
            (group) => (
              <div
                key={
                  group.label
                }
              >
                <div
                  className="
                    mb-2 px-3
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-widest
                    text-slate-400
                  "
                >
                  {group.label}
                </div>

                <div
                  className="
                    space-y-0.5
                  "
                >
                  {group.items.map(
                    (item) => {
                      const active =
                        item.href ===
                        "/support/reclamations";

                      const Icon =
                        item.icon;

                      return (
                        <Link
                          key={
                            item.href
                          }
                          href={
                            item.href
                          }
                          prefetch={
                            false
                          }
                          className={cn(
                            `
                              group
                              relative
                              flex
                              items-center
                              gap-3
                              rounded-lg
                              px-3 py-2.5
                              text-sm
                              transition-all
                            `,
                            active
                              ? `
                                bg-gradient-to-r
                                from-sky-50
                                to-blue-50
                                font-semibold
                                text-sky-700
                                shadow-sm
                              `
                              : `
                                text-slate-600
                                hover:bg-slate-50
                                hover:text-slate-900
                              `,
                          )}
                        >
                          {active && (
                            <span
                              className="
                                absolute
                                left-0
                                top-1/2
                                h-6 w-1
                                -translate-y-1/2
                                rounded-r-full
                                bg-gradient-to-b
                                from-sky-500
                                to-blue-600
                              "
                            />
                          )}

                          <Icon
                            className={cn(
                              `
                                h-[18px]
                                w-[18px]
                                shrink-0
                              `,
                              active
                                ? `
                                  text-sky-600
                                `
                                : `
                                  text-slate-400
                                  group-hover:
                                  text-slate-600
                                  group-hover:
                                  scale-110
                                `,
                            )}
                          />

                          <span
                            className="
                              flex-1
                            "
                          >
                            {item.label}
                          </span>

                          {active && (
                            <ChevronRight
                              className="
                                h-3.5 w-3.5
                                text-sky-500
                              "
                            />
                          )}
                        </Link>
                      );
                    },
                  )}
                </div>
              </div>
            ),
          )}
        </nav>

        <div
          className="
            absolute
            bottom-0 left-0 right-0
            border-t
            border-slate-200/60
            bg-white/60
            p-3
            backdrop-blur-xl
          "
        >
          <div
            className="
              flex items-center
              gap-3 rounded-xl
              border
              border-slate-200/60
              bg-gradient-to-r
              from-slate-50
              to-slate-100/60
              p-3
            "
          >
            <div
              className="
                flex h-10 w-10
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-gradient-to-br
                from-sky-500
                to-blue-600
                text-sm
                font-bold
                text-white
                shadow-md
              "
            >
              {initiales(
                identity.full_name,
              )}
            </div>

            <div
              className="
                min-w-0 flex-1
              "
            >
              <div
                className="
                  truncate
                  text-[13px]
                  font-semibold
                "
              >
                {
                  identity
                    .full_name
                  ?? "Chargement…"
                }
              </div>

              <div
                className="
                  text-[11px]
                  text-slate-500
                "
              >
                Support
              </div>
            </div>

            <Link
              href="/"
              className="
                rounded-lg
                p-1.5
                text-slate-400
                transition
                hover:bg-slate-200/60
                hover:text-slate-700
              "
            >
              <LogOut
                className="
                  h-4 w-4
                "
              />
            </Link>
          </div>

          <div
            className="
              mt-2 text-center
              text-[10px]
              text-slate-400
            "
          >
            Adresse GN · Support
          </div>
        </div>
      </aside>

      <div className="ml-72">
        <header
          className="
            sticky top-0 z-20
            border-b
            border-slate-200/60
            bg-white/70
            backdrop-blur-xl
          "
        >
          <div
            className="
              flex h-16
              items-center
              justify-between
              gap-4 px-8
            "
          >
            <nav
              className="
                flex min-w-0
                items-center
                gap-1.5
                text-sm
              "
            >
              <Link
                href="/support"
                prefetch={false}
                className="
                  rounded p-1
                  text-slate-400
                  hover:bg-slate-100
                "
              >
                <Home
                  className="
                    h-3.5 w-3.5
                  "
                />
              </Link>

              <ChevronRight
                className="
                  h-3.5 w-3.5
                  text-slate-300
                "
              />

              <span
                className="
                  truncate
                  font-semibold
                "
              >
                Réclamations
              </span>
            </nav>

            <div
              className="
                hidden
                items-center gap-2
                rounded-full
                bg-gradient-to-r
                from-sky-500
                to-blue-600
                px-3 py-1.5
                text-xs
                font-medium
                text-white
                shadow-sm
                sm:flex
              "
            >
              <Headphones
                className="
                  h-3.5 w-3.5
                "
              />

              Espace support
            </div>
          </div>
        </header>

        <main
          className="
            mx-auto
            max-w-[1600px]
            p-8
          "
        >
          <div className="space-y-6">
            <div
              className="
                relative
                overflow-hidden
                rounded-2xl
                bg-gradient-to-br
                from-sky-500
                via-blue-600
                to-indigo-600
                p-6
                text-white
                shadow-xl
              "
            >
              <div
                className="
                  absolute inset-0
                  bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]
                "
              />

              <div
                className="
                  relative
                  flex flex-wrap
                  items-center
                  justify-between
                  gap-4
                "
              >
                <div>
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                      text-xs
                      uppercase
                      tracking-widest
                      text-white/70
                    "
                  >
                    <MessageSquareWarning
                      className="
                        h-3.5 w-3.5
                      "
                    />

                    Tickets
                  </div>

                  <h1
                    className="
                      mt-1
                      text-3xl
                      font-bold
                    "
                  >
                    Réclamations d&apos;adresses
                  </h1>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-white/80
                    "
                  >
                    Statuer sur les demandes de réattribution d&apos;adresse.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="
                      border-white/20
                      bg-white/15
                      text-white
                      hover:bg-white/25
                    "
                    onClick={
                      handleRefresh
                    }
                    disabled={
                      loadingClaims
                    }
                  >
                    <RefreshCw
                      className={cn(
                        "mr-1.5 h-4 w-4",
                        loadingClaims
                          ? "animate-spin"
                          : "",
                      )}
                    />

                    Rafraîchir
                  </Button>

                  {filtered.length > 0 && (
                    <Button
                      variant="secondary"
                      className="
                        bg-white
                        text-sky-700
                      "
                      onClick={
                        exportCsv
                      }
                    >
                      <Download
                        className="
                          mr-1.5
                          h-4 w-4
                        "
                      />

                      Export
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div
              className="
                grid
                grid-cols-3
                gap-3
              "
            >
              {STATUTS.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <button
                      key={item.v}
                      type="button"
                      onClick={() =>
                        setFilter(
                          filter ===
                            item.v
                            ? null
                            : item.v,
                        )
                      }
                      className={cn(
                        `
                          rounded-xl
                          border
                          bg-white
                          p-4
                          text-left
                          transition
                          hover:shadow-md
                        `,
                        filter ===
                          item.v
                          ? `
                            border-sky-600
                            ring-2
                            ring-sky-200
                          `
                          : `
                            border-slate-200
                          `,
                      )}
                    >
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                        "
                      >
                        <div>
                          <div
                            className="
                              text-[10px]
                              font-semibold
                              uppercase
                              tracking-widest
                              text-slate-500
                            "
                          >
                            {item.l}
                          </div>

                          <div
                            className="
                              mt-1
                              text-2xl
                              font-bold
                            "
                          >
                            {
                              counts[
                                item.v
                              ] ?? 0
                            }
                          </div>
                        </div>

                        <div
                          className={cn(
                            `
                              flex h-8 w-8
                              items-center
                              justify-center
                              rounded-lg
                            `,
                            item.cls,
                          )}
                        >
                          <Icon
                            className="
                              h-4 w-4
                            "
                          />
                        </div>
                      </div>
                    </button>
                  );
                },
              )}
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search
                    className="
                      absolute
                      left-3
                      top-1/2
                      h-4 w-4
                      -translate-y-1/2
                      text-slate-400
                    "
                  />

                  <Input
                    placeholder="Demandeur, balise, motif…"
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event
                          .target
                          .value,
                      )
                    }
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              {loadingClaims ? (
                <div
                  className="
                    p-16
                    text-center
                  "
                >
                  <div
                    className="
                      inline-block
                      h-8 w-8
                      animate-spin
                      rounded-full
                      border-2
                      border-slate-300
                      border-t-sky-600
                    "
                  />
                </div>
              ) : loadError ? (
                <div
                  className="
                    p-16
                    text-center
                    text-rose-600
                  "
                >
                  {loadError}
                </div>
              ) : filtered.length === 0 ? (
                <div
                  className="
                    p-16
                    text-center
                    text-slate-500
                  "
                >
                  Aucune réclamation.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="
                      w-full
                      text-sm
                    "
                  >
                    <thead
                      className="
                        border-b
                        bg-slate-50
                        text-[11px]
                        uppercase
                        tracking-wider
                        text-slate-600
                      "
                    >
                      <tr>
                        <th
                          className="
                            p-3
                            text-left
                            font-semibold
                          "
                        >
                          Demandeur
                        </th>

                        <th
                          className="
                            p-3
                            text-left
                            font-semibold
                          "
                        >
                          Adresse
                        </th>

                        <th
                          className="
                            p-3
                            text-left
                            font-semibold
                          "
                        >
                          Motif
                        </th>

                        <th
                          className="
                            p-3
                            text-left
                            font-semibold
                          "
                        >
                          Date
                        </th>

                        <th
                          className="
                            p-3
                            text-left
                            font-semibold
                          "
                        >
                          Statut
                        </th>

                        <th
                          className="
                            p-3
                            text-right
                            font-semibold
                          "
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map(
                        (claim) => {
                          const current =
                            STATUTS.find(
                              (item) =>
                                item.v ===
                                claim.status,
                            );

                          const StatusIcon =
                            current
                              ?.icon
                            ?? Clock;

                          return (
                            <tr
                              key={
                                claim.id
                              }
                              className="
                                group
                                border-t
                                border-slate-100
                                transition
                                hover:bg-sky-50/30
                              "
                            >
                              <td className="p-3">
                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-2
                                  "
                                >
                                  <div
                                    className="
                                      flex
                                      h-8 w-8
                                      items-center
                                      justify-center
                                      rounded-full
                                      bg-gradient-to-br
                                      from-sky-500
                                      to-blue-600
                                      text-xs
                                      font-bold
                                      text-white
                                    "
                                  >
                                    {initiales(
                                      claim
                                        .requester_name,
                                    )}
                                  </div>

                                  <div
                                    className="
                                      min-w-0
                                    "
                                  >
                                    <div
                                      className="
                                        truncate
                                        text-sm
                                        font-medium
                                      "
                                    >
                                      {
                                        claim
                                          .requester_name
                                        ??
                                        claim
                                          .requester_email
                                        ??
                                        "—"
                                      }
                                    </div>

                                    {claim.requester_phone && (
                                      <div
                                        className="
                                          text-[10px]
                                          text-slate-500
                                        "
                                      >
                                        {
                                          claim
                                            .requester_phone
                                        }
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td
                                className="
                                  p-3
                                  font-mono
                                  text-xs
                                "
                              >
                                {
                                  claim
                                    .beacon_number
                                  ?? "—"
                                }
                              </td>

                              <td
                                className="
                                  max-w-sm
                                  truncate
                                  p-3
                                  text-xs
                                  text-slate-600
                                "
                              >
                                {
                                  claim.reason
                                  ?? "—"
                                }
                              </td>

                              <td
                                className="
                                  p-3
                                  text-xs
                                  text-slate-500
                                "
                              >
                                {formatDateTimeFr(
                                  claim.created_at,
                                )}
                              </td>

                              <td className="p-3">
                                <Badge
                                  className={cn(
                                    "gap-1",
                                    current
                                      ?.cls,
                                  )}
                                >
                                  <StatusIcon
                                    className="
                                      h-3 w-3
                                    "
                                  />

                                  {
                                    current
                                      ?.l
                                    ??
                                    claim
                                      .status
                                  }
                                </Badge>
                              </td>

                              <td className="p-3">
                                <div
                                  className="
                                    flex
                                    justify-end
                                    gap-1
                                    opacity-80
                                    group-hover:
                                    opacity-100
                                  "
                                >
                                  {claim.status === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        className="
                                          h-8
                                          bg-emerald-600
                                          text-white
                                          hover:bg-emerald-700
                                        "
                                        onClick={() => {
                                          setDecision(
                                            {
                                              id:
                                                claim.id,
                                              d:
                                                "approved",
                                            },
                                          );

                                          setNote("");
                                        }}
                                      >
                                        <Check
                                          className="
                                            mr-1
                                            h-3.5
                                            w-3.5
                                          "
                                        />

                                        Approuver
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="
                                          h-8
                                          border-rose-300
                                          text-rose-600
                                        "
                                        onClick={() => {
                                          setDecision(
                                            {
                                              id:
                                                claim.id,
                                              d:
                                                "rejected",
                                            },
                                          );

                                          setNote("");
                                        }}
                                      >
                                        <X
                                          className="
                                            h-3.5
                                            w-3.5
                                          "
                                        />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Dialog
              open={
                decision !== null
              }
              onOpenChange={(
                open,
              ) => {
                if (!open) {
                  setDecision(
                    null,
                  );
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {
                      decision?.d ===
                      "approved"
                        ? (
                            "Approuver "
                            + "la réclamation"
                          )
                        : (
                            "Rejeter "
                            + "la réclamation"
                          )
                    }
                  </DialogTitle>
                </DialogHeader>

                <Textarea
                  value={note}
                  onChange={(event) =>
                    setNote(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder="Note interne (optionnelle, max 500 caractères)…"
                  rows={4}
                  maxLength={500}
                />

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDecision(
                        null,
                      )
                    }
                    disabled={
                      deciding
                    }
                  >
                    Annuler
                  </Button>

                  <Button
                    className={
                      decision?.d ===
                      "approved"
                        ? `
                          bg-emerald-600
                          hover:bg-emerald-700
                        `
                        : `
                          bg-rose-600
                          hover:bg-rose-700
                        `
                    }
                    onClick={
                      confirmDecision
                    }
                    disabled={
                      deciding
                    }
                  >
                    {deciding
                      ? "Traitement…"
                      : "Confirmer"
                    }
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </div>
  );
}