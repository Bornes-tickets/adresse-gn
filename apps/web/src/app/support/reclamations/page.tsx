import type {
  Metadata,
} from "next";

import {
  SupportClaimsPage,
} from "@/features/backoffice/components/support-claims-page";


export const metadata: Metadata = {
  title:
    "Réclamations d'adresses",
};


export default function Page() {
  return (
    <SupportClaimsPage />
  );
}