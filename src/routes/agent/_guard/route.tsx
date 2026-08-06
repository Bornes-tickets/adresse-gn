import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock, ListChecks, User as UserIcon, Wifi } from "lucide-react";

import { InstallBanner } from "@/components/agent/InstallBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent } from "@/hooks/useAgent";

export const Route = createFileRoute("/agent/_guard")({
  ssr: false,
  component: AgentShell,
});

const ONGLETS = [
  { to: "/agent/tasks", label: "Tâches", icon: ListChecks },
  { to: "/agent/history", label: "Historique", icon: Clock },
  { to: "/agent/profile", label: "Profil", icon: UserIcon },
] as const;

function AgentShell() {
  const { user, agent, isAgent, loading } = useAgent();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/agent/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || (!user && !isAgent)) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-foreground">Accès refusé</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cet espace est réservé aux agents installateurs.
        </p>
        <Link to="/agent/login" className="mt-6 inline-block text-sm text-primary underline">
          Utiliser un autre compte
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <InstallBanner />

      <header
        className="sticky top-0 z-20 border-b border-border bg-card"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary px-2 py-1 text-sm font-bold text-primary-foreground">
              AGN
            </span>
            <span className="max-w-[9rem] truncate text-sm font-medium text-foreground">
              {agent?.full_name ?? agent?.badge_number}
            </span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent">
            <Wifi className="size-3.5" />
            En ligne
          </span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-3">
          {ONGLETS.map(({ to, label, icon: Icone }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground"
              activeProps={{ className: "text-primary font-medium" }}
            >
              <Icone className="size-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
