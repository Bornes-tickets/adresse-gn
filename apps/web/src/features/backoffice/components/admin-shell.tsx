"use client";

import type {
  ReactNode,
} from "react";

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
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";

import {
  getAccessToken,
  supabase,
} from "@/lib/supabase/browser";

import {
  BackofficeApiError,
  type BackofficeIdentity,
  getBackofficeMe,
} from "../api";


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
        {
          href: "/admin",
          label: "Tableau de bord",
        },
        {
          href: "/admin/analytics",
          label: "Analytics",
        },
        {
          href: "/admin/audit",
          label: "Audit",
        },
      ],
    },
    {
      label: "Référentiel",
      items: [
        {
          href: "/admin/balises",
          label: "Balises",
        },
        {
          href: "/admin/adresses",
          label: "Adresses",
        },
        {
          href: "/admin/agents",
          label: "Agents",
        },
        {
          href: "/admin/users",
          label: "Utilisateurs",
        },
        {
          href: "/admin/zones",
          label: "Zones",
        },
      ],
    },
    {
      label: "Opérations",
      items: [
        {
          href: "/supervisor/installations",
          label: "Installations / QC",
        },
        {
          href: "/admin/justificatifs",
          label: "Justificatifs",
        },
        {
          href: "/ops/commandes-fournisseurs",
          label: "Lots & fournisseurs",
        },
        {
          href: "/support/signalements",
          label: "Signalements",
        },
        {
          href: "/support/reclamations",
          label: "Réclamations",
        },
        {
          href: "/sales/paiements",
          label: "Paiements",
        },
        {
          href: "/sales/abonnements",
          label: "Abonnements",
        },
      ],
    },
    {
      label: "CMS",
      items: [
        {
          href: "/admin/cms",
          label: "Vue d’ensemble",
        },
        {
          href: "/admin/cms/blog",
          label: "Blog",
        },
        {
          href: "/admin/cms/faq",
          label: "FAQ",
        },
        {
          href: "/admin/cms/pages",
          label: "Pages",
        },
        {
          href: "/admin/cms/tarifs",
          label: "Tarifs",
        },
        {
          href: "/admin/cms/traductions",
          label: "Traductions",
        },
      ],
    },
  ];


function routeIsActive(
  pathname: string,
  href: string,
) {
  if(href === "/admin"){
    return pathname === href;
  }

  return (
    pathname === href
    || pathname.startsWith(
      `${href}/`,
    )
  );
}


export function AdminShell({
  children,
}: {
  children: ReactNode;
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

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

    async function bootstrap(){
      try{
        const token =
          await getAccessToken();

        if(!token){
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

        if(
          controller.signal.aborted
        ){
          return;
        }

        if(
          me.user.role !== "admin"
          && me.user.role
            !== "super_admin"
        ){
          setForbidden(true);

          return;
        }

        setIdentity(
          me.user,
        );
      }
      catch(error){
        if(
          controller.signal.aborted
        ){
          return;
        }

        if(
          error instanceof
            BackofficeApiError
          && error.statusCode === 401
        ){
          router.replace(
            "/login?returnTo=%2Fadmin",
          );

          return;
        }

        setForbidden(true);
      }
      finally{
        if(
          !controller.signal.aborted
        ){
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      controller.abort();
    };
  },[
    router,
  ]);


  const currentLabel =
    useMemo(
      () => {
        for(
          const group
          of ADMIN_NAV
        ){
          for(
            const item
            of group.items
          ){
            if(
              routeIsActive(
                pathname,
                item.href,
              )
            ){
              return item.label;
            }
          }
        }

        return "Administration";
      },
      [pathname],
    );


  async function logout(){
    await supabase.auth.signOut();

    router.replace(
      "/login",
    );
  }


  if(loading){
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }


  if(
    forbidden
    || !identity
  ){
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-red-600" />

          <h1 className="mt-5 text-2xl font-semibold">
            Accès refusé
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            Cet espace est réservé aux administrateurs Adresse GN.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }


  const nav = (
    <nav className="space-y-6 p-3">
      {ADMIN_NAV.map(
        (group) => (
          <section
            key={group.label}
          >
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {group.label}
            </p>

            <div className="space-y-1">
              {group.items.map(
                (item) => {
                  const active =
                    routeIsActive(
                      pathname,
                      item.href,
                    );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() =>
                        setMobileOpen(
                          false,
                        )
                      }
                      className={[
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                        active
                          ? "bg-slate-900 font-medium text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                      ].join(" ")}
                    >
                      {item.href
                        === "/admin"
                        ? (
                            <LayoutDashboard className="h-4 w-4" />
                          )
                        : (
                            <span className="h-2 w-2 rounded-full bg-current opacity-50" />
                          )}

                      {item.label}
                    </Link>
                  );
                },
              )}
            </div>
          </section>
        ),
      )}
    </nav>
  );


  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-72 shrink-0 overflow-y-auto border-r bg-white lg:block">
        <div className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-white px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
            AGN
          </div>

          <div>
            <p className="text-sm font-semibold">
              Adresse GN
            </p>

            <p className="text-xs text-slate-500">
              Administration
            </p>
          </div>
        </div>

        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() =>
              setMobileOpen(false)
            }
            className="absolute inset-0 bg-black/40"
          />

          <aside className="relative h-full w-80 overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4">
              <div>
                <p className="font-semibold">
                  Adresse GN
                </p>

                <p className="text-xs text-slate-500">
                  Administration
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMobileOpen(false)
                }
                className="rounded-lg border p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() =>
                setMobileOpen(true)
              }
              className="rounded-lg border p-2 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-xs text-slate-500">
                Administration
              </p>

              <p className="font-semibold text-slate-900">
                {currentLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {identity.full_name
                  || "Administrateur"}
              </p>

              <p className="text-xs text-slate-500">
                {identity.role
                  === "super_admin"
                  ? "Super administrateur"
                  : "Administrateur"}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void logout()
              }
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <LogOut className="h-4 w-4" />

              <span className="hidden sm:inline">
                Déconnexion
              </span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}