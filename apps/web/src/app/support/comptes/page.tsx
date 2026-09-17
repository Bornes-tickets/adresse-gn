import type {
  Metadata,
} from "next";

import {
  SupportAccountsPage,
} from "@/features/backoffice/components/support-accounts-page";

export const metadata: Metadata = {
  title: "Comptes utilisateurs",
};

export default function Page() {
  return <SupportAccountsPage />;
}
