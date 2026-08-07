import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileClock,
  FileCheck2,
  Flag,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  QrCode,
  Repeat,
  ShieldCheck,
  Users,
  UserSquare2,
} from "lucide-react";


import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  { to: "/admin/installations-attente", label: "Installations à planifier", icon: CalendarClock },
  { to: "/admin/justificatifs", label: "Justificatifs installation", icon: FileCheck2 },
  { to: "/admin/payments", label: "Paiements", icon: CreditCard },
  { to: "/admin/abonnements", label: "Abonnements", icon: Repeat },
  { to: "/admin/reports", label: "Signalements", icon: Flag },
  { to: "/admin/claims", label: "Réclamations", icon: ShieldCheck },
  { to: "/admin/users", label: "Utilisateurs", icon: Users },
  { to: "/admin/agents", label: "Agents", icon: UserSquare2 },
  { to: "/admin/lots", label: "Lots", icon: Package },
  { to: "/admin/zones", label: "Zones", icon: Activity },
  { to: "/admin/audit", label: "Journal d'audit", icon: FileClock },
  { to: "/admin/analytics", label: "Statistiques", icon: BarChart3 },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 pb-6">
      {SECTIONS.map(({ to, label, icon: Icone }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/admin" }}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
        >
          <Icone className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-2 px-5 py-5">
      <span className="rounded-md bg-primary px-2 py-1 text-sm font-bold text-primary-foreground">
        AGN
      </span>
      <span className="text-sm font-semibold text-foreground">Back-office</span>
    </div>
  );
}

function AdminShell() {
  const { user, admin, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    setMenuOuvert(false);
  }, [pathname]);

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
        <BrandHeader />
        <NavLinks />
      </aside>

      <Sheet open={menuOuvert} onOpenChange={setMenuOuvert}>
        <SheetContent side="left" className="w-72 max-w-[85vw] flex-col p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu d'administration</SheetTitle>
          </SheetHeader>
          <BrandHeader />
          <NavLinks onNavigate={() => setMenuOuvert(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 lg:hidden"
              onClick={() => setMenuOuvert(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <nav className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <Link to="/admin" className="hover:text-foreground">
                  Administration
                </Link>
                <span>/</span>
                <span className="text-foreground">{courant.label}</span>
              </nav>
              <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
                {courant.label}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {admin?.full_name ?? "Administrateur"}
              </p>
              <p className="text-xs text-muted-foreground">{statusLabel(admin?.role)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={deconnexion}>
              <LogOut className="mr-0 size-4 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
