import type {
  ReactNode,
} from "react";

import {
  AdminShell,
} from "@/features/backoffice/components/admin-shell";


export default function Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}