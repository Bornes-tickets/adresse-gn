import type {
  Metadata,
} from "next";

import {
  PaymentPage,
} from "@/features/payments/components/payment-page";

export const metadata: Metadata = {
  title: "Paiement de la commande — Adresse GN",
  description:
    "Finaliser le paiement d’une commande Adresse GN.",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{
    orderRef: string;
  }>;
};

export default async function Page({
  params,
}: PageProps) {
  const {
    orderRef,
  } = await params;

  return (
    <PaymentPage
      orderRef={orderRef}
    />
  );
}
