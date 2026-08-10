import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supervisorWhoami } from "@/lib/supervisor.functions";

export const Route = createFileRoute("/supervisor/_guard")({
  beforeLoad: async () => {
    try {
      const identite = await supervisorWhoami();
      return { identite };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
