import type {
  Metadata,
} from "next";

import {
  AdminAddressesPage,
} from "@/features/backoffice/components/admin-addresses-page";


export const metadata: Metadata = {
  title:
    "Adresses — Administration Adresse GN",

  robots: {
    index: false,
    follow: false,
  },
};


export default function Page() {
  return (
    <AdminAddressesPage />
  );
}