"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Wallet,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Button,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  initiateManualPayment,
  loadPaymentMethods,
  loadPaymentOrder,
} from "../api";
import type {
  ManualPaymentAction,
  PaymentMethod,
  PaymentOrder,
} from "../types";

function formatGnf(
  value: number,
): string {
  return `${new Intl.NumberFormat(
    "fr-FR",
  ).format(value)} GNF`;
}

export function PaymentPage({
  orderRef,
}: {
  orderRef: string;
}) {
  const [
    order,
    setOrder,
  ] = useState<PaymentOrder | null>(
    null,
  );

  const [
    methods,
    setMethods,
  ] = useState<PaymentMethod[]>(
    [],
  );

  const [
    action,
    setAction,
  ] = useState<ManualPaymentAction | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const load = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const [
          nextOrder,
          nextMethods,
        ] = await Promise.all([
          loadPaymentOrder(
            orderRef,
          ),
          loadPaymentMethods(),
        ]);

        setOrder(
          nextOrder,
        );

        setMethods(
          nextMethods,
        );
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Impossible de charger la commande.";

        setError(
          message,
        );
      } finally {
        setLoading(false);
      }
    },
    [
      orderRef,
    ],
  );

  useEffect(
    () => {
      const timer = window.setTimeout(
        () => {
          void load();
        },
        0,
      );

      return () => window.clearTimeout(
        timer,
      );
    },
    [
      load,
    ],
  );

  async function startManualPayment() {
    setSubmitting(true);
    setError("");

    try {
      const result =
        await initiateManualPayment(
          orderRef,
        );

      setAction(
        result.action,
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d'initialiser le paiement.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="flex items-center justify-center rounded-2xl border p-12">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </main>
    );
  }

  if (
    error &&
    !order
  ) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">
          Paiement indisponible
        </h1>

        <p className="mt-4 text-muted-foreground">
          {error}
        </p>

        <Button
          asChild
          className="mt-6"
        >
          <Link href="/login">
            Se connecter
          </Link>
        </Button>
      </main>
    );
  }

  if (!order) {
    return null;
  }

  const paid =
    order.status === "paid";

  const manual =
    methods.find(
      (method) =>
        method.code === "manual",
    );

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div>
        <p className="text-sm text-muted-foreground">
          Commande
        </p>

        <h1 className="mt-1 text-2xl font-bold">
          {order.order_ref}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Récapitulatif
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {order.items.map(
            (
              item,
              index,
            ) => (
              <div
                key={`${item.ref ?? "item"}-${index}`}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span>
                  {item.label ??
                    item.ref ??
                    order.offer_code}
                </span>

                <span className="font-medium">
                  {formatGnf(
                    Number(
                      item.unit_price_gnf ??
                        0,
                    ) *
                      Number(
                        item.qty ??
                          1,
                      ),
                  )}
                </span>
              </div>
            ),
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <strong>
              Total
            </strong>

            <strong className="text-lg">
              {formatGnf(
                order.amount_gnf,
              )}
            </strong>
          </div>
        </CardContent>
      </Card>

      {paid ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6" />

              <div>
                <p className="font-semibold">
                  Paiement confirmé
                </p>

                <p className="text-sm text-muted-foreground">
                  Votre commande est marquée comme payée.
                </p>
              </div>
            </div>

            {order.invoice?.pdf_url && (
              <Button
                asChild
                variant="outline"
              >
                <a
                  href={order.invoice.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Télécharger la facture
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              Moyen de paiement
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 size-5" />

                <div className="flex-1">
                  <p className="font-semibold">
                    {manual?.label ??
                      "Paiement manuel"}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {manual?.description ??
                      "Espèces ou virement, avec validation par l'équipe Adresse GN."}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                className="mt-4"
                disabled={
                  submitting ||
                  manual?.enabled === false
                }
                onClick={
                  startManualPayment
                }
              >
                {submitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}

                Préparer le paiement
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Orange Money et MTN Mobile Money restent désactivés
              pendant cette tranche de migration.
            </p>
          </CardContent>
        </Card>
      )}

      {action && (
        <Card>
          <CardHeader>
            <CardTitle>
              Instructions
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="whitespace-pre-line text-sm leading-6">
              {action.instructions}
            </p>

            {action.whatsapp_number && (
              <Button
                asChild
                variant="outline"
              >
                <a
                  href={`https://wa.me/${action.whatsapp_number.replace(
                    /[^0-9]/g,
                    "",
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contacter Adresse GN sur WhatsApp
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        asChild
        variant="ghost"
      >
        <Link href="/mon-compte/commandes">
          Retour à mes commandes
        </Link>
      </Button>
    </main>
  );
}
