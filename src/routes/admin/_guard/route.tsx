import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileClock,
  Flag,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  QrCode,
  Users,
  UserSquare2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/lib/admin";

export const Route = createFileRoute("/admin/_guard")({
  ssr: false,
  component: AdminShell,
});

const SECTIONS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/beacons", label: "Balises", icon: QrCode },
  { to: "/admin/addresses", label: "Adresses", icon: MapPin },
  { to: "/admin/installations", label: "Installations & QC", icon: ClipboardCheck },
  { to: "/admin/reports", label: "Signalements", icon: Flag },
  { to: "/admin/claims", label: "Réclamations", icon: ShieldCheck },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/agents", label: "Agents", icon: UserSquare2 },
  { to: "/admin/lots", label: "Lots", icon: Package },
  { to: "/admin/zones", label: "Zones", icon: Activity },
  { to: "/admin/audit", label: "Journal d'audit", icon: FileClock },
  { to: "/admin/analytics", label: "Statistiques", icon: BarChart3 },
] as const;

function AdminShell() {
  const { user, admin, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Accès refusé</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cet espace est réservé à l'administration.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-primary underline">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const courant =
    [...SECTIONS]
      .sort((a, b) => b.to.length - a.to.length)
      .find((s) => (s.to === "/admin" ? pathname === "/admin" : pathname.startsWith(s.to))) ??
    SECTIONS[0];

  const deconnexion = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="rounded-md bg-primary px-2 py-1 text-sm font-bold text-primary-foreground">
            AGN
          </span>
          <span className="text-sm font-semibold text-foreground">Back-office</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-6">
          {SECTIONS.map(({ to, label, icon: Icone }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/admin" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
            >
              <Icone className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="min-w-0">
            <nav className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/admin" className="hover:text-foreground">
                Administration
              </Link>
              <span>/</span>
              <span className="text-foreground">{courant.label}</span>
            </nav>
            <h1 className="truncate text-lg font-semibold text-foreground">{courant.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {admin?.full_name ?? "Administrateur"}
              </p>
              <p className="text-xs text-muted-foreground">{statusLabel(admin?.role)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={deconnexion}>
              <LogOut className="mr-2 size-4" />
              Déconnexion
            </Button>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
          {SECTIONS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/admin" }}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-muted-foreground"
              activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
