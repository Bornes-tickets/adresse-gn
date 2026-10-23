import type {
  ReactNode,
} from "react";

import {
  RoleShell,
} from "@/features/backoffice/components/role-shell";


export default function SupportLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleShell space="support">
      {children}
    </RoleShell>
  );
}