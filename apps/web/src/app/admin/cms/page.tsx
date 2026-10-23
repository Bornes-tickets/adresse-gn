import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "CMS — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="CMS"
      subtitle="Vue d’ensemble des contenus éditoriaux et commerciaux."
      resource="cms_overview"
    />
  );
}