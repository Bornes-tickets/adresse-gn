import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { proBusiness } from "@/lib/pro.functions";

export const Route = createFileRoute("/pro/_guard")({
  ssr: false,
  component: ProShell,
});

const SECTIONS = [
  { to: "/pro", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/pro/etablissements", label: "Établissements", icon: Building2 },
  { to: "/pro/statistiques", label: "Statistiques", icon: BarChart3 },
  { to: "/pro/equipe", label: "Équipe", icon: Users },
  { to: "/pro/facturation", label: "Facturation", icon: CreditCard },
  { to: "/pro/api", label: "Clés API", icon: KeyRound },
] as const;

function ProShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const business = useQuery({
    queryKey: ["pro-business"],
    queryFn: () => proBusiness(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (business.isSuccess && business.data === null) {
      navigate({ to: "/pro/onboarding", replace: true });
    }
  }, [business.isSuccess, business.data, navigate]);

  if (loading || !user || business.isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Espace pro</p>
            <p className="font-semibold text-foreground">
              {business.data?.trade_name ?? "Mon entreprise"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/mon-compte">Mon compte</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {SECTIONS.map(({ to, label, icon: Icone, ...rest }) => (
            <Link
              key={to}
              to={to}
              {...("exact" in rest ? { activeOptions: { exact: true as const } } : {})}
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-muted font-medium text-foreground" }}
            >
              <Icone className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
