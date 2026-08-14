import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supportWhoami } from "@/lib/support.functions";

export const Route = createFileRoute("/support/_guard")({
  beforeLoad: async () => {
    try {
      const identite = await supportWhoami();
      return { identite };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
