"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadPlans } from "@/features/checkout/api";
import type { PublicPlan } from "@/features/checkout/types";

function localizedText(
  value: Record<string, string> | null,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  return (
    value.fr ??
    value.FR ??
    value.en ??
    fallback
  );
}

function formatGnf(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(
    Number(value || 0),
  );
}

function planFeatures(plan: PublicPlan): string[] {
  const raw = plan.features as unknown;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item))
      .filter(Boolean)
      .slice(0, 6);
  }

  if (raw && typeof raw === "object") {
    const source = raw as Record<string, unknown>;

    const localized =
      source.fr ??
      source.FR ??
      source.en ??
      source.items;

    if (Array.isArray(localized)) {
      return localized
        .map((item) => String(item))
        .filter(Boolean)
        .slice(0, 6);
    }

    return Object.values(source)
      .filter(
        (item): item is string =>
          typeof item === "string" &&
          item.trim().length > 0,
      )
      .slice(0, 6);
  }

  return [];
}

function planAudienceLabel(plan: PublicPlan): string {
  if (plan.code === "pro") {
    return "Professionnels";
  }

  if (plan.code === "residentiel_standard") {
    return "Résidentiel";
  }

  return "Particuliers";
}

export default function PricingPage() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [audience, setAudience] = useState<"residentiel" | "professionnel" | "institutionnel">("residentiel");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    loadPlans(controller.signal)
      .then((items) => {
        setPlans(items);
        setError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Impossible de charger les offres.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const orderedPlans = useMemo(
    () =>
      [...plans].sort(
        (a, b) =>
          Number(a.position || 0) -
          Number(b.position || 0),
      ),
    [plans],
  );

  return (
    <main className="w-full">
      <section className="relative overflow-hidden bg-gradient-to-r from-[#203f78] via-[#245c8e] to-[#16a5ad] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.85)_1px,transparent_1px)] [background-size:18px_18px]"
        />

        <div className="relative mx-auto flex min-h-[160px] w-full max-w-[1500px] items-center justify-center px-4 py-5 sm:min-h-[170px] sm:px-6 sm:py-6 lg:min-h-[180px] lg:px-8 lg:py-6">
          <div className="w-full text-center">
            <h1 className="mx-auto text-[clamp(2rem,3.15vw,3rem)] font-extrabold leading-[1.03] tracking-[-0.035em] text-white lg:whitespace-nowrap">
              Des tarifs simples, en francs guinéens
            </h1>

            <p className="mx-auto mt-5 max-w-[1420px] text-[12px] leading-5 text-white/90 sm:text-[13px] lg:whitespace-nowrap lg:text-[14px]">
              Choisissez l&apos;offre adaptée à votre logement ou à votre commerce. Vous réglez sur place ou par Mobile Money, puis un agent agréé vient poser votre balise.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1180px] px-4 pb-6 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-6">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
            {([
              ["residentiel", "Résidentiel"],
              ["professionnel", "Professionnel"],
              ["institutionnel", "Institutionnel"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAudience(value)}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition sm:px-4 ${
                  audience === value
                    ? "bg-[#294c82] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="mt-8 flex items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Chargement des offres…
          </div>
        )}

        {error && (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {audience === "residentiel" && (
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  {
                    key: "numerique",
                    title: "Numérique seule",
                    description: "Votre adresse enregistrée, sans balise physique.",
                    price: (() => {
                      const plan = orderedPlans.find((item) => item.code === "numerique");
                      return plan ? `${formatGnf(plan.price_gnf)} GNF` : "40 000 GNF";
                    })(),
                    note: "paiement unique, sans abonnement",
                    popular: false,
                    features: [
                      "Numéro d’adresse unique GN-CKY-XXXXXX",
                      "Localisation GPS vérifiée",
                      "Partage du lien et de l’itinéraire",
                      "Aucune plaque installée",
                    ],
                    href: "/commander?plan=numerique",
                  },
                  {
                    key: "residentiel_standard",
                    title: "Résidentiel Standard",
                    description: "Plaque balise posée par un agent agréé.",
                    price: (() => {
                      const plan = orderedPlans.find((item) => item.code === "residentiel_standard");
                      return plan ? `${formatGnf(plan.price_gnf)} GNF` : "150 000 GNF";
                    })(),
                    note: "paiement unique, sans abonnement",
                    popular: true,
                    features: [
                      "Balise physique avec QR code",
                      "Pose par un agent Adresse GN",
                      "Repère GPS de précision",
                      "Fiche adresse et itinéraire",
                    ],
                    href: "/commander?plan=residentiel_standard",
                  },
                  {
                    key: "residentiel_premium",
                    title: "Résidentiel Premium",
                    description: "Balise renforcée et point d’accès détaillé.",
                    price: "300 000 GNF",
                    note: "paiement unique, sans abonnement",
                    popular: false,
                    features: [
                      "Balise renforcée longue durée",
                      "Pose prioritaire sous 72 h",
                      "Note d’accès détaillée (portail, étage)",
                      "Assistance au remplacement 12 mois",
                    ],
                    href: "/commander",
                  },
                ].map((offer) => (
                  <article
                    key={offer.key}
                    className={`relative flex min-h-[315px] flex-col rounded-2xl border bg-white p-4 transition ${
                      offer.popular
                        ? "border-[#19aaa9]/35 shadow-[0_14px_35px_rgba(15,23,42,0.14)]"
                        : "border-slate-200 shadow-sm"
                    }`}
                  >
                    {offer.popular && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#10b9a8] px-3 py-1 text-[10px] font-bold text-white">
                        Plus populaire
                      </span>
                    )}
                    <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-50 text-sm text-[#17aaa8]">⌂</div>
                    <h2 className="mt-3 text-[14px] font-bold text-slate-950">{offer.title}</h2>
                    <p className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500">{offer.description}</p>
                    <div className="mt-4">
                      <div className="text-[24px] font-extrabold tracking-tight text-[#294c82]">{offer.price}</div>
                      <p className="mt-1 text-[10px] text-slate-400">{offer.note}</p>
                    </div>
                    <ul className="mt-4 flex-1 space-y-1.5">
                      {offer.features.map((feature) => (
                        <li key={feature} className="flex gap-2 text-[11px] leading-4 text-slate-600">
                          <span className="mt-0.5 font-bold text-[#12aaa7]">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={offer.href}
                      className={`mt-4 inline-flex h-9 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${
                        offer.popular
                          ? "border-[#10aaa8] bg-[#10aaa8] text-white hover:bg-[#0d9997]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#10aaa8] hover:text-[#0d8f8d]"
                      }`}
                    >
                      Choisir
                    </Link>
                  </article>
                ))}
              </div>
            )}

            {audience === "professionnel" && (
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  ["Pro Basic", "350 000 GNF", "Pour un commerce ou un site professionnel.", ["Adresse GN professionnelle", "Balise avec QR code", "Fiche établissement", "Pose sur site"]],
                  ["Pro Plus", "600 000 GNF", "Pour les besoins renforcés et la visibilité métier.", ["Tout Pro Basic", "Traitement prioritaire", "Informations établissement enrichies", "Accompagnement personnalisé"]],
                  ["Multi-sites", "Sur devis", "Pour plusieurs agences, bureaux ou implantations.", ["Déploiement multi-sites", "Adresses centralisées", "Accompagnement de déploiement", "Intégration adaptée au besoin"]],
                ].map(([title, price, description, features], index) => (
                  <article
                    key={title as string}
                    className={`relative flex min-h-[305px] flex-col rounded-2xl border bg-white p-4 ${
                      index === 1
                        ? "border-[#19aaa9]/35 shadow-[0_14px_35px_rgba(15,23,42,0.14)]"
                        : "border-slate-200 shadow-sm"
                    }`}
                  >
                    {index === 1 && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#10b9a8] px-3 py-1 text-[10px] font-bold text-white">Plus populaire</span>
                    )}
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#294c82]">Professionnel</p>
                    <h2 className="mt-3 text-lg font-bold">{title as string}</h2>
                    <p className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500">{description as string}</p>
                    <div className="mt-3 text-[23px] font-extrabold tracking-tight text-[#294c82]">{price as string}</div>
                    <ul className="mt-4 flex-1 space-y-1.5">
                      {(features as string[]).map((feature) => (
                        <li key={feature} className="flex gap-2 text-[11px] text-slate-600">
                          <span className="font-bold text-[#12aaa7]">✓</span>{feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/commander?plan=pro"
                      className={`mt-4 inline-flex h-9 items-center justify-center rounded-lg border text-[11px] font-semibold ${
                        index === 1 ? "border-[#10aaa8] bg-[#10aaa8] text-white" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      Demander un devis
                    </Link>
                  </article>
                ))}
              </div>
            )}

            {audience === "institutionnel" && (
              <div className="mx-auto mt-7 max-w-3xl">
                <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#294c82]">Institutionnel</p>
                      <h2 className="mt-2 text-xl font-bold text-slate-950">Déploiement sur mesure</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                        Administrations, représentations, ONG et organisations : une offre adaptée à vos sites, à vos volumes et à vos contraintes de déploiement.
                      </p>
                      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <span>✓ Référencement des sites</span>
                        <span>✓ Déploiement coordonné</span>
                        <span>✓ Accompagnement dédié</span>
                        <span>✓ Offre chiffrée sur devis</span>
                      </div>
                    </div>
                    <Link href="/commander" className="inline-flex h-11 items-center justify-center rounded-lg bg-[#294c82] px-6 text-sm font-semibold text-white">
                      Demander un devis
                    </Link>
                  </div>
                </article>
              </div>
            )}

            <section className="mt-9">
              <div className="text-center">
                <h2 className="text-[22px] font-extrabold tracking-tight text-slate-950">Comparer les offres</h2>
                <p className="mt-1 text-[11px] text-slate-500">Ce que chaque formule inclut, en un coup d’œil.</p>
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] border-collapse text-[9.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                      {["Fonctionnalité","Numérique seule","Résidentiel Standard","Résidentiel Premium","Pro Basic","Pro Plus"].map((head) => (
                        <th key={head} className={`px-3 py-2 font-semibold ${head === "Fonctionnalité" ? "text-left" : ""}`}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-center text-slate-600">
                    {[
                      ["Numéro d’adresse unique","✓","✓","✓","✓","✓"],
                      ["Balise physique avec QR code","—","✓","✓","✓","✓"],
                      ["Pose par un agent agréé","—","✓","Prioritaire 72 h","✓","Prioritaire"],
                      ["Fiche établissement publique","—","—","—","Incluse","Incluse"],
                      ["Statistiques de consultation","—","—","—","30 jours","90 jours"],
                      ["Comptes d’équipe","—","—","—","—","✓"],
                      ["Abonnement mensuel","Aucun","Aucun","Aucun","50 000 GNF","100 000 GNF"],
                    ].map((row) => (
                      <tr key={row[0]} className="border-b border-slate-100 last:border-0">
                        {row.map((cell, index) => (
                          <td key={`${row[0]}-${index}`} className={`px-3 py-2 ${index === 0 ? "text-left font-medium text-slate-700" : ""}`}>
                            {cell === "✓" ? <span className="font-bold text-[#11aaa7]">✓</span> : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mx-auto mt-9 max-w-[760px]">
              <div className="text-center">
                <h2 className="text-[22px] font-extrabold tracking-tight text-slate-950">Questions fréquentes</h2>
              </div>
              <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <details className="group px-4 py-3">
                  <summary className="cursor-pointer list-none text-[13px] font-semibold text-slate-800">
                    <span className="flex items-center justify-between">Qu’est-ce qu’une balise Adresse GN ?<span className="text-slate-400">⌄</span></span>
                  </summary>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Une balise matérialise votre Adresse GN et permet d’ouvrir rapidement sa fiche et son itinéraire grâce au QR code.
                  </p>
                </details>
                <details className="group px-4 py-3">
                  <summary className="cursor-pointer list-none text-[13px] font-semibold text-slate-800">
                    <span className="flex items-center justify-between">Comment un livreur me trouve-t-il ?<span className="text-slate-400">⌄</span></span>
                  </summary>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Vous partagez votre numéro ou votre lien Adresse GN ; le destinataire ouvre la localisation et lance son itinéraire.
                  </p>
                </details>
              </div>
            </section>

            <section className="mt-9 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
              {[
                ["Vos données protégées","Adresse privée par défaut, conforme aux lois guinéennes applicables."],
                ["Paiement sécurisé","Encaissement par agent agréé ou Mobile Money, avec facture PDF."],
                ["Support en français","Une équipe joignable pour vous accompagner dans votre demande."],
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-[#10aaa8]">✓</span>
                  <div>
                    <h3 className="text-[11px] font-bold text-slate-800">{title}</h3>
                    <p className="mt-0.5 text-[9.5px] leading-4 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </section>

            <div className="mt-6 flex justify-center">
              <Link href="/" className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[11px] font-semibold text-slate-700 hover:border-slate-300">
                Retour à l’accueil
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
