import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_guard/reports")({
  beforeLoad: () => { throw redirect({ to: "/support/signalements" }); },
});
