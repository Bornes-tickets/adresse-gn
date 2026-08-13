import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Cette page a été déplacée dans l'espace commercial /sales.
 */
export const Route = createFileRoute("/admin/_guard/abonnements")({
  beforeLoad: () => {
    throw redirect({ to: "/sales/abonnements" });
  },
});
