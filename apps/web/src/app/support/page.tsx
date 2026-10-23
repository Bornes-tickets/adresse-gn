import type {
  Metadata,
} from "next";

import {
  RoleDashboardPage,
} from "@/features/backoffice/components/role-dashboard-page";


export const metadata: Metadata = {
  title: "Support — Adresse GN",
};


export default function Page() {
  return (
    <RoleDashboardPage
      space="support"
    />
  );
}