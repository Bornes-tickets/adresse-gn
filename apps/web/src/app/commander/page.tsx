import type { Metadata } from "next";

import CommanderPage from "@/features/checkout/components/commander-page";

export const metadata: Metadata = {
  title: "Commander mon Adresse GN",
  description:
    "Créer une demande Adresse GN, confirmer le lieu et suivre la commande.",
};

const ALLOWED_PLAN_CODES = new Set([
  "numerique",
  "residentiel_standard",
  "pro",
]);

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.plan)
    ? params.plan[0]
    : params.plan;

  const initialPlanCode =
    requested && ALLOWED_PLAN_CODES.has(requested)
      ? requested
      : "";

  return (
    <CommanderPage
      initialPlanCode={initialPlanCode}
    />
  );
}
