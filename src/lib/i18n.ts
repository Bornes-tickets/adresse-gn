import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import arAddress from "@/locales/ar.address.json";
import arCheckout from "@/locales/ar.checkout.json";
import ar from "@/locales/ar.json";
import arPricing from "@/locales/ar.pricing.json";
import enAddress from "@/locales/en.address.json";
import enCheckout from "@/locales/en.checkout.json";
import en from "@/locales/en.json";
import enPricing from "@/locales/en.pricing.json";
import frAddress from "@/locales/fr.address.json";
import frCheckout from "@/locales/fr.checkout.json";
import fr from "@/locales/fr.json";
import frPricing from "@/locales/fr.pricing.json";


export const LANGUES = [
  { code: "fr", label: "FR", nom: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", nom: "العربية", dir: "rtl" },
  { code: "en", label: "EN", nom: "English", dir: "ltr" },
] as const;

export type LangueCode = (typeof LANGUES)[number]["code"];

export const LANGUE_PAR_DEFAUT: LangueCode = "fr";
export const CLE_STOCKAGE = "adresse-gn-langue";

export function directionDe(code: string): "ltr" | "rtl" {
  return code === "ar" ? "rtl" : "ltr";
}

function estLangueSupportee(code: string | null | undefined): code is LangueCode {
  return !!code && LANGUES.some((l) => l.code === code);
}

/**
 * Langue choisie précédemment (localStorage) sinon langue du navigateur,
 * avec le français en repli. Ne s'exécute que côté client.
 */
export function detecterLangue(): LangueCode {
  if (typeof window === "undefined") return LANGUE_PAR_DEFAUT;
  try {
    const stockee = window.localStorage.getItem(CLE_STOCKAGE);
    if (estLangueSupportee(stockee)) return stockee;
  } catch {
    /* localStorage indisponible (mode privé) */
  }
  const navigateur = window.navigator.languages ?? [window.navigator.language];
  for (const brut of navigateur) {
    const court = brut?.split("-")[0]?.toLowerCase();
    if (estLangueSupportee(court)) return court;
  }
  return LANGUE_PAR_DEFAUT;
}

/** Résolue quand i18next est prêt (l'init est asynchrone). */
export let initPromise: Promise<unknown> = Promise.resolve();

if (!i18n.isInitialized) {
  initPromise = i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: { ...fr, ...frPricing, ...frAddress, ...frCheckout } },
        ar: { translation: { ...ar, ...arPricing, ...arAddress, ...arCheckout } },
        en: { translation: { ...en, ...enPricing, ...enAddress, ...enCheckout } },
      },

      // Le rendu serveur et l'hydratation partent toujours du français ;
      // la langue détectée est appliquée après le montage (voir useLangue).
      lng: LANGUE_PAR_DEFAUT,
      fallbackLng: LANGUE_PAR_DEFAUT,
      supportedLngs: LANGUES.map((l) => l.code),
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: CLE_STOCKAGE,
        // Notre hook useLangue est seul responsable de l'écriture du choix :
        // laisser i18next cacher "fr" ici écraserait la langue mémorisée.
        caches: [],
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export default i18n;

