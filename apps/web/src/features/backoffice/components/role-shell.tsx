"use client";

import type {
  ReactNode,
} from "react";

import {
  useEffect,
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
  type BackofficeNavigationResponse,
  type BackofficeSpace,
  getBackofficeNavigation,
} from "../api";


const SPACE_LABELS:
  Record<BackofficeSpace, string> = {
    supervisor: "Supervision",
    ops: "Opérations",
    sales: "Commercial",
    support: "Support",
  };


export function RoleShell({
  space,
  children,
}: {
  space: BackofficeSpace;
  children: ReactNode;
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

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

        if(
          controller.signal.aborted
        ){
          return;
        }

        setNavigation(result);
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
            `/login?returnTo=${encodeURIComponent(pathname)}`,
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
    pathname,
    router,
    space,
  ]);


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
    || !navigation
  ){
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-red-600" />

          <h1 className="mt-5 text-2xl font-semibold">
            Accès refusé
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            Votre rôle ne permet pas d’accéder à cet espace Adresse GN.
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
    <nav className="space-y-1 p-3">
      {navigation.items.map(
        (item) => {
          const active =
            pathname === item.href
            || (
              item.href !==
                navigation.home
              && pathname.startsWith(
                `${item.href}/`,
              )
            );

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() =>
                setMobileOpen(false)
              }
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-slate-900 font-medium text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              ].join(" ")}
            >
              {item.href ===
                navigation.home
                ? (
                    <LayoutDashboard className="h-4 w-4" />
                  )
                : (
                    <span className="h-2 w-2 rounded-full bg-current opacity-50" />
                  )}

              <span>
                {item.label}
              </span>
            </Link>
          );
        },
      )}
    </nav>
  );


  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-72 shrink-0 border-r bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
            AGN
          </div>

          <div>
            <p className="text-sm font-semibold">
              Adresse GN
            </p>

            <p className="text-xs text-slate-500">
              {SPACE_LABELS[space]}
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

          <aside className="relative h-full w-72 bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div>
                <p className="font-semibold">
                  Adresse GN
                </p>

                <p className="text-xs text-slate-500">
                  {SPACE_LABELS[space]}
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setMobileOpen(true)
              }
              className="rounded-lg border p-2 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div>
              <p className="text-sm font-semibold text-slate-950">
                {SPACE_LABELS[space]}
              </p>

              <p className="text-xs text-slate-500">
                {navigation.user.full_name
                  || navigation.user.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void logout()
            }
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              Déconnexion
            </span>
          </button>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}