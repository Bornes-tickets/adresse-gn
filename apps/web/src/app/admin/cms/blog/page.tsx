import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Blog — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Blog"
      subtitle="Articles et publications du site Adresse GN."
      resource="cms_posts"
    />
  );
}