import type {
  ReactNode,
} from "react";

import {
  OwnerShell,
} from "@/features/owner/components/owner-shell";


export default function Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <OwnerShell>
      {children}
    </OwnerShell>
  );
}