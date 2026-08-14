import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_guard/claims")({
  beforeLoad: () => { throw redirect({ to: "/support/reclamations" }); },
});
