"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type {
  FormEvent,
} from "react";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import {
  AlertTriangle,
  ChevronRight,
  Headphones,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
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
  Label,
} from "@/components/ui/label";
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
  type BackofficeAccount,
  type BackofficeAccountStatus,
  type BackofficeIdentity,
  type VerificationMethod,
  getBackofficeMe,
  listBackofficeAccounts,
  reactivateBackofficeAccount,
} from "../api";

type StatusFilter =
  | BackofficeAccountStatus
  | "all";

const GROUPS = [
  {
    label: "Pilotage",
    items: [
      {
        href: "/support",
        label: "Tableau de bord",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Tickets",
    items: [
      {
        href: "/support/signalements",
        label: "Signalements citoyens",
        icon: AlertTriangle,
      },
      {
        href: "/support/reclamations",
        label: "Réclamations",
        icon: MessageSquareWarning,
      },
      {
        href: "/support/messages",
        label: "Messages entrants",
        icon: MessageCircle,
      },
    ],
  },
  {
    label: "Comptes",
    items: [
      {
        href: "/support/comptes",
        label: "Comptes utilisateurs",
        icon: Users,
      },
    ],
  },
];

const FILTERS: Array<{
  value: StatusFilter;
  label: string;
  icon: typeof Users;
  className: string;
}> = [
  {
    value: "deactivated",
    label: "Désactivés",
    icon: UserX,
    className: "bg-rose-100 text-rose-700",
  },
  {
    value: "active",
    label: "Actifs",
    icon: UserCheck,
    className: "bg-emerald-100 text-emerald-700",
  },
  {
    value: "all",
    label: "Tous",
    icon: Users,
    className: "bg-sky-100 text-sky-700",
  },
];

const VERIFICATION_METHODS: Array<{
  value: VerificationMethod;
  label: string;
}> = [
  {
    value: "document",
    label: "Pièce d’identité / document",
  },
  {
    value: "email",
    label: "Vérification par e-mail",
  },
  {
    value: "phone",
    label: "Vérification par téléphone",
  },
  {
    value: "in_person",
    label: "Vérification en personne",
  },
  {
    value: "other",
    label: "Autre méthode",
  },
];

function formatDateTimeFr(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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
        part[0]?.toUpperCase() ?? "",
    )
    .join("");
}

function displayName(
  account: BackofficeAccount,
) {
  return (
    account.full_name?.trim()
    || "Utilisateur Adresse GN"
  );
}

export function SupportAccountsPage() {
  const router = useRouter();

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
  ] = useState<StatusFilter>(
    "deactivated",
  );

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    submittedQuery,
    setSubmittedQuery,
  ] = useState("");

  const [
    accounts,
    setAccounts,
  ] = useState<
    BackofficeAccount[]
  >([]);

  const [
    counts,
    setCounts,
  ] = useState({
    active: 0,
    deactivated: 0,
  });

  const [
    loadingIdentity,
    setLoadingIdentity,
  ] = useState(true);

  const [
    loadingAccounts,
    setLoadingAccounts,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    selectedAccount,
    setSelectedAccount,
  ] = useState<
    BackofficeAccount | null
  >(null);

  const [
    verificationMethod,
    setVerificationMethod,
  ] = useState<
    VerificationMethod
  >("document");

  const [
    verificationNote,
    setVerificationNote,
  ] = useState("");

  const [
    confirmation,
    setConfirmation,
  ] = useState("");

  const [
    reactivating,
    setReactivating,
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
            "/login?returnTo=%2Fsupport%2Fcomptes",
          );
          return;
        }

        const me =
          await getBackofficeMe(
            token,
            controller.signal,
          );

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setAccessToken(token);
        setIdentity(me.user);
      } catch (error) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "Accès au support impossible.",
        );

        router.replace(
          "/login?returnTo=%2Fsupport%2Fcomptes",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoadingIdentity(false);
        }
      }
    }

    void bootstrap();

    return () => {
      controller.abort();
    };
  }, [router]);

  const refreshAccounts =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        if (!accessToken) {
          return;
        }

        setLoadingAccounts(true);
        setLoadError(null);

        try {
          const data =
            await listBackofficeAccounts(
              accessToken,
              filter,
              submittedQuery,
              signal,
            );

          if (signal?.aborted) {
            return;
          }

          setAccounts(data.items);
          setCounts(data.counts);
        } catch (error) {
          if (signal?.aborted) {
            return;
          }

          if (
            error instanceof
              BackofficeApiError
            && (
              error.statusCode === 401
              || error.statusCode === 403
            )
          ) {
            toast.error(error.message);
            router.replace(
              "/login?returnTo=%2Fsupport%2Fcomptes",
            );
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : "Impossible de charger les comptes.";

          setLoadError(message);
          toast.error(message);
        } finally {
          if (!signal?.aborted) {
            setLoadingAccounts(false);
          }
        }
      },
      [
        accessToken,
        filter,
        router,
        submittedQuery,
      ],
    );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const controller =
      new AbortController();

    void refreshAccounts(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [
    accessToken,
    refreshAccounts,
  ]);

  function handleSearch(
    event: FormEvent,
  ) {
    event.preventDefault();
    setSubmittedQuery(
      query.trim(),
    );
  }

  function clearSearch() {
    setQuery("");
    setSubmittedQuery("");
  }

  function openReactivate(
    account: BackofficeAccount,
  ) {
    setSelectedAccount(account);
    setVerificationMethod(
      "document",
    );
    setVerificationNote("");
    setConfirmation("");
  }

  function closeReactivate() {
    if (reactivating) {
      return;
    }

    setSelectedAccount(null);
    setVerificationNote("");
    setConfirmation("");
  }

  async function confirmReactivate() {
    if (
      !selectedAccount
      || !accessToken
      || confirmation !==
        "REACTIVER"
      || !verificationNote
          .trim()
    ) {
      return;
    }

    setReactivating(true);

    try {
      const result =
        await reactivateBackofficeAccount(
          accessToken,
          selectedAccount.id,
          {
            confirm: "REACTIVER",
            verification_method:
              verificationMethod,
            verification_note:
              verificationNote.trim(),
          },
        );

      toast.success(result.message);

      setSelectedAccount(null);
      setVerificationNote("");
      setConfirmation("");

      await refreshAccounts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "La réactivation a échoué.",
      );
    } finally {
      setReactivating(false);
    }
  }

  if (loadingIdentity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50/40">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"
          aria-label="Chargement"
        />
      </div>
    );
  }

  if (!identity) {
    return null;
  }

  const total =
    counts.active
    + counts.deactivated;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/40">
      <aside className="fixed inset-y-0 left-0 z-30 w-72 border-r border-slate-200/80 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="flex h-20 items-center gap-3 border-b border-slate-200/60 px-6">
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 shadow-lg shadow-sky-500/30">
              <Headphones className="h-6 w-6 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
          </div>

          <div>
            <div className="text-[15px] font-bold tracking-tight">
              Adresse GN
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-sky-600">
              Espace support
            </div>
          </div>
        </div>

        <nav className="h-[calc(100vh-20rem)] space-y-5 overflow-y-auto px-3 py-5">
          {GROUPS.map(
            (group) => (
              <div key={group.label}>
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {group.label}
                </div>

                <div className="space-y-0.5">
                  {group.items.map(
                    (item) => {
                      const active =
                        item.href ===
                        "/support/comptes";
                      const Icon =
                        item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={false}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                            active
                              ? "bg-gradient-to-r from-sky-50 to-blue-50 font-semibold text-sky-700 shadow-sm"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-sky-500 to-blue-600" />
                          )}

                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0",
                              active
                                ? "text-sky-600"
                                : "text-slate-400",
                            )}
                          />

                          <span className="flex-1">
                            {item.label}
                          </span>

                          {active && (
                            <ChevronRight className="h-3.5 w-3.5 text-sky-500" />
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

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200/60 bg-white/60 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/60 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white">
              {initiales(identity.full_name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">
                {identity.full_name ?? "Support"}
              </div>
              <div className="text-[11px] text-slate-500">
                {identity.role}
              </div>
            </div>

            <Link
              href="/"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="ml-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-8">
            <nav className="flex items-center gap-1.5 text-sm">
              <Link
                href="/support"
                prefetch={false}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <Home className="h-3.5 w-3.5" />
              </Link>

              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />

              <span className="font-semibold">
                Comptes utilisateurs
              </span>
            </nav>

            <div className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-medium text-white sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              Lifecycle sécurisé
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-8">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />

              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70">
                    <Users className="h-3.5 w-3.5" />
                    Comptes
                  </div>

                  <h1 className="mt-1 text-3xl font-bold">
                    Comptes utilisateurs
                  </h1>

                  <p className="mt-1 text-sm text-white/80">
                    Rechercher les comptes et réactiver uniquement les comptes utilisateur désactivés.
                  </p>
                </div>

                <Button
                  variant="secondary"
                  className="border-white/20 bg-white/15 text-white hover:bg-white/25"
                  onClick={() =>
                    void refreshAccounts()
                  }
                  disabled={loadingAccounts}
                >
                  <RefreshCw
                    className={cn(
                      "mr-1.5 h-4 w-4",
                      loadingAccounts
                        ? "animate-spin"
                        : "",
                    )}
                  />
                  Rafraîchir
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {FILTERS.map(
                (item) => {
                  const Icon =
                    item.icon;
                  const count =
                    item.value === "all"
                      ? total
                      : counts[item.value];

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        setFilter(item.value)
                      }
                      className={cn(
                        "rounded-xl border bg-white p-4 text-left transition hover:shadow-md",
                        filter === item.value
                          ? "border-sky-600 ring-2 ring-sky-200"
                          : "border-slate-200",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                            {item.label}
                          </div>
                          <div className="mt-1 text-2xl font-bold">
                            {count}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            item.className,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  );
                },
              )}
            </div>

            <Card>
              <CardContent className="p-4">
                <form
                  onSubmit={handleSearch}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Nom, téléphone, e-mail ou UUID…"
                      value={query}
                      onChange={(event) =>
                        setQuery(
                          event.target.value,
                        )
                      }
                      className="pl-9"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loadingAccounts}
                  >
                    Rechercher
                  </Button>

                  {(query || submittedQuery) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearSearch}
                    >
                      Effacer
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              {loadingAccounts ? (
                <div className="p-16 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
                </div>
              ) : loadError ? (
                <div className="p-16 text-center text-rose-600">
                  {loadError}
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-16 text-center text-slate-500">
                  Aucun compte correspondant.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="p-3 text-left font-semibold">
                          Utilisateur
                        </th>
                        <th className="p-3 text-left font-semibold">
                          Contact
                        </th>
                        <th className="p-3 text-left font-semibold">
                          Statut
                        </th>
                        <th className="p-3 text-left font-semibold">
                          Désactivé le
                        </th>
                        <th className="p-3 text-right font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {accounts.map(
                        (account) => (
                          <tr
                            key={account.id}
                            className="bg-white hover:bg-slate-50/70"
                          >
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">
                                {displayName(account)}
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                                {account.id}
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="text-slate-700">
                                {account.phone || "—"}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {account.email_masked || "—"}
                              </div>
                            </td>

                            <td className="p-3">
                              {account.account_status === "deactivated" ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-rose-100 text-rose-700"
                                >
                                  Désactivé
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="bg-emerald-100 text-emerald-700"
                                >
                                  Actif
                                </Badge>
                              )}
                            </td>

                            <td className="p-3 text-slate-600">
                              {formatDateTimeFr(
                                account.deactivated_at,
                              )}
                            </td>

                            <td className="p-3 text-right">
                              {account.account_status === "deactivated" ? (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    openReactivate(account)
                                  }
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <UserCheck className="mr-1.5 h-4 w-4" />
                                  Réactiver
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Aucune action
                                </span>
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      <Dialog
        open={selectedAccount !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeReactivate();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Réactiver le compte
            </DialogTitle>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">
                  Vérification d’identité obligatoire
                </div>
                <p className="mt-1 text-amber-800">
                  La réactivation restaure l’accès au compte. Elle doit être effectuée uniquement après vérification de l’identité de l’utilisateur.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold">
                  {displayName(selectedAccount)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedAccount.email_masked || "E-mail non disponible"}
                  {" · "}
                  {selectedAccount.phone || "Téléphone non disponible"}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-400">
                  {selectedAccount.id}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verification-method">
                  Méthode de vérification
                </Label>

                <select
                  id="verification-method"
                  value={verificationMethod}
                  onChange={(event) =>
                    setVerificationMethod(
                      event.target.value as VerificationMethod,
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {VERIFICATION_METHODS.map(
                    (method) => (
                      <option
                        key={method.value}
                        value={method.value}
                      >
                        {method.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verification-note">
                  Note de vérification
                </Label>

                <Textarea
                  id="verification-note"
                  value={verificationNote}
                  onChange={(event) =>
                    setVerificationNote(
                      event.target.value,
                    )
                  }
                  placeholder="Décrivez précisément comment l’identité a été vérifiée."
                  maxLength={1000}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reactivation-confirmation">
                  Confirmation
                </Label>

                <p className="text-xs text-slate-500">
                  Saisissez exactement <strong>REACTIVER</strong> pour confirmer.
                </p>

                <Input
                  id="reactivation-confirmation"
                  value={confirmation}
                  onChange={(event) =>
                    setConfirmation(
                      event.target.value,
                    )
                  }
                  autoComplete="off"
                  placeholder="REACTIVER"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeReactivate}
              disabled={reactivating}
            >
              Annuler
            </Button>

            <Button
              type="button"
              onClick={() =>
                void confirmReactivate()
              }
              disabled={
                reactivating
                || confirmation !==
                  "REACTIVER"
                || !verificationNote
                    .trim()
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {reactivating
                ? "Réactivation…"
                : "Confirmer la réactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
