"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import {
  Badge,
} from "@/components/ui/badge";
import {
  Button,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Input,
} from "@/components/ui/input";
import {
  Textarea,
} from "@/components/ui/textarea";
import {
  verifyDjangoSession,
} from "@/features/auth/api";
import {
  getAccessToken,
} from "@/lib/supabase/browser";

import {
  SalesApiError,
  confirmSalesPayment,
  listSalesPayments,
  rejectSalesPayment,
} from "../api";
import type {
  SalesConfirmResponse,
  SalesPaymentItem,
} from "../types";


const SALES_ROLES =
  new Set([
    "sales",
    "admin",
    "super_admin",
  ]);

const PAGE_SIZE = 25;


function formatGnf(
  value: number,
): string {
  return `${
    new Intl.NumberFormat(
      "fr-FR",
    ).format(value)
  } GNF`;
}


function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
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


function humanizeInvoiceState(
  state:
    SalesConfirmResponse["invoice_state"],
): string {
  switch (state) {
    case "published":
      return "Facture publiée";

    case "storage_pending_retry":
      return "Paiement confirmé — publication PDF à réessayer";

    case "db_pending_retry":
      return "Paiement confirmé — facture DB à réessayer";

    default:
      return state;
  }
}


function apiErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof SalesApiError
  ) {
    return error.message;
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Une erreur inattendue est survenue.";
}


type RetryState = {
  paymentId: string;
  externalRef: string;
  note: string | null;
  invoiceState:
    | "storage_pending_retry"
    | "db_pending_retry";
};


export function SalesPaymentsPage() {
  const router =
    useRouter();

  const [
    role,
    setRole,
  ] = useState<
    string | null
  >(null);

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  const [
    forbidden,
    setForbidden,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    payments,
    setPayments,
  ] = useState<
    SalesPaymentItem[]
  >([]);

  const [
    selected,
    setSelected,
  ] = useState<
    SalesPaymentItem | null
  >(null);

  const [
    action,
    setAction,
  ] = useState<
    "confirm" | "reject" | null
  >(null);

  const [
    externalRef,
    setExternalRef,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    rejectReason,
    setRejectReason,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    retryState,
    setRetryState,
  ] = useState<
    RetryState | null
  >(null);


  useEffect(
    () => {
      const controller =
        new AbortController();

      async function bootstrap() {
        try {
          const token =
            await getAccessToken();

          if (!token) {
            router.replace(
              "/login?returnTo=%2Fsales%2Fpaiements",
            );
            return;
          }

          const me =
            await verifyDjangoSession(
              token,
              controller.signal,
            );

          const nextRole =
            me.user.role ??
            null;

          setRole(
            nextRole,
          );

          if (
            !nextRole
            || !SALES_ROLES.has(
              nextRole,
            )
          ) {
            setForbidden(
              true,
            );
          }
        } catch (bootstrapError) {
          if (
            bootstrapError
            instanceof DOMException
            && bootstrapError.name
            === "AbortError"
          ) {
            return;
          }

          setError(
            bootstrapError
            instanceof Error
              ? bootstrapError.message
              : "Vérification de session impossible.",
          );
        } finally {
          if (
            !controller.signal.aborted
          ) {
            setAuthLoading(
              false,
            );
          }
        }
      }

      void bootstrap();

      return () => {
        controller.abort();
      };
    },
    [
      router,
    ],
  );


  const load =
    useCallback(
      async () => {
        if (
          authLoading
          || forbidden
          || !role
          || !SALES_ROLES.has(
            role,
          )
        ) {
          return;
        }

        setLoading(
          true,
        );
        setError(
          "",
        );

        try {
          const result =
            await listSalesPayments({
              page,
              pageSize:
                PAGE_SIZE,
              status:
                "actionable",
            });

          const actionableItems =
            result.items ??
            [];

          setPayments(
            actionableItems,
          );
          setTotal(
            result.total,
          );

          if (
            selected
            && !actionableItems.some(
              (
                item,
              ) =>
                item.id
                === selected.id,
            )
            && !retryState
          ) {
            setSelected(
              null,
            );
            setAction(
              null,
            );
          }
        } catch (
          loadError
        ) {
          if (
            loadError
            instanceof SalesApiError
            && (
              loadError.statusCode
              === 401
              || loadError.statusCode
              === 403
            )
          ) {
            setForbidden(
              true,
            );
          }

          setError(
            apiErrorMessage(
              loadError,
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        authLoading,
        forbidden,
        page,
        retryState,
        role,
        selected,
      ],
    );


  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );


  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,
          Math.ceil(
            total
            / PAGE_SIZE,
          ),
        ),
      [
        total,
      ],
    );


  function selectPayment(
    payment:
      SalesPaymentItem,
  ) {
    setSelected(
      payment,
    );
    setAction(
      null,
    );
    setExternalRef(
      payment.external_ref
      ?? "",
    );
    setNote(
      "",
    );
    setRejectReason(
      "",
    );
    setError(
      "",
    );
    setNotice(
      "",
    );

    if (
      payment.invoice_state
      === "storage_pending_retry"
      || payment.invoice_state
      === "db_pending_retry"
    ) {
      const persistedExternalRef =
        payment.external_ref?.trim()
        ?? "";

      if (persistedExternalRef) {
        setRetryState({
          paymentId: payment.id,
          externalRef: persistedExternalRef,
          note: null,
          invoiceState: payment.invoice_state,
        });
      } else {
        setRetryState(null);
        setError(
          "Référence externe persistée introuvable pour reprendre la facturation.",
        );
      }
    } else {
      setRetryState(null);
    }
  }


  async function submitConfirm() {
    if (!selected) {
      return;
    }

    const cleanExternalRef =
      externalRef.trim();

    if (
      !cleanExternalRef
    ) {
      setError(
        "La référence externe est obligatoire.",
      );
      return;
    }

    if (
      cleanExternalRef.length
      > 200
    ) {
      setError(
        "La référence externe ne peut pas dépasser 200 caractères.",
      );
      return;
    }

    const cleanNote =
      note.trim();

    if (
      cleanNote.length
      > 1000
    ) {
      setError(
        "La note ne peut pas dépasser 1000 caractères.",
      );
      return;
    }

    setSubmitting(
      true,
    );
    setError(
      "",
    );
    setNotice(
      "",
    );

    try {
      const result =
        await confirmSalesPayment(
          selected.id,
          {
            external_ref:
              cleanExternalRef,
            note:
              cleanNote
              || null,
          },
        );

      if (
        result.invoice_state
        === "published"
      ) {
        setRetryState(
          null,
        );
        setNotice(
          "Paiement confirmé et facture publiée.",
        );
        setAction(
          null,
        );
        setSelected(
          null,
        );
        await load();
        return;
      }

      setRetryState({
        paymentId:
          selected.id,
        externalRef:
          cleanExternalRef,
        note:
          cleanNote
          || null,
        invoiceState:
          result.invoice_state,
      });

      setSelected(
        (current) =>
          current
            ? {
                ...current,
                status: "success",
                external_ref: cleanExternalRef,
                invoice_state: result.invoice_state,
              }
            : current,
      );

      setNotice(
        humanizeInvoiceState(
          result.invoice_state,
        ),
      );
    } catch (
      confirmError
    ) {
      setError(
        apiErrorMessage(
          confirmError,
        ),
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  async function retryInvoice() {
    if (
      !retryState
      || !selected
      || selected.id
      !== retryState.paymentId
    ) {
      return;
    }

    setSubmitting(
      true,
    );
    setError(
      "",
    );
    setNotice(
      "",
    );

    try {
      const result =
        await confirmSalesPayment(
          retryState.paymentId,
          {
            external_ref:
              retryState.externalRef,
            note:
              retryState.note,
          },
        );

      if (
        result.invoice_state
        === "published"
      ) {
        setRetryState(
          null,
        );
        setNotice(
          "Facture publiée avec succès.",
        );
        setAction(
          null,
        );
        setSelected(
          null,
        );
        await load();
        return;
      }

      setRetryState({
        ...retryState,
        invoiceState:
          result.invoice_state,
      });

      setSelected(
        (current) =>
          current
            ? {
                ...current,
                invoice_state: result.invoice_state,
              }
            : current,
      );

      setNotice(
        humanizeInvoiceState(
          result.invoice_state,
        ),
      );
    } catch (
      retryError
    ) {
      setError(
        apiErrorMessage(
          retryError,
        ),
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  async function submitReject() {
    if (!selected) {
      return;
    }

    const cleanReason =
      rejectReason.trim();

    if (
      cleanReason.length
      < 3
    ) {
      setError(
        "Le motif de rejet doit contenir au moins 3 caractères.",
      );
      return;
    }

    setSubmitting(
      true,
    );
    setError(
      "",
    );
    setNotice(
      "",
    );

    try {
      await rejectSalesPayment(
        selected.id,
        cleanReason,
      );

      setRetryState(
        null,
      );
      setNotice(
        "Paiement rejeté.",
      );
      setAction(
        null,
      );
      setSelected(
        null,
      );
      await load();
    } catch (
      rejectError
    ) {
      setError(
        apiErrorMessage(
          rejectError,
        ),
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4 py-12">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Vérification de l’accès Sales…
        </div>
      </main>
    );
  }


  if (forbidden) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>
              Accès refusé
            </CardTitle>
            <CardDescription>
              Cet espace est réservé aux rôles sales, admin et super_admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border p-4 text-sm text-slate-600">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              Le contrôle d’autorisation définitif reste appliqué par l’API Django.
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }


  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500">
            Espace Sales
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Paiements manuels en attente
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Vérifiez la commande, saisissez la référence du paiement puis confirmez ou rejetez l’opération.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={
            loading
            || submitting
          }
          onClick={() => {
            void load();
          }}
        >
          <RefreshCw
            className={
              loading
                ? "mr-2 h-4 w-4 animate-spin"
                : "mr-2 h-4 w-4"
            }
          />
          Actualiser
        </Button>
      </div>

      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            {error}
          </span>
        </div>
      ) : null}

      {notice ? (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            {notice}
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>
                  File d’attente
                </CardTitle>
                <CardDescription>
                  {payments.length} paiement(s) manuel(s) affiché(s) sur cette page.
                </CardDescription>
              </div>

              <Badge>
                Pending
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-slate-500">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Chargement…
              </div>
            ) : payments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                Aucun paiement manuel en attente sur cette page.
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map(
                  (
                    payment,
                  ) => {
                    const active =
                      selected?.id
                      === payment.id;

                    return (
                      <button
                        key={
                          payment.id
                        }
                        type="button"
                        onClick={() => {
                          selectPayment(
                            payment,
                          );
                        }}
                        className={[
                          "w-full rounded-xl border p-4 text-left transition",
                          active
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/60",
                        ].join(" ")}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">
                                {payment.order_ref}
                              </span>
                              <Badge>
                                {payment.offer_code}
                              </Badge>
                            </div>

                            <p className="mt-1 text-sm text-slate-600">
                              {payment.client}
                              {payment.client_phone
                                ? ` · ${payment.client_phone}`
                                : ""}
                            </p>
                          </div>

                          <div className="text-left md:text-right">
                            <div className="font-semibold">
                              {formatGnf(
                                payment.amount_gnf,
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDate(
                                payment.payment_created_at,
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={
                  page <= 1
                  || loading
                }
                onClick={() => {
                  setPage(
                    (
                      current,
                    ) =>
                      Math.max(
                        1,
                        current - 1,
                      ),
                  );
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Précédent
              </Button>

              <span className="text-sm text-slate-500">
                Page {page} / {totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                disabled={
                  page >= totalPages
                  || loading
                }
                onClick={() => {
                  setPage(
                    (
                      current,
                    ) =>
                      current + 1,
                  );
                }}
              >
                Suivant
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>
              Détail du paiement
            </CardTitle>
            <CardDescription>
              Contrôle avant validation ou rejet.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!selected ? (
              <p className="text-sm text-slate-500">
                Sélectionnez un paiement dans la file d’attente.
              </p>
            ) : (
              <div className="space-y-5">
                <dl className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Commande
                    </dt>
                    <dd className="font-medium">
                      {selected.order_ref}
                    </dd>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Offre
                    </dt>
                    <dd>
                      {selected.offer_code}
                    </dd>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Client
                    </dt>
                    <dd>
                      {selected.client}
                    </dd>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Téléphone
                    </dt>
                    <dd>
                      {selected.client_phone ?? "—"}
                    </dd>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Montant
                    </dt>
                    <dd className="font-semibold">
                      {formatGnf(
                        selected.amount_gnf,
                      )}
                    </dd>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Paiement
                    </dt>
                    <dd>
                      {selected.status}
                    </dd>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Statut commande
                    </dt>
                    <dd>
                      {selected.order_status}
                    </dd>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <dt className="text-slate-500">
                      Créé le
                    </dt>
                    <dd>
                      {formatDate(
                        selected.payment_created_at,
                      )}
                    </dd>
                  </div>

                  {selected.notes ? (
                    <div className="grid grid-cols-[120px_1fr] gap-3">
                      <dt className="text-slate-500">
                        Notes
                      </dt>
                      <dd className="break-words">
                        {selected.notes}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {retryState
                && retryState.paymentId
                === selected.id ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">
                      {humanizeInvoiceState(
                        retryState.invoiceState,
                      )}
                    </p>

                    <p className="mt-1 text-xs text-amber-800">
                      Le paiement est déjà confirmé. Ne créez pas une nouvelle référence : relancez uniquement la chaîne de facturation.
                    </p>

                    <Button
                      type="button"
                      className="mt-3 w-full"
                      disabled={
                        submitting
                      }
                      onClick={() => {
                        void retryInvoice();
                      }}
                    >
                      {submitting
                        ? "Nouvelle tentative…"
                        : "Réessayer la facture"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          setAction(
                            "confirm",
                          );
                          setError(
                            "",
                          );
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirmer
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAction(
                            "reject",
                          );
                          setError(
                            "",
                          );
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Rejeter
                      </Button>
                    </div>

                    {action === "confirm" ? (
                      <div className="space-y-4 rounded-xl border p-4">
                        <div>
                          <label
                            htmlFor="external-ref"
                            className="mb-1.5 block text-sm font-medium"
                          >
                            Référence externe *
                          </label>
                          <Input
                            id="external-ref"
                            value={
                              externalRef
                            }
                            maxLength={
                              200
                            }
                            placeholder="Ex. reçu ou référence de transaction"
                            onChange={(
                              event,
                            ) => {
                              setExternalRef(
                                event.target.value,
                              );
                            }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="confirm-note"
                            className="mb-1.5 block text-sm font-medium"
                          >
                            Note
                          </label>
                          <Textarea
                            id="confirm-note"
                            value={
                              note
                            }
                            maxLength={
                              1000
                            }
                            placeholder="Information interne facultative"
                            onChange={(
                              event,
                            ) => {
                              setNote(
                                event.target.value,
                              );
                            }}
                          />
                        </div>

                        <Button
                          type="button"
                          className="w-full"
                          disabled={
                            submitting
                            || !externalRef.trim()
                          }
                          onClick={() => {
                            void submitConfirm();
                          }}
                        >
                          {submitting
                            ? "Confirmation…"
                            : "Valider définitivement"}
                        </Button>
                      </div>
                    ) : null}

                    {action === "reject" ? (
                      <div className="space-y-4 rounded-xl border p-4">
                        <div>
                          <label
                            htmlFor="reject-reason"
                            className="mb-1.5 block text-sm font-medium"
                          >
                            Motif du rejet *
                          </label>
                          <Textarea
                            id="reject-reason"
                            value={
                              rejectReason
                            }
                            placeholder="Expliquez pourquoi le paiement est rejeté"
                            onChange={(
                              event,
                            ) => {
                              setRejectReason(
                                event.target.value,
                              );
                            }}
                          />
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={
                            submitting
                            || rejectReason.trim().length
                              < 3
                          }
                          onClick={() => {
                            void submitReject();
                          }}
                        >
                          {submitting
                            ? "Rejet…"
                            : "Confirmer le rejet"}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
