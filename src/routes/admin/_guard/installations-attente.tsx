import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Cette page a été déplacée dans l'espace commercial /sales.
 */
export const Route = createFileRoute("/admin/_guard/installations-attente")({
  beforeLoad: () => {
    throw redirect({ to: "/sales/installations" });
  },
});
