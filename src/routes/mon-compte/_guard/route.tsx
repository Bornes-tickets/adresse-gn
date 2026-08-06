import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Flag, Heart, LayoutDashboard, LogOut, QrCode, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/mon-compte/_guard")({
  ssr: false,
  component: OwnerShell,
});

const SECTIONS = [
  { to: "/mon-compte", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/mon-compte/beacons", label: "Mes balises", icon: QrCode },
  { to: "/mon-compte/favorites", label: "Mes favoris", icon: Heart },
  { to: "/mon-compte/reports", label: "Signalements", icon: Flag },
  { to: "/mon-compte/settings", label: "Paramètres", icon: Settings },
] as const;

function OwnerShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const initiales = user.email?.slice(0, 2).toUpperCase() ?? "GN";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {initiales}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium text-foreground">Mon compte</p>
              <p className="max-w-[12rem] truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/", replace: true });
            }}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4 py-6">
        <nav className="hidden w-56 shrink-0 flex-col gap-1 md:flex">
          {SECTIONS.map(({ to, label, icon: Icone, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={"exact" in rest ? { exact: true } : undefined}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-muted font-medium text-foreground" }}
            >
              <Icone className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 pb-24 md:pb-0">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {SECTIONS.map(({ to, label, icon: Icone, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={"exact" in rest ? { exact: true } : undefined}
              className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"
              activeProps={{ className: "text-primary font-medium" }}
            >
              <Icone className="size-5" />
              {label.replace("Tableau de bord", "Accueil").replace("Mes ", "")}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
