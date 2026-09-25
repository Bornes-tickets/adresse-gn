"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadPlans } from "@/features/checkout/api";
import type { PublicPlan } from "@/features/checkout/types";

function localizedText(
  value: Record<string, string> | null,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  return (
    value.fr ??
    value.FR ??
    value.en ??
    fallback
  );
}

function formatGnf(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(
    Number(value || 0),
  );
}

function planFeatures(plan: PublicPlan): string[] {
  const raw = plan.features as unknown;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item))
      .filter(Boolean)
      .slice(0, 6);
  }

  if (raw && typeof raw === "object") {
    const source = raw as Record<string, unknown>;

    const localized =
      source.fr ??
      source.FR ??
      source.en ??
      source.items;

    if (Array.isArray(localized)) {
      return localized
        .map((item) => String(item))
        .filter(Boolean)
        .slice(0, 6);
    }

    return Object.values(source)
      .filter(
        (item): item is string =>
          typeof item === "string" &&
          item.trim().length > 0,
      )
      .slice(0, 6);
  }

  return [];
}

function planAudienceLabel(plan: PublicPlan): string {
  if (plan.code === "pro") {
    return "Professionnels";
  }

  if (plan.code === "residentiel_standard") {
    return "Résidentiel";
  }

  return "Particuliers";
}

export default function PricingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    loadPlans(controller.signal)
      .then((items) => {
        setPlans(items);
        setError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Impossible de charger les offres.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const orderedPlans = useMemo(
    () =>
      [...plans].sort(
        (a, b) =>
          Number(a.position || 0) -
          Number(b.position || 0),
      ),
    [plans],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Nos offres
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Choisissez l’Adresse GN adaptée à votre besoin
        </h1>

        <p className="mt-4 text-muted-foreground">
          Les offres affichées proviennent directement du catalogue
          Django Adresse GN. Vous confirmerez ensuite le lieu,
          vos coordonnées et la vérification d’identité.
        </p>
      </div>

      {loading && (
        <div className="mt-10 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement des offres…
        </div>
      )}

      {error && (
        <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {orderedPlans.map((plan) => {
            const name = localizedText(
              plan.name,
              plan.code,
            );

            const description = localizedText(
              plan.description,
              "",
            );

            const features = planFeatures(plan);

            return (
              <Card
                key={plan.id}
                className={
                  plan.popular
                    ? "border-accent shadow-lg"
                    : ""
                }
              >
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {planAudienceLabel(plan)}
                    </span>

                    {plan.popular && (
                      <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                        Populaire
                      </span>
                    )}
                  </div>

                  <CardTitle className="text-2xl">
                    {name}
                  </CardTitle>

                  {description && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="flex h-full flex-col">
                  <div>
                    {plan.requires_quote ? (
                      <p className="text-2xl font-semibold">
                        Sur devis
                      </p>
                    ) : (
                      <>
                        <p className="text-2xl font-semibold">
                          {formatGnf(plan.price_gnf)} GNF
                        </p>

                        {Number(plan.recurring_price_gnf || 0) > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            + {formatGnf(plan.recurring_price_gnf)} GNF
                            {plan.billing_period
                              ? ` / ${plan.billing_period}`
                              : ""}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {features.length > 0 && (
                    <ul className="mt-6 space-y-2">
                      {features.map((feature) => (
                        <li
                          key={feature}
                          className="flex gap-2 text-sm"
                        >
                          <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-7">
                    <Button asChild className="w-full">
                      <Link
                        href={`/commander?plan=${encodeURIComponent(
                          plan.code,
                        )}`}
                      >
                        {plan.requires_quote
                          ? "Demander un devis"
                          : "Choisir cette offre"}
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading &&
        !error &&
        orderedPlans.length === 0 && (
          <div className="mx-auto mt-10 max-w-xl rounded-xl border p-5 text-center text-sm text-muted-foreground">
            Aucune offre active n’est disponible actuellement.
          </div>
        )}

      <div className="mt-10 text-center">
        <Button variant="outline" asChild>
          <Link href="/">Retour à l’accueil</Link>
        </Button>
      </div>
    </main>
  );
}
