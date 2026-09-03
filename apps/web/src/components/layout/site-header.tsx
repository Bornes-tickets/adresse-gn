"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navigation = [
  {
    label: "Comment ça marche",
    href: "/#comment-ca-marche",
  },
  {
    label: "Nos offres",
    href: "/tarifs",
  },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-white/95 shadow-[0_2px_12px_rgba(15,23,42,0.06)] backdrop-blur-md">
      <div className="mx-auto grid h-16 w-full max-w-[1760px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16">
        <Link href="/" aria-label="Accueil Adresse GN" className="min-w-0">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <nav
            className="mr-2 hidden items-center gap-1 md:flex"
            aria-label="Navigation principale"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <span
            className="hidden h-9 items-center rounded-md px-2.5 text-xs font-semibold text-muted-foreground sm:flex"
            aria-label="Langue actuelle : français"
          >
            FR
          </span>

          <Button
            asChild
            variant="ghost"
            className="hidden h-11 font-medium sm:inline-flex"
          >
            <Link href="/login">Se connecter</Link>
          </Button>

          <Button
            asChild
            className="hidden h-11 bg-accent text-accent-foreground shadow-sm transition-transform hover:scale-[1.02] hover:bg-[#0B7F7E] active:scale-[0.98] sm:inline-flex"
          >
            <Link href="/commander">Créer mon Adresse GN</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[290px]">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>

              <div className="px-4">
                <Button
                  asChild
                  className="mt-4 h-12 w-full bg-accent text-accent-foreground hover:bg-[#0B7F7E]"
                >
                  <Link href="/commander">Créer mon Adresse GN</Link>
                </Button>

                <nav
                  className="mt-5 flex flex-col gap-1"
                  aria-label="Navigation mobile"
                >
                  {navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {item.label}
                    </Link>
                  ))}

                  <Link
                    href="/login"
                    className="rounded-lg px-3 py-3 text-base font-medium text-accent transition-colors hover:bg-muted"
                  >
                    Se connecter
                  </Link>
                </nav>

                <div className="mt-6 border-t pt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Langue
                  </p>

                  <span className="inline-flex rounded-md border px-3 py-2 text-sm font-medium">
                    Français
                  </span>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}