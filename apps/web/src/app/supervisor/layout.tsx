import type {
  ReactNode,
} from "react";

import {
  RoleShell,
} from "@/features/backoffice/components/role-shell";


export default function SupervisorLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleShell space="supervisor">
      {children}
    </RoleShell>
  );
}