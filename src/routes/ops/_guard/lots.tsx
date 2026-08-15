import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ops/_guard/lots")({
  beforeLoad: () => { throw redirect({ to: "/ops/commandes-fournisseurs" }); },
});
