import type {
  Metadata,
} from "next";

import {
  ResourcePage,
} from "@/features/backoffice/components/resource-page";


export const metadata: Metadata = {
  title: "Pages CMS — Adresse GN",
};


export default function Page() {
  return (
    <ResourcePage
      title="Pages CMS"
      subtitle="Pages éditoriales administrées depuis le CMS."
      resource="cms_pages"
    />
  );
}