import type {
  Metadata,
} from "next";

import {
  AdminDashboardPage,
} from "@/features/backoffice/components/admin-dashboard-page";


export const metadata: Metadata = {
  title:
    "Administration — Adresse GN",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <AdminDashboardPage />
  );
}