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

import type {
  LucideIcon,
} from "lucide-react";

import {
  Flag,
  Heart,
  LayoutDashboard,
  LogOut,
  QrCode,
  Receipt,
  Settings,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  supabase,
} from "@/lib/supabase/browser";

import {
  cn,
} from "@/lib/utils";


type OwnerSection = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  exact?: boolean;
};


const SECTIONS: readonly OwnerSection[] = [
  {
    href: "/mon-compte",
    label: "Tableau de bord",
    mobileLabel: "Accueil",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/mon-compte/beacons",
    label: "Mes balises",
    mobileLabel: "Balises",
    icon: QrCode,
  },
  {
    href: "/mon-compte/favorites",
    label: "Mes favoris",
    mobileLabel: "Favoris",
    icon: Heart,
  },
  {
    href: "/mon-compte/commandes",
    label: "Commandes",
    mobileLabel: "Commandes",
    icon: Receipt,
  },
  {
    href: "/mon-compte/reports",
    label: "Signalements",
    mobileLabel: "Signalements",
    icon: Flag,
  },
  {
    href: "/mon-compte/settings",
    label: "Paramètres",
    mobileLabel: "Paramètres",
    icon: Settings,
  },
];


function isActive(
  pathname: string,
  href: string,
  exact = false,
) {
  if (exact) {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}


export function OwnerShell({
  children,
}: {
  children: ReactNode;
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    email,
    setEmail,
  ] = useState<
    string | null
  >(null);


  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data,
      } =
        await supabase.auth
          .getSession();

      if (!mounted) {
        return;
      }

      if (!data.session) {
        const returnTo =
          encodeURIComponent(
            pathname ||
            "/mon-compte",
          );

        router.replace(
          `/login?returnTo=${returnTo}`,
        );

        return;
      }

      setEmail(
        data.session.user.email ??
        null,
      );

      setLoading(false);
    }

    void bootstrap();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            session,
          ) => {
            if (!mounted) {
              return;
            }

            if (!session) {
              const returnTo =
                encodeURIComponent(
                  pathname ||
                  "/mon-compte",
                );

              router.replace(
                `/login?returnTo=${returnTo}`,
              );

              return;
            }

            setEmail(
              session.user.email ??
              null,
            );

            setLoading(false);
          },
        );

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, [
    pathname,
    router,
  ]);


  async function signOut() {
    await supabase.auth
      .signOut();

    router.replace("/");
  }


  if (loading) {
    return (
      <div
        className="
          flex min-h-[100dvh]
          items-center justify-center
          bg-slate-50
        "
      >
        <div
          className="
            size-10
            animate-spin
            rounded-full
            border-2
            border-blue-100
            border-t-blue-600
          "
        />
      </div>
    );
  }


  const initials =
    email
      ?.slice(0, 2)
      .toUpperCase()
    ?? "GN";


  return (
    <div
      className="
        flex min-h-[100dvh]
        flex-col
        bg-gradient-to-br
        from-slate-50
        via-blue-50/40
        to-violet-50/40
      "
    >
      <header
        className="
          sticky top-0 z-30
          border-b
          border-slate-200/80
          bg-white/90
          shadow-sm
          backdrop-blur-xl
        "
      >
        <div
          className="
            mx-auto flex
            w-full max-w-7xl
            items-center
            justify-between
            gap-4
            px-4 py-4
            lg:px-6
          "
        >
          <div
            className="
              flex items-center
              gap-3
            "
          >
            <span
              className="
                flex size-11
                items-center
                justify-center
                rounded-2xl
                bg-gradient-to-br
                from-blue-600
                via-indigo-600
                to-violet-600
                text-sm
                font-bold
                text-white
                shadow-lg
                shadow-blue-600/20
              "
            >
              {initials}
            </span>

            <div
              className="
                min-w-0
                leading-tight
              "
            >
              <p
                className="
                  text-sm
                  font-semibold
                  text-slate-950
                "
              >
                Mon compte
              </p>

              <p
                className="
                  max-w-[15rem]
                  truncate
                  pt-1
                  text-xs
                  text-slate-500
                "
              >
                {email}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="
              rounded-xl
              border-slate-200
              bg-white
              px-4
              shadow-sm
              transition
              hover:border-blue-200
              hover:bg-blue-50
              hover:text-blue-700
            "
          >
            <LogOut
              className="
                size-4
              "
            />

            <span
              className="
                hidden sm:inline
              "
            >
              Déconnexion
            </span>
          </Button>
        </div>
      </header>

      <div
        className="
          mx-auto flex
          w-full max-w-7xl
          flex-1
          gap-7
          px-4 py-6
          lg:px-6 lg:py-8
        "
      >
        <aside
          className="
            hidden w-60
            shrink-0
            md:block
          "
        >
          <nav
            className="
              sticky top-28
              space-y-1.5
              rounded-2xl
              border
              border-white/80
              bg-white/75
              p-2
              shadow-sm
              backdrop-blur
            "
          >
            {SECTIONS.map(
              ({
                href,
                label,
                icon: Icon,
                exact,
              }) => {
                const active =
                  isActive(
                    pathname,
                    href,
                    exact,
                  );

                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      `
                        group flex
                        items-center
                        gap-3
                        rounded-xl
                        px-3.5 py-3
                        text-sm
                        font-medium
                        text-slate-500
                        transition-all
                        duration-200
                        hover:bg-slate-50
                        hover:text-slate-900
                      `,
                      active &&
                        `
                          bg-gradient-to-r
                          from-blue-50
                          to-indigo-50
                          text-blue-700
                          shadow-sm
                          ring-1
                          ring-blue-100
                        `,
                    )}
                  >
                    <span
                      className={cn(
                        `
                          flex size-8
                          items-center
                          justify-center
                          rounded-lg
                          text-slate-400
                          transition
                          group-hover:bg-white
                          group-hover:text-slate-700
                        `,
                        active &&
                          `
                            bg-white
                            text-blue-600
                            shadow-sm
                          `,
                      )}
                    >
                      <Icon
                        className="
                          size-[17px]
                        "
                      />
                    </span>

                    <span>
                      {label}
                    </span>
                  </Link>
                );
              },
            )}
          </nav>
        </aside>

        <main
          className="
            min-w-0
            flex-1
            pb-24
            md:pb-0
          "
        >
          {children}
        </main>
      </div>

      <nav
        className="
          fixed inset-x-0
          bottom-0 z-30
          border-t
          border-slate-200
          bg-white/95
          shadow-[0_-8px_30px_rgba(15,23,42,0.06)]
          backdrop-blur-xl
          md:hidden
        "
        style={{
          paddingBottom:
            "env(safe-area-inset-bottom)",
        }}
      >
        <div
          className="
            grid grid-cols-5
          "
        >
          {SECTIONS.map(
            ({
              href,
              mobileLabel,
              icon: Icon,
              exact,
            }) => {
              const active =
                isActive(
                  pathname,
                  href,
                  exact,
                );

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    `
                      flex flex-col
                      items-center
                      gap-1 py-2.5
                      text-[10px]
                      font-medium
                      text-slate-400
                    `,
                    active &&
                      `
                        text-blue-600
                      `,
                  )}
                >
                  <span
                    className={cn(
                      `
                        flex size-8
                        items-center
                        justify-center
                        rounded-xl
                      `,
                      active &&
                        `
                          bg-blue-50
                        `,
                    )}
                  >
                    <Icon
                      className="
                        size-[18px]
                      "
                    />
                  </span>

                  {mobileLabel}
                </Link>
              );
            },
          )}
        </div>
      </nav>
    </div>
  );
}
