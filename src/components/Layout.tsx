import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  Facebook,
  Instagram,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Twitter,
  User as UserIcon,
  Shield,
  ShieldCheck,
  TrendingUp,
  ClipboardCheck,
  Wrench,
  Headphones,
  HardHat,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLangue } from "@/hooks/useLangue";
import { cn } from "@/lib/utils";

const WHATSAPP_SERVICE = "224620000000";

const FOOTER_CONTAINER =
  "mx-auto w-full max-w-[1760px] px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16";

const NAV: { to: "/" | "/tarifs"; label: string; hash?: string }[] = [
  { to: "/", label: "Comment ça marche", hash: "comment-ca-marche" },
  { to: "/tarifs", label: "Nos offres" },
];

const BACKOFFICE_PREFIXES = [
  "/supervisor",
  "/admin",
  "/sales",
  "/ops",
  "/support",
  "/agent",
];

type EspaceInfo = {
  role: string;
  to: string;
  label: string;
  icon: any;
  cls: string;
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

/* =========================================================
   HEADER — Mobile ultra épuré : Logo + Burger uniquement
   Sur ≥ sm : LanguageSwitcher, "Se connecter", CTA visibles
   ========================================================= */
function Header() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { data: role } = useRoleUtilisateur(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const initiales = user?.email?.slice(0, 2).toUpperCase() ?? "GN";
  const espace = role ? ESPACES_METIER[role] : null;

  return (
    <header className="sticky top-0 z-[900] border-b border-border/70 bg-background">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3.5">
        <Link to="/" aria-label={t("nav.home")} className="min-w-0">
          <Logo />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Navigation desktop/tablette */}
          <nav className="mr-2 hidden items-center gap-1 rtl:mr-0 rtl:ml-2 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                {...(item.hash ? { hash: item.hash } : {})}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* LanguageSwitcher — masqué sur mobile pour éviter la surcharge */}
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40"
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
              {/* "Se connecter" — masqué sur mobile (accessible via burger) */}
              <Button
                asChild
                variant="ghost"
                className="hidden h-11 font-medium text-foreground sm:inline-flex"
              >
                <Link to="/login">Se connecter</Link>
              </Button>

              {/* CTA "Créer mon Adresse GN" — masqué sur mobile (accessible via burger) */}
              <Button
                asChild
                className="hidden h-11 bg-accent text-accent-foreground transition-transform duration-200 hover:scale-[1.02] hover:bg-accent-dark active:scale-[0.98] sm:inline-flex"
              >
                <Link to="/commander">Créer mon Adresse GN</Link>
              </Button>
            </>
          )}

          {/* Burger — visible < md */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
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

              {/* CTA principal en haut du drawer mobile */}
              <div className="mt-4 px-4">
                <Button
                  asChild
                  className="h-12 w-full bg-accent text-accent-foreground hover:bg-accent-dark"
                >
                  <Link to="/commander" onClick={() => setMenuOpen(false)}>
                    Créer mon Adresse GN
                  </Link>
                </Button>
              </div>

              <nav className="mt-4 flex flex-col gap-1 px-4">
                {NAV.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    {...(item.hash ? { hash: item.hash } : {})}
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
                  {t("nav.privacy")}
                </Link>
                {espace && (
                  <Link
                    to={espace.to}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted",
                      espace.cls,
                    )}
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
                    Se connecter
                  </Link>
                )}
              </nav>

              {/* Langue au bas du drawer */}
              <div className="mt-6 border-t px-4 pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Langue
                </p>
                <LanguageSwitcher />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

/* =========================================================
   FOOTER — INCHANGÉ
   ========================================================= */
const FOCUS =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";
type FooterRoute = "/tarifs" | "/a-propos" | "/faq" | "/blog" | "/confidentialite";
type FooterLink = { cle: string; to?: FooterRoute; href?: string; disabled?: boolean };
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
  const label = t(link.cle);
  const base = cn("inline-flex w-fit rounded-sm text-[11px] leading-4 transition-colors xl:text-[12px]", FOCUS);
  if (link.disabled) return <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-slate-600")}>{label}</span>;
  if (link.href) return <a href={link.href} className={cn(base, "text-slate-400 hover:text-white")}>{label}</a>;
  if (!link.to) return null;
  return <Link to={link.to} className={cn(base, "text-slate-400 hover:text-white")}>{label}</Link>;
}

function FooterColumn({ col }: { col: (typeof FOOTER_COLS)[number] }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <h2 className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 xl:text-[10px]">
        {t(col.cle)}
      </h2>
      <nav className="flex flex-col gap-1.5 xl:gap-2">
        {col.links.map((link) => <FooterLinkItem key={link.cle} link={link} />)}
      </nav>
    </div>
  );
}

function Footer() {
  const { t } = useTranslation();
  const { langue, langues } = useLangue();
  const langueCourante = langues.find((l) => l.code === langue) ?? langues[0];
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-slate-300">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-0 size-[260px] rounded-full bg-blue-900/10 blur-[100px]" />
      <div aria-hidden className="pointer-events-none absolute -right-32 top-0 size-[260px] rounded-full bg-cyan-900/[0.08] blur-[100px]" />
      <div className={cn(FOOTER_CONTAINER, "relative pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-5 sm:pb-4 sm:pt-6 lg:pb-3 lg:pt-6 xl:pt-7")}>
        <div className="hidden min-w-0 lg:grid lg:grid-cols-[1.45fr_repeat(4,minmax(0,1fr))] lg:items-start lg:gap-x-8 xl:gap-x-10 2xl:gap-x-14">
          <div className="min-w-0 pr-2">
            <Logo tone="light" />
            <p className="mt-2.5 max-w-[270px] text-[11px] leading-4 text-slate-400 xl:text-xs">{t("footer.tagline")}</p>
            <div className="mt-3 grid gap-1.5">
              <span className="flex min-w-0 items-center gap-2 text-[11px] leading-4 text-slate-400 xl:text-xs">
                <MapPin className="size-3.5 shrink-0 text-slate-500" />
                <span className="min-w-0 truncate">{t("footer.location")}</span>
              </span>
              <a href="mailto:contact@adresse.gn" className={cn("flex w-fit max-w-full min-w-0 items-center gap-2 rounded-sm text-[11px] leading-4 text-slate-300 transition-colors hover:text-accent xl:text-xs", FOCUS)}>
                <Mail className="size-3.5 shrink-0 text-slate-500" />
                <span className="truncate">contact@adresse.gn</span>
              </a>
              <a href={`https://wa.me/${WHATSAPP_SERVICE}`} target="_blank" rel="noreferrer" className={cn("flex w-fit items-center gap-2 rounded-sm text-[11px] leading-4 text-slate-300 transition-colors hover:text-accent xl:text-xs", FOCUS)}>
                <MessageCircle className="size-3.5 shrink-0 text-slate-500" />
                {t("footer.whatsapp")}
              </a>
            </div>
            <span className="mt-3 inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-[9px] font-medium leading-4 text-accent xl:text-[10px]">
              <span className="mr-1.5 size-1.5 rounded-full bg-accent" />
              {t("footer.pilot")}
            </span>
          </div>
          {FOOTER_COLS.map((col) => <FooterColumn key={col.cle} col={col} />)}
        </div>
        {/* =================================================
            MOBILE / TABLETTE — FOOTER PREMIUM COMPACT
            Desktop inchangé : ce bloc reste strictement < lg
            ================================================= */}
        <div className="lg:hidden">
          {/* Identité + statut */}
          <div className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <Logo tone="light" />

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[9px] font-semibold text-accent">
                <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(20,184,166,0.7)]" />
                Pilote 2026
              </span>
            </div>

            <p className="mt-2.5 max-w-[310px] text-[11px] leading-[1.55] text-slate-400">
              {t("footer.tagline")}
            </p>

            {/* Contacts rapides */}
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <div className="flex min-w-0 items-center gap-2.5 rounded-[14px] border border-slate-800/80 bg-white/[0.025] px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.05] text-slate-400">
                  <MapPin className="size-3.5" />
                </span>

                <div className="min-w-0">
                  <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    Localisation
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-300">
                    {t("footer.location")}
                  </p>
                </div>
              </div>

              <a
                href={`https://wa.me/${WHATSAPP_SERVICE}`}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "flex min-w-0 items-center gap-2.5 rounded-[14px] border border-slate-800/80 bg-white/[0.025] px-3 py-2.5 transition-all active:scale-[0.98] active:bg-white/[0.05]",
                  FOCUS,
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent/10 text-accent">
                  <MessageCircle className="size-3.5" />
                </span>

                <div className="min-w-0">
                  <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    WhatsApp
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-300">
                    Nous contacter
                  </p>
                </div>
              </a>
            </div>

            {/* E-mail */}
            <a
              href="mailto:contact@adresse.gn"
              className={cn(
                "mt-2 flex min-w-0 items-center gap-2.5 rounded-[14px] border border-slate-800/80 bg-white/[0.025] px-3 py-2.5 transition-all active:scale-[0.99] active:bg-white/[0.05]",
                FOCUS,
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.05] text-slate-400">
                <Mail className="size-3.5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  E-mail
                </p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-300">
                  contact@adresse.gn
                </p>
              </div>

              <ArrowRight className="size-3.5 shrink-0 text-slate-600" />
            </a>
          </div>

          {/* Navigation accordéon */}
          <div className="overflow-hidden rounded-[18px] border border-slate-800/80 bg-white/[0.018]">
            {FOOTER_COLS.map((col, index) => (
              <details key={col.cle} className="group">
                <summary
                  className={cn(
                    "flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-4 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition-colors marker:hidden active:bg-white/[0.035]",
                    index !== 0 && "border-t border-slate-800/70",
                    FOCUS,
                  )}
                >
                  <span>{t(col.cle)}</span>

                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.035] text-slate-500 transition-all duration-200 group-open:rotate-180 group-open:bg-accent/10 group-open:text-accent">
                    <ChevronDown className="size-3.5" />
                  </span>
                </summary>

                <nav className="grid gap-0.5 border-t border-slate-800/50 bg-slate-950/50 px-4 py-2.5">
                  {col.links.map((link) => (
                    <div key={link.cle} className="py-1">
                      <FooterLinkItem link={link} />
                    </div>
                  ))}
                </nav>
              </details>
            ))}
          </div>
        </div>
        {/* =================================================
            BARRE BASSE — MOBILE / TABLETTE
            ================================================= */}
        <div className="lg:hidden">
          <div className="mb-3 mt-4 border-t border-slate-800/70" />

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="min-w-0 text-[9px] leading-4 text-slate-600">
                {t("footer.rights")}
              </span>

              <LanguageSwitcher
                tone="light"
                className="h-7 shrink-0 rounded-lg border border-slate-800 bg-white/[0.025] px-2 text-[10px] text-slate-400"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { Icon: Facebook, label: "Facebook" },
                { Icon: Instagram, label: "Instagram" },
                { Icon: Twitter, label: "X" },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  title={label}
                  className="grid size-8 place-items-center rounded-[10px] border border-slate-800 bg-white/[0.025] text-slate-500 transition-all duration-200 active:scale-95 active:bg-white/[0.06] active:text-white"
                >
                  <Icon className="size-3.5" />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* =================================================
            BARRE BASSE — DESKTOP INCHANGÉE
            ================================================= */}
        <div className="hidden lg:block">
          <div className="mb-2.5 mt-5 border-t border-slate-800/80" />

          <div className="flex min-w-0 flex-row items-center justify-between gap-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
              <span className="leading-4">{t("footer.rights")}</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <LanguageSwitcher tone="light" className="h-6 w-fit px-1.5 text-[10px] text-slate-400" />
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { Icon: Facebook, label: "Facebook" },
                { Icon: Instagram, label: "Instagram" },
                { Icon: Twitter, label: "X" },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  title={label}
                  className="grid size-7 place-items-center rounded-lg border border-slate-800 bg-slate-950/50 text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900 hover:text-white"
                >
                  <Icon className="size-3" />
                </span>
              ))}
            </div>
          </div>
        </div>
        <span className="sr-only">{langueCourante.nom}</span>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const isBackoffice = BACKOFFICE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  if (isBackoffice) return <div className="min-h-screen">{children}</div>;
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background">
      <Header />
      <main className="min-w-0 flex-1">{children}</main>
      <Footer />
    </div>
  );
}
