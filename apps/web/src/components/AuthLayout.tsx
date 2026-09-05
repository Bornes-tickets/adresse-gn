import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/logo";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Écran d'authentification historique Adresse GN :
 * formulaire à gauche et panneau de marque à droite.
 *
 * L'apparence reprend volontairement l'interface historique.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-[calc(100vh-5rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-sm">
          <h1 className="text-display text-3xl font-extrabold text-foreground">
            {title}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>

          <div className="mt-8">
            {children}
          </div>

          {footer && (
            <div className="mt-6 text-sm text-muted-foreground">
              {footer}
            </div>
          )}

          <p className="mt-10 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-accent" />
            Vos données restent privées par défaut.
          </p>
        </div>
      </div>

      <div className="gradient-signature relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 text-white/25 opacity-40"
        />

        <Link
          href="/"
          className="relative"
          aria-label="Retour à l'accueil Adresse GN"
        >
          <Logo
            tone="light"
            withTagline
          />
        </Link>

        <div className="relative max-w-md">
          <blockquote className="text-display text-3xl font-bold leading-tight text-white">
            « Une adresse n&apos;est pas un détail administratif.
            C&apos;est la condition pour être livré, secouru, visité. »
          </blockquote>

          <p className="mt-6 text-sm text-white/70">
            Adresse GN — système d&apos;adressage guinéen, pilote 2026.
          </p>
        </div>

        <p className="relative font-mono text-xs uppercase tracking-[0.2em] text-white/60">
          Un lieu, un numéro, un itinéraire
        </p>
      </div>
    </div>
  );
}
