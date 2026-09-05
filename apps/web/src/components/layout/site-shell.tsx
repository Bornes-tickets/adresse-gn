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
    pathname === "/support" ||
    pathname.startsWith(
      "/support/",
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