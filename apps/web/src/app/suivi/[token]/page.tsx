import type { Metadata } from "next";

import TrackingPage from "@/features/checkout/components/tracking-page";

export const metadata: Metadata = {
  title: "Suivi de ma demande — Adresse GN",
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TrackingPage token={token} />;
}
