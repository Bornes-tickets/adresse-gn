import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Cette page a été déplacée dans l'espace commercial /sales.
 * On redirige les anciens liens pour préserver l'accès.
 */
export const Route = createFileRoute("/admin/_guard/payments")({
  beforeLoad: () => {
    throw redirect({ to: "/sales/paiements" });
  },
});
