import type {
  ReactNode,
} from "react";

import {
  RoleShell,
} from "@/features/backoffice/components/role-shell";


export default function OpsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleShell space="ops">
      {children}
    </RoleShell>
  );
}