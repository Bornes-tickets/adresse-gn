import type { Metadata } from "next";

import PricingPage from "@/features/pricing/pricing-page";

export const metadata: Metadata = {
  title: "Nos offres — Adresse GN",
  description:
    "Découvrez les offres Adresse GN pour particuliers, résidences et professionnels.",
};

export default function Page() {
  return <PricingPage />;
}
