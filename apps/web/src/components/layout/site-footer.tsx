import Link from "next/link";
import {
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Twitter,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";

const WHATSAPP_SERVICE = "224620000000";

const footerColumns = [
  {
    title: "Produit",
    links: [
      { label: "Nos offres", href: "/tarifs" },
      { label: "Particuliers", href: "/a-propos#particuliers" },
      { label: "Entreprises", href: "/a-propos#pros" },
      { label: "API Adresse GN", href: "/a-propos#api" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Comment ça marche", href: "/#comment-ca-marche" },
      { label: "FAQ", href: "/faq" },
      { label: "Blog", href: "/blog" },
      { label: "Centre d’aide", href: "mailto:contact@adresse.gn" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/a-propos" },
      { label: "Contact", href: "mailto:contact@adresse.gn" },
      { label: "Partenaires", href: "/a-propos#partenaires" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Confidentialité", href: "/confidentialite" },
      { label: "Mentions légales", href: "/confidentialite" },
      { label: "Conditions d’utilisation", href: "/confidentialite" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-slate-300">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-0 size-[260px] rounded-full bg-blue-900/10 blur-[100px]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-0 size-[260px] rounded-full bg-cyan-900/10 blur-[100px]"
      />

      <div className="relative mx-auto w-full max-w-[1760px] px-4 py-10 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div>
            <Logo tone="light" />

            <p className="mt-4 max-w-[290px] text-sm leading-6 text-slate-400">
              Un numéro unique pour localiser, partager et rejoindre facilement
              chaque adresse en Guinée.
            </p>

            <div className="mt-5 grid gap-2.5 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="size-4 text-slate-500" />
                Conakry, Guinée
              </div>

              <a
                href="mailto:contact@adresse.gn"
                className="flex w-fit items-center gap-2 text-slate-300 transition-colors hover:text-cyan-300"
              >
                <Mail className="size-4 text-slate-500" />
                contact@adresse.gn
              </a>

              <a
                href={`https://wa.me/${WHATSAPP_SERVICE}`}
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-2 text-slate-300 transition-colors hover:text-cyan-300"
              >
                <MessageCircle className="size-4 text-slate-500" />
                WhatsApp
              </a>
            </div>

            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold text-cyan-300">
              <span className="size-1.5 rounded-full bg-cyan-300" />
              Déploiement Adresse GN
            </span>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {column.title}
              </h2>

              <nav className="flex flex-col gap-2.5">
                {column.links.map((link) =>
                  link.href.startsWith("mailto:") ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className="w-fit text-xs text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="w-fit text-xs text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </nav>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-slate-800 pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500">
              © {new Date().getFullYear()} Adresse GN. Tous droits réservés.
            </p>

            <div className="flex items-center gap-2">
              <span className="mr-2 rounded-md border border-slate-800 px-2 py-1 text-[10px] text-slate-400">
                FR
              </span>

              {[
                { Icon: Facebook, label: "Facebook" },
                { Icon: Instagram, label: "Instagram" },
                { Icon: Twitter, label: "X" },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  title={label}
                  aria-label={label}
                  className="grid size-8 place-items-center rounded-lg border border-slate-800 text-slate-500"
                >
                  <Icon className="size-3.5" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}