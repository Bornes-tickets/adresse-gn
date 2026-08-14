import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_guard/beacons")({
  beforeLoad: () => { throw redirect({ to: "/ops/beacons" }); },
});
