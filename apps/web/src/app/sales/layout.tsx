import type {
  ReactNode,
} from "react";

import {
  RoleShell,
} from "@/features/backoffice/components/role-shell";


export default function SalesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleShell space="sales">
      {children}
    </RoleShell>
  );
}