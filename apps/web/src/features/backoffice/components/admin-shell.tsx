"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  BarChart3,
  BookOpenText,
  Boxes,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareWarning,
  ShieldCheck,
  Tags,
  Users,
  UserRoundCog,
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
  type BackofficeIdentity,
  getBackofficeMe,
} from "../api";

import {
  LoadingState,
} from "./professional-ui";


type AdminNavItem = {
  href: string;
  label: string;
};


type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};


const ADMIN_NAV:
  AdminNavGroup[] = [
    {
      label: "Pilotage",
      items: [
        { href: "/admin", label: "Tableau de bord" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/audit", label: "Audit" },
      ],
    },
    {
      label: "Référentiel",
      items: [
        { href: "/admin/balises", label: "Balises" },
        { href: "/admin/adresses", label: "Adresses" },
        { href: "/admin/agents", label: "Agents" },
        { href: "/admin/users", label: "Utilisateurs" },
        { href: "/admin/zones", label: "Zones" },
      ],
    },
    {
      label: "Opérations",
      items: [
        { href: "/supervisor/installations", label: "Installations / QC" },
        { href: "/admin/justificatifs", label: "Justificatifs" },
        { href: "/ops/commandes-fournisseurs", label: "Lots & fournisseurs" },
        { href: "/support/signalements", label: "Signalements" },
        { href: "/support/reclamations", label: "Réclamations" },
        { href: "/sales/paiements", label: "Paiements" },
        { href: "/sales/abonnements", label: "Abonnements" },
      ],
    },
    {
      label: "CMS",
      items: [
        { href: "/admin/cms", label: "Vue d’ensemble" },
        { href: "/admin/cms/blog", label: "Blog" },
        { href: "/admin/cms/faq", label: "FAQ" },
        { href: "/admin/cms/pages", label: "Pages" },
        { href: "/admin/cms/tarifs", label: "Tarifs" },
        { href: "/admin/cms/traductions", label: "Traductions" },
      ],
    },
  ];


function routeIsActive(
  pathname: string,
  href: string,
) {
  if (href === "/admin") {
    return pathname === href;
  }

  return (
    pathname === href
    || pathname.startsWith(
      `${href}/`,
    )
  );
}


function initials(
  name: string | null | undefined,
) {
  if (!name) {
    return "AD";
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
): LucideIcon {
  if (href === "/admin") {
    return LayoutDashboard;
  }
  if (href.includes("analytics")) {
    return BarChart3;
  }
  if (href.includes("audit")) {
    return FileCheck2;
  }
  if (
    href.includes("balises")
    || href.includes("beacons")
  ) {
    return Boxes;
  }
  if (
    href.includes("adresses")
    || href.includes("addresses")
    || href.includes("zones")
  ) {
    return MapPinned;
  }
  if (href.includes("agents")) {
    return UserRoundCog;
  }
  if (href.includes("users")) {
    return Users;
  }
  if (href.includes("installations")) {
    return ClipboardCheck;
  }
  if (href.includes("justificatifs")) {
    return FileText;
  }
  if (
    href.includes("signalements")
    || href.includes("reclamations")
  ) {
    return MessageSquareWarning;
  }
  if (href.includes("paiements")) {
    return CreditCard;
  }
  if (
    href.includes("abonnements")
    || href.includes("tarifs")
  ) {
    return Tags;
  }
  if (
    href.includes("/cms")
    || href.includes("blog")
    || href.includes("faq")
    || href.includes("traductions")
  ) {
    return BookOpenText;
  }

  return ListChecks;
}


export function AdminShell({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [
    identity,
    setIdentity,
  ] = useState<
    BackofficeIdentity | null
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
      try {
        const token =
          await getAccessToken();

        if (!token) {
          router.replace(
            "/login?returnTo=%2Fadmin",
          );
          return;
        }

        const me =
          await getBackofficeMe(
            token,
            controller.signal,
          );

        if (controller.signal.aborted) {
          return;
        }

        if (
          me.user.role !== "admin"
          && me.user.role !== "super_admin"
        ) {
          setForbidden(true);
          return;
        }

        setIdentity(me.user);
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
            "/login?returnTo=%2Fadmin",
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
    router,
  ]);


  const currentLabel =
    useMemo(
      () => {
        for (const group of ADMIN_NAV) {
          for (const item of group.items) {
            if (
              routeIsActive(
                pathname,
                item.href,
              )
            ) {
              return item.label;
            }
          }
        }

        return "Administration";
      },
      [
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
          <LoadingState label="Ouverture de l’administration Adresse GN…" />
        </div>
      </div>
    );
  }


  if (
    forbidden
    || !identity
  ) {
    return (
      <div className="backoffice-canvas flex min-h-screen items-center justify-center px-6">
        <div className="backoffice-shell-shadow max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-rose-600" />

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
            Accès refusé
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Cet espace est réservé aux administrateurs Adresse GN.
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
    identity.full_name
    || "Administrateur";

  const nav = (
    <nav className="space-y-6 p-3">
      {ADMIN_NAV.map((group) => (
        <section key={group.label}>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {group.label}
          </p>

          <div className="space-y-1.5">
            {group.items.map((item) => {
              const active =
                routeIsActive(
                  pathname,
                  item.href,
                );

              const Icon =
                navIconFor(item.href);

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
                    <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-teal-400" />
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
          </div>
        </section>
      ))}
    </nav>
  );


  const brand = (
    <div className="flex h-20 items-center gap-3 border-b border-white/8 px-5">
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white text-xs font-black tracking-tight text-[#1E3660] shadow-lg shadow-black/10">
        AGN
        <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-cyan-400 to-teal-400" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          Adresse GN
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          Administration
        </p>
      </div>
    </div>
  );


  return (
    <div className="backoffice-canvas flex min-h-screen">
      <aside className="backoffice-sidebar hidden w-[292px] shrink-0 overflow-y-auto lg:block">
        <div className="sticky top-0 z-10">
          {brand}
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
                Administration
              </p>
              <p className="truncate text-base font-semibold text-slate-950">
                {currentLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-52 truncate text-sm font-semibold text-slate-900">
                {userName}
              </p>
              <p className="text-xs text-slate-500">
                {identity.role === "super_admin"
                  ? "Super administrateur"
                  : "Administrateur"}
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
