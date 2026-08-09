import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut, Menu } from "lucide-react";

import { AdminCommandMenu } from "@/components/admin/AdminCommandMenu";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/lib/admin";
import { ACCENT_CLASSES, GROUPES_ADMIN, SECTIONS_ADMIN, sectionCourante } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_guard")({
  ssr: false,
  component: AdminShell,
});

const CLE_REPLI = "agn-admin-sidebar";

function NavLinks({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <TooltipProvider delayDuration={100}>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-6">
        {GROUPES_ADMIN.map((groupe) => (
          <div key={groupe} className="space-y-1">
            {!compact && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {groupe}
              </p>
            )}
            {SECTIONS_ADMIN.filter((s) => s.groupe === groupe).map((s) => {
              const Icone = s.icon;
              const accent = ACCENT_CLASSES[s.accent];
              const lien = (
                <Link
                  key={s.to}
                  to={s.to}
                  activeOptions={{ exact: !!s.exact }}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
                    compact && "justify-center px-0",
                  )}
                  activeProps={{
                    className: cn("font-medium text-foreground", accent.fond, accent.texte),
                  }}
                >
                  <Icone className={cn("size-4 shrink-0 transition-colors", accent.texte)} />
                  {!compact && <span className="truncate">{s.label}</span>}
                </Link>
              );

              if (!compact) return lien;
              return (
                <Tooltip key={s.to}>
                  <TooltipTrigger asChild>{lien}</TooltipTrigger>
                  <TooltipContent side="right">{s.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  );
}

function BrandHeader({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-5", compact && "justify-center px-0")}>
      <span className="rounded-lg bg-primary px-2 py-1 text-sm font-bold text-primary-foreground shadow-sm">
        AGN
      </span>
      {!compact && <span className="text-sm font-semibold text-foreground">Back-office</span>}
    </div>
  );
}

function AdminShell() {
  const { user, admin, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setCompact(localStorage.getItem(CLE_REPLI) === "compact");
  }, []);

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

  const courant = sectionCourante(pathname);
  const accent = ACCENT_CLASSES[courant.accent];
  const IconeCourante = courant.icon;

  const basculerRepli = () => {
    const suivant = !compact;
    setCompact(suivant);
    localStorage.setItem(CLE_REPLI, suivant ? "compact" : "large");
  };

  const deconnexion = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
          compact ? "w-[68px]" : "w-64",
        )}
      >
        <BrandHeader compact={compact} />
        <NavLinks compact={compact} />
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={basculerRepli}
            className={cn("w-full text-muted-foreground", compact && "px-0")}
            aria-label={compact ? "Déplier le menu" : "Replier le menu"}
          >
            {compact ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!compact && <span className="ml-2 text-xs">Replier</span>}
          </Button>
        </div>
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
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-card/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 lg:hidden"
              onClick={() => setMenuOuvert(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </Button>
            <span
              className={cn(
                "hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex",
                accent.fond,
                accent.bordure,
              )}
            >
              <IconeCourante className={cn("size-5", accent.texte)} />
            </span>
            <div className="min-w-0">
              <nav className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <Link to="/admin" className="hover:text-foreground">
                  Administration
                </Link>
                <span>/</span>
                <span className="text-muted-foreground">{courant.groupe}</span>
                <span>/</span>
                <span className="text-foreground">{courant.label}</span>
              </nav>
              <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
                {courant.label}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <AdminCommandMenu />
            <AdminThemeToggle />
            <div className="hidden text-right lg:block">
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
