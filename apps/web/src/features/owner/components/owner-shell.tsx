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
            "/mon-compte/beacons",
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
                  "/mon-compte/beacons",
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
          bg-background
        "
      >
        <div
          className="
            h-9 w-9
            animate-spin
            rounded-full
            border-2
            border-muted
            border-t-primary
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
        flex-col bg-background
      "
    >
      <header
        className="
          sticky top-0 z-20
          border-b border-border
          bg-card
        "
      >
        <div
          className="
            mx-auto flex
            max-w-5xl
            items-center
            justify-between
            gap-3
            px-4 py-3
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
                flex size-9
                items-center
                justify-center
                rounded-full
                bg-primary
                text-sm
                font-bold
                text-primary-foreground
              "
            >
              {initials}
            </span>

            <div
              className="
                leading-tight
              "
            >
              <p
                className="
                  text-sm
                  font-medium
                  text-foreground
                "
              >
                Mon compte
              </p>

              <p
                className="
                  max-w-[12rem]
                  truncate
                  text-xs
                  text-muted-foreground
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
          >
            <LogOut
              className="size-4"
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
          w-full max-w-5xl
          flex-1 gap-6
          px-4 py-6
        "
      >
        <nav
          className="
            hidden w-56
            shrink-0
            flex-col gap-1
            md:flex
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
                      flex
                      items-center
                      gap-2
                      rounded-md
                      px-3 py-2
                      text-sm
                      text-muted-foreground
                      hover:bg-muted
                    `,
                    active &&
                      `
                        bg-muted
                        font-medium
                        text-foreground
                      `,
                  )}
                >
                  <Icon
                    className="size-4"
                  />

                  {label}
                </Link>
              );
            },
          )}
        </nav>

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
          bottom-0 z-20
          border-t border-border
          bg-card
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
                      gap-1 py-2
                      text-[10px]
                      text-muted-foreground
                    `,
                    active &&
                      `
                        font-medium
                        text-primary
                      `,
                  )}
                >
                  <Icon
                    className="size-5"
                  />

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