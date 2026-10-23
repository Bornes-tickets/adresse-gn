"use client";

import type {
  ReactNode,
} from "react";

import {
  usePathname,
} from "next/navigation";


type SiteShellProps = {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};


export function SiteShell({
  header,
  footer,
  children,
}: SiteShellProps) {
  const pathname =
    usePathname();

  const hasOwnLayout =
    pathname === "/admin" ||
    pathname.startsWith(
      "/admin/",
    ) ||
    pathname === "/supervisor" ||
    pathname.startsWith(
      "/supervisor/",
    ) ||
    pathname === "/ops" ||
    pathname.startsWith(
      "/ops/",
    ) ||
    pathname === "/sales" ||
    pathname.startsWith(
      "/sales/",
    ) ||
    pathname === "/support" ||
    pathname.startsWith(
      "/support/",
    ) ||
    pathname === "/agent" ||
    pathname.startsWith(
      "/agent/",
    ) ||
    pathname === "/mon-compte" ||
    pathname.startsWith(
      "/mon-compte/",
    );

  if (hasOwnLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {header}

      <main className="flex-1">
        {children}
      </main>

      {footer}
    </div>
  );
}