import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Briefcase,
  Facebook,
  Heart,
  Instagram,
  Linkedin,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  User as UserIcon,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const WHATSAPP_SERVICE = "224620000000";

const NAV = [
  { to: "/tarifs" as const, label: "Tarifs" },
  { to: "/pro" as const, label: "Pour les pros" },
  { to: "/a-propos" as const, label: "À propos" },
];

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

function Header() {
  const { user, isAuthenticated } = useAuth();
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const initiales = user?.email?.slice(0, 2).toUpperCase() ?? "GN";

  return (
    <header
      className={cn(
        "sticky top-0 z-[900] border-b transition-all duration-200",
        scrolled
          ? "border-border/70 bg-background/85 shadow-brand backdrop-blur-md"
          : "border-transparent bg-background/60 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 sm:px-6">
        <Link to="/" aria-label="Adresse GN — accueil" className="min-w-0">
          <Logo />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="mr-2 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label="Menu utilisateur"
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary text-sm text-primary-foreground">
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
            <>
              <Button asChild variant="ghost" className="hidden h-11 sm:inline-flex">
                <Link to="/login">Se connecter</Link>
              </Button>
              <Button
                asChild
                className="h-11 bg-accent text-accent-foreground transition-transform duration-200 hover:scale-[1.02] hover:bg-accent-dark active:scale-[0.98]"
              >
                <Link to="/tarifs">Commander</Link>
              </Button>
            </>
          )}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1 px-4">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/confidentialite"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Confidentialité
                </Link>
                {!isAuthenticated && (
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-accent transition-colors hover:bg-muted"
                  >
                    Se connecter
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            <Logo tone="light" />
            <p className="text-sm text-slate-400">
              Un numéro unique par lieu, en Guinée.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_SERVICE}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">Produit</h2>
            <nav className="flex flex-col gap-2.5 text-sm text-slate-400">
              <Link to="/tarifs" className="hover:text-white">
                Tarifs
              </Link>
              <Link to="/pro" className="hover:text-white">
                Pour les pros
              </Link>
              <Link to="/pro/api" className="hover:text-white">
                API
              </Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">Informations</h2>
            <nav className="flex flex-col gap-2.5 text-sm text-slate-400">
              <Link to="/a-propos" className="hover:text-white">
                À propos
              </Link>
              <Link to="/confidentialite" className="hover:text-white">
                Confidentialité
              </Link>
              <a
                href="mailto:contact@adresse.gn"
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <Mail className="size-4" />
                contact@adresse.gn
              </a>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Adresse GN · Tous droits réservés.
          </p>
          <div className="flex items-center gap-3">
            {[
              { Icon: Facebook, label: "Facebook" },
              { Icon: Instagram, label: "Instagram" },
              { Icon: Twitter, label: "Twitter" },
            ].map(({ Icon, label }) => (
              <span
                key={label}
                title={`${label} — bientôt`}
                aria-label={`${label} — bientôt`}
                className="grid size-9 place-items-center rounded-full border border-white/10 text-slate-500"
              >
                <Icon className="size-4" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}


export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
