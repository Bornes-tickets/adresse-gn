import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogOut, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

export function Layout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const initiales = user?.email?.slice(0, 2).toUpperCase() ?? "GN";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex flex-col leading-tight">
            <span className="text-xl font-bold tracking-tight text-primary">
              ADRESSE GN
            </span>
            <span className="text-xs text-muted-foreground">
              Un lieu · Un numéro · Un itinéraire
            </span>
          </Link>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Menu utilisateur"
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {initiales}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/mon-compte" className="flex items-center gap-2">
                    <UserIcon className="size-4" />
                    Mon compte
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/pro" className="flex items-center gap-2">
                    <Briefcase className="size-4" />
                    Espace pro
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/logout" className="flex items-center gap-2">
                    <LogOut className="size-4" />
                    Se déconnecter
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>

            </DropdownMenu>
          ) : (
            <Button asChild variant="outline">
              <Link to="/login" className="flex items-center gap-2">
                <UserIcon className="size-4" />
                Se connecter
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Adresse GN · Mentions légales</p>
          <nav className="flex gap-4">
            <Link to="/a-propos" className="hover:text-primary">
              À propos
            </Link>
            <Link to="/confidentialite" className="hover:text-primary">
              Confidentialité
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
