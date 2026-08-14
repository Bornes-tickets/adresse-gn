import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_guard/lots")({
  beforeLoad: () => { throw redirect({ to: "/ops/lots" }); },
});
