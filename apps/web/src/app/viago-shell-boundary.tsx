"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  site: ReactNode;
  viago: ReactNode;
};

export function ViagoShellBoundary({ site, viago }: Props) {
  const pathname = usePathname();

  if (pathname === "/viago") {
    return (
      <div
        data-viago-standalone="true"
        className="fixed inset-0 isolate h-dvh w-full overflow-hidden"
      >
        {viago}
      </div>
    );
  }

  return <>{site}</>;
}
