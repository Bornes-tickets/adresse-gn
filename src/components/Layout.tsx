import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Briefcase, LogOut, Mail, MessageCircle, User as UserIcon } from "lucide-react";

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

const WHATSAPP_SERVICE = "224620000000";

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

          <nav className="ml-auto mr-2 hidden items-center gap-4 sm:flex">
            <Link to="/tarifs" className="text-sm text-muted-foreground hover:text-primary">
              Tarifs
            </Link>
            <Link to="/a-propos" className="text-sm text-muted-foreground hover:text-primary">
              À propos
            </Link>
          </nav>

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
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid gap-10 sm:grid-cols-3">
            <div className="space-y-3">
              <span className="block text-lg font-bold tracking-tight text-primary">
                ADRESSE GN
              </span>
              <p className="text-sm text-muted-foreground">
                Un lieu · Un numéro · Un itinéraire. Le système d'adressage
                national guinéen.
              </p>
              <address className="text-sm not-italic text-muted-foreground">
                Immeuble Adresse GN, Kaloum
                <br />
                Conakry, République de Guinée
              </address>
              <a
                href={`https://wa.me/${WHATSAPP_SERVICE}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <MessageCircle className="size-4" />
                Service client WhatsApp
              </a>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Produit</h2>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/tarifs" className="hover:text-primary">
                  Tarifs
                </Link>
                <Link to="/" hash="comment-ca-marche" className="hover:text-primary">
                  Comment ça marche
                </Link>
                <Link to="/pro" className="hover:text-primary">
                  Pour les pros
                </Link>
                <Link to="/" hash="pour-qui" className="hover:text-primary">
                  Pour les livreurs
                </Link>
              </nav>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Informations légales
              </h2>
              <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                <Link to="/a-propos" className="hover:text-primary">
                  À propos
                </Link>
                <Link to="/a-propos" className="hover:text-primary">
                  Mentions légales
                </Link>
                <Link to="/confidentialite" className="hover:text-primary">
                  Confidentialité
                </Link>
                <a
                  href="mailto:contact@adresse.gn"
                  className="inline-flex items-center gap-2 hover:text-primary"
                >
                  <Mail className="size-4" />
                  Contact
                </a>
              </nav>
            </div>
          </div>

          <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} ADRESSE GN · Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
