import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, ChevronDown, Facebook, Instagram, LogOut, Mail, MapPin, Menu,
  MessageCircle, Twitter, User as UserIcon, Shield, ShieldCheck, TrendingUp,
  ClipboardCheck, Wrench, Headphones, HardHat,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLangue } from "@/hooks/useLangue";
import { cn } from "@/lib/utils";

const WHATSAPP_SERVICE = "224620000000";

const NAV = [
  { to: "/tarifs" as const, cle: "nav.pricing" },
  { to: "/pro" as const, cle: "nav.pros" },
  { to: "/blog" as const, cle: "nav.blog" },
  { to: "/faq" as const, cle: "nav.faq" },
  { to: "/a-propos" as const, cle: "nav.about" },
];

/** Routes qui gèrent leur propre chrome (sidebar, topbar) — pas de header/footer public. */
const BACKOFFICE_PREFIXES = ["/supervisor", "/admin", "/sales", "/ops", "/support", "/agent"];

/** Routes où le header doit être transparent au-dessus du héros (revient solide au scroll). */
const OVERLAY_HEADER_ROUTES = ["/"];

type EspaceInfo = {
  role: string; to: string; label: string; icon: any; cls: string;
};
const ESPACES_METIER: Record<string, EspaceInfo> = {
  super_admin: { role: "super_admin", to: "/admin", label: "Espace super admin", icon: ShieldCheck, cls: "text-rose-600" },
  admin: { role: "admin", to: "/admin", label: "Espace administrateur", icon: Shield, cls: "text-violet-600" },
  supervisor: { role: "supervisor", to: "/supervisor", label: "Espace superviseur", icon: ClipboardCheck, cls: "text-indigo-600" },
  sales: { role: "sales", to: "/sales", label: "Espace commercial", icon: TrendingUp, cls: "text-emerald-600" },
  ops: { role: "ops", to: "/ops", label: "Espace opérations", icon: Wrench, cls: "text-amber-600" },
  support: { role: "support", to: "/support", label: "Espace support", icon: Headphones, cls: "text-sky-600" },
  agent: { role: "agent", to: "/agent", label: "Espace agent terrain", icon: HardHat, cls: "text-orange-600" },
};

function useRoleUtilisateur(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["user-role", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      return (data?.role as string | null) ?? null;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}

function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function Header() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { data: role } = useRoleUtilisateur(user?.id);
  const { location } = useRouterState();
  const scrolled = useScrolled(40);
  const [menuOpen, setMenuOpen] = useState(false);
  const initiales = user?.email?.slice(0, 2).toUpperCase() ?? "GN";
  const espace = role ? ESPACES_METIER[role] : null;

  // Mode overlay : transparent au-dessus du héros, solide au scroll.
  const isOverlayRoute = OVERLAY_HEADER_ROUTES.includes(location.pathname);
  const overlay = isOverlayRoute && !scrolled;

  return (
    <header
      className={cn(
        "sticky top-0 z-[900] transition-all duration-300",
        overlay
          ? "border-b border-transparent bg-transparent"
          : scrolled
            ? "border-b border-border/70 bg-background/90 shadow-brand backdrop-blur-md"
            : "border-b border-border/70 bg-background",
      )}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 sm:py-3.5">
        <Link to="/" aria-label={t("nav.home")} className="min-w-0">
          <Logo tone={overlay ? "light" : undefined} />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Nav desktop */}
          <nav className="mr-2 hidden items-center gap-1 rtl:mr-0 rtl:ml-2 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  overlay
                    ? "text-white/85 hover:bg-white/10 hover:text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-primary",
                )}
              >
                {t(item.cle)}
              </Link>
            ))}
          </nav>

          <LanguageSwitcher tone={overlay ? "light" : undefined} />

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40",
                    overlay && "ring-2 ring-white/20",
                  )}
                  aria-label={t("nav.userMenu")}
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                      {initiales}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm text-foreground">{user?.email}</div>
                  {espace && (
                    <div className={cn("mt-0.5 flex items-center gap-1 text-[11px] font-medium", espace.cls)}>
                      <espace.icon className="size-3" />
                      {espace.label.replace("Espace ", "")}
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/mon-compte" className="flex items-center gap-2">
                    <UserIcon className="size-4" />
                    {t("nav.account")}
                  </Link>
                </DropdownMenuItem>
                {espace ? (
                  <DropdownMenuItem asChild>
                    <Link to={espace.to} className={cn("flex items-center gap-2 font-medium", espace.cls)}>
                      <espace.icon className="size-4" />
                      {espace.label}
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/pro" className="flex items-center gap-2">
                      <Briefcase className="size-4" />
                      {t("nav.proSpace")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/logout" className="flex items-center gap-2">
                    <LogOut className="size-4" />
                    {t("nav.logout")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className={cn(
                  "hidden h-11 sm:inline-flex",
                  overlay && "text-white hover:bg-white/10 hover:text-white",
                )}
              >
                <Link to="/login">{t("nav.login")}</Link>
              </Button>
              <Button
                asChild
                className={cn(
                  "h-11 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]",
                  overlay
                    ? "bg-white text-slate-900 hover:bg-white/90"
                    : "bg-accent text-accent-foreground hover:bg-accent-dark",
                )}
              >
                <Link to="/tarifs">{t("nav.order")}</Link>
              </Button>
            </>
          )}

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-11 lg:hidden",
                  overlay && "text-white hover:bg-white/10 hover:text-white",
                )}
                aria-label={t("nav.openMenu")}
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle className="text-left rtl:text-right">
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
                    {t(item.cle)}
                  </Link>
                ))}
                <Link
                  to="/confidentialite"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("nav.privacy")}
                </Link>
                {espace && (
                  <Link
                    to={espace.to}
                    onClick={() => setMenuOpen(false)}
                    className={cn("rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted flex items-center gap-2", espace.cls)}
                  >
                    <espace.icon className="size-4" />
                    {espace.label}
                  </Link>
                )}
                {!isAuthenticated && (
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-accent transition-colors hover:bg-muted"
                  >
                    {t("nav.login")}
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

const FOCUS =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

type FooterLink = { cle: string; to?: string; href?: string; disabled?: boolean };

const FOOTER_COLS: { cle: string; links: FooterLink[] }[] = [
  {
    cle: "footer.cols.product",
    links: [
      { cle: "footer.links.pricing", to: "/tarifs" },
      { cle: "footer.links.individuals", href: "/a-propos#particuliers" },
      { cle: "footer.links.pros", href: "/a-propos#pros" },
      { cle: "footer.links.api", href: "/a-propos#api" },
    ],
  },
  {
    cle: "footer.cols.resources",
    links: [
      { cle: "footer.links.howItWorks", to: "/a-propos" },
      { cle: "footer.links.help", href: "mailto:contact@adresse.gn" },
      { cle: "footer.links.faq", to: "/faq" },
      { cle: "footer.links.blog", to: "/blog" },
      { cle: "footer.links.status", disabled: true },
    ],
  },
  {
    cle: "footer.cols.company",
    links: [
      { cle: "footer.links.about", to: "/a-propos" },
      { cle: "footer.links.contact", href: "mailto:contact@adresse.gn" },
      { cle: "footer.links.press", disabled: true },
      { cle: "footer.links.partners", disabled: true },
    ],
  },
  {
    cle: "footer.cols.legal",
    links: [
      { cle: "footer.links.legalNotice", to: "/confidentialite" },
      { cle: "footer.links.privacy", to: "/confidentialite" },
      { cle: "footer.links.terms", to: "/confidentialite" },
      { cle: "footer.links.cookies", to: "/confidentialite" },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  const { t } = useTranslation();
  const base = cn("text-xs transition-colors rounded-sm", FOCUS);
  const label = t(link.cle);
  if (link.disabled) {
    return (
      <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-slate-300 opacity-40")}>
        {label}
      </span>
    );
  }
  if (link.href) {
    return (
      <a href={link.href} className={cn(base, "text-slate-300 hover:text-white")}>{label}</a>
    );
  }
  return (
    <Link to={link.to as "/tarifs"} className={cn(base, "text-slate-300 hover:text-white")}>{label}</Link>
  );
}

function Footer() {
  const { t } = useTranslation();
  const { langue, langues } = useLangue();
  const langueCourante = langues.find((l) => l.code === langue) ?? langues[0];
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-6 pt-12 pb-6 md:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <Logo tone="light" />
            <p className="max-w-xs text-xs leading-relaxed text-slate-400">{t("footer.tagline")}</p>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <MapPin className="size-3.5 shrink-0" />
                {t("footer.location")}
              </span>
              <a href="mailto:contact@adresse.gn" className={cn("flex items-center gap-2 rounded-sm text-xs text-slate-300 transition-colors hover:text-accent", FOCUS)}>
                <Mail className="size-3.5 shrink-0" />contact@adresse.gn
              </a>
              <a href={`https://wa.me/${WHATSAPP_SERVICE}`} target="_blank" rel="noreferrer" className={cn("flex items-center gap-2 rounded-sm text-xs text-slate-300 transition-colors hover:text-accent", FOCUS)}>
                <MessageCircle className="size-3.5 shrink-0" />
                {t("footer.whatsapp")}
              </a>
            </div>
            <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
              {t("footer.pilot")}
            </span>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.cle} className="hidden lg:col-span-2 lg:block">
              <h2 className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">{t(col.cle)}</h2>
              <nav className="flex flex-col space-y-2">
                {col.links.map((link) => <FooterLinkItem key={link.cle} link={link} />)}
              </nav>
            </div>
          ))}
          <div className="divide-y divide-slate-800 border-y border-slate-800 lg:hidden">
            {FOOTER_COLS.map((col) => (
              <details key={col.cle} className="group py-2.5">
                <summary className={cn("flex cursor-pointer list-none items-center justify-between rounded-sm text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase", FOCUS)}>
                  {t(col.cle)}
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <nav className="mt-2 flex flex-col space-y-2">
                  {col.links.map((link) => <FooterLinkItem key={link.cle} link={link} />)}
                </nav>
              </details>
            ))}
          </div>
        </div>
        <div className="mt-8 mb-4 border-t border-slate-800/70" />
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
            <span>{t("footer.rights")}</span>
            <span aria-hidden="true">·</span>
            <LanguageSwitcher tone="light" className="h-7 px-2 text-[11px] text-slate-400" />
          </div>
          <div className="flex items-center gap-2">
            {[
              { Icon: Facebook, label: "Facebook" },
              { Icon: Instagram, label: "Instagram" },
              { Icon: Twitter, label: "X" },
            ].map(({ Icon, label }) => (
              <span key={label} aria-label={label} className="grid size-7 place-items-center rounded-md border border-slate-800 text-slate-400 transition-colors hover:border-slate-600 hover:text-white">
                <Icon className="size-3.5" />
              </span>
            ))}
          </div>
        </div>
        <span className="sr-only">{langueCourante.nom}</span>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const isBackoffice = BACKOFFICE_PREFIXES.some((p) => location.pathname.startsWith(p));
  const isOverlay = OVERLAY_HEADER_ROUTES.includes(location.pathname);

  if (isBackoffice) return <div className="min-h-screen">{children}</div>;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      {/* Sur les routes en overlay, le main démarre SOUS le header transparent
          (via -mt-16 sur le premier enfant) pour que le héros passe derrière la nav. */}
      <main className={cn("flex-1", isOverlay && "-mt-[68px] pt-[68px]")}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
