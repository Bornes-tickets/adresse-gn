import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { opsWhoami } from "@/lib/ops.functions";

export const Route = createFileRoute("/ops/_guard")({
  beforeLoad: async () => {
    try {
      const identite = await opsWhoami();
      return { identite };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
