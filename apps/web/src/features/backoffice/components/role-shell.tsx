"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Boxes,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Download,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareWarning,
  Package,
  ShieldCheck,
  Tags,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  getAccessToken,
  supabase,
} from "@/lib/supabase/browser";

import {
  BackofficeApiError,
  type BackofficeNavigationResponse,
  type BackofficeSpace,
  getBackofficeNavigation,
} from "../api";

import {
  LoadingState,
} from "./professional-ui";


const SPACE_LABELS:
  Record<BackofficeSpace, string> = {
    supervisor: "Supervision",
    ops: "Opérations",
    sales: "Commercial",
    support: "Support",
  };


const SPACE_ACCENTS:
  Record<BackofficeSpace, string> = {
    supervisor: "from-violet-500 to-indigo-500",
    ops: "from-cyan-500 to-teal-500",
    sales: "from-amber-400 to-orange-500",
    support: "from-rose-500 to-pink-500",
  };


function initials(
  name: string | null | undefined,
) {
  if (!name) {
    return "AG";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ?? "",
    )
    .join("");
}


function navIconFor(
  href: string,
  home: string,
): LucideIcon {
  if (href === home) {
    return LayoutDashboard;
  }

  if (
    href.includes("balises")
    || href.includes("beacons")
    || href.includes("stock")
  ) {
    return Boxes;
  }

  if (href.includes("commandes")) {
    return Package;
  }

  if (href.includes("exports")) {
    return Download;
  }

  if (href.includes("paiements")) {
    return CreditCard;
  }

  if (
    href.includes("clients")
    || href.includes("comptes")
  ) {
    return Users;
  }

  if (
    href.includes("offres")
    || href.includes("abonnements")
  ) {
    return Tags;
  }

  if (href.includes("planning")) {
    return CalendarDays;
  }

  if (href.includes("installations")) {
    return ClipboardCheck;
  }

  if (href.includes("terrain")) {
    return MapPinned;
  }

  if (
    href.includes("signalements")
    || href.includes("reclamations")
    || href.includes("claims")
  ) {
    return MessageSquareWarning;
  }

  if (
    href.includes("reports")
    || href.includes("report-")
  ) {
    return FileText;
  }

  return ListChecks;
}


export function RoleShell({
  space,
  children,
}: {
  space: BackofficeSpace;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [
    navigation,
    setNavigation,
  ] = useState<
    BackofficeNavigationResponse | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    forbidden,
    setForbidden,
  ] = useState(false);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);


  useEffect(() => {
    const controller =
      new AbortController();

    async function bootstrap() {
      setLoading(true);
      setForbidden(false);

      try {
        const token =
          await getAccessToken();

        if (!token) {
          router.replace(
            `/login?returnTo=${encodeURIComponent(pathname)}`,
          );
          return;
        }

        const result =
          await getBackofficeNavigation(
            token,
            space,
            controller.signal,
          );

        if (controller.signal.aborted) {
          return;
        }

        setNavigation(result);
      }
      catch(error) {
        if (controller.signal.aborted) {
          return;
        }

        if (
          error instanceof BackofficeApiError
          && error.statusCode === 401
        ) {
          router.replace(
            `/login?returnTo=${encodeURIComponent(pathname)}`,
          );
          return;
        }

        setForbidden(true);
      }
      finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      controller.abort();
    };
  }, [
    pathname,
    router,
    space,
  ]);


  const currentItem =
    useMemo(
      () =>
        navigation
          ?.items
          .find(
            (item) =>
              pathname === item.href
              || (
                item.href !== navigation.home
                && pathname.startsWith(
                  `${item.href}/`,
                )
              ),
          ) ?? null,
      [
        navigation,
        pathname,
      ],
    );


  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }


  if (loading) {
    return (
      <div className="backoffice-canvas min-h-screen p-4 sm:p-8">
        <div className="mx-auto max-w-3xl pt-20">
          <LoadingState label="Ouverture de votre espace Adresse GN…" />
        </div>
      </div>
    );
  }


  if (
    forbidden
    || !navigation
  ) {
    return (
      <div className="backoffice-canvas flex min-h-screen items-center justify-center px-6">
        <div className="backoffice-shell-shadow max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-rose-600" />

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
            Accès refusé
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Votre rôle ne permet pas d’accéder à cet espace Adresse GN.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-[#1E3660] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2E4A7B]"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }


  const userName =
    navigation.user.full_name
    || navigation.user.role;

  const nav = (
    <nav className="space-y-1.5 p-3">
      {navigation.items.map((item) => {
        const active =
          pathname === item.href
          || (
            item.href !== navigation.home
            && pathname.startsWith(
              `${item.href}/`,
            )
          );

        const Icon =
          navIconFor(
            item.href,
            navigation.home,
          );

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() =>
              setMobileOpen(false)
            }
            className={[
              "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition duration-200",
              active
                ? "bg-white/12 font-semibold text-white shadow-sm ring-1 ring-white/10"
                : "text-slate-300 hover:bg-white/7 hover:text-white",
            ].join(" ")}
          >
            {active ? (
              <span
                className={[
                  "absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b",
                  SPACE_ACCENTS[space],
                ].join(" ")}
              />
            ) : null}

            <span
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                active
                  ? "bg-white/12 text-white"
                  : "bg-white/[0.04] text-slate-400 group-hover:bg-white/8 group-hover:text-white",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
            </span>

            <span className="min-w-0 flex-1 truncate">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );


  const brand = (
    <div className="flex h-20 items-center gap-3 border-b border-white/8 px-5">
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white text-xs font-black tracking-tight text-[#1E3660] shadow-lg shadow-black/10">
        AGN
        <span
          className={[
            "absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r",
            SPACE_ACCENTS[space],
          ].join(" ")}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          Adresse GN
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {SPACE_LABELS[space]}
        </p>
      </div>
    </div>
  );


  return (
    <div className="backoffice-canvas flex min-h-screen">
      <aside className="backoffice-sidebar hidden w-[292px] shrink-0 overflow-y-auto lg:block">
        <div className="sticky top-0">
          {brand}
        </div>

        <div className="px-3 pb-2 pt-5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Navigation
          </p>
        </div>

        {nav}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() =>
              setMobileOpen(false)
            }
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
          />

          <aside className="backoffice-sidebar relative h-full w-[86%] max-w-[320px] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/8 pr-4">
              {brand}

              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() =>
                  setMobileOpen(false)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/7 text-slate-300 transition hover:bg-white/12 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 pb-2 pt-5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Navigation
              </p>
            </div>

            {nav}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/88 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() =>
                setMobileOpen(true)
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#2E4A7B]">
                {SPACE_LABELS[space]}
              </p>

              <p className="truncate text-base font-semibold text-slate-950">
                {currentItem?.label
                  || "Tableau de bord"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-52 truncate text-sm font-semibold text-slate-900">
                {userName}
              </p>
              <p className="text-xs capitalize text-slate-500">
                {navigation.user.role}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E4A7B]/10 text-xs font-bold text-[#2E4A7B]">
              {initials(userName)}
            </div>

            <button
              type="button"
              aria-label="Se déconnecter"
              onClick={() =>
                void logout()
              }
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">
                Déconnexion
              </span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1680px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
