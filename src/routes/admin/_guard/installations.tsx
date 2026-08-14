import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_guard/installations")({
  beforeLoad: () => { throw redirect({ to: "/supervisor/installations" }); },
});
