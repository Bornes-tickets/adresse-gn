import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agent/_guard/")({
  beforeLoad: () => {
    throw redirect({ to: "/agent/tasks", replace: true });
  },
});
