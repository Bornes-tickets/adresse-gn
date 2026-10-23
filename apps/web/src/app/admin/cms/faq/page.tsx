import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "FAQ — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="FAQ"
      subtitle="Questions fréquentes publiées sur Adresse GN."
      resource="cms_faq"
    />
  );
}