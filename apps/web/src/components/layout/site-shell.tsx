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

  const isSupport =
    pathname === "/support" ||
    pathname.startsWith(
      "/support/",
    );

  if (isSupport) {
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