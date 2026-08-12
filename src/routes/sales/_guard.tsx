import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { salesWhoami } from "@/lib/sales.functions";

export const Route = createFileRoute("/sales/_guard")({
  beforeLoad: async () => {
    try {
      const identite = await salesWhoami();
      return { identite };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
