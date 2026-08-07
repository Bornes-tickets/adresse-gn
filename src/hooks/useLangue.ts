import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import i18n, {
  CLE_STOCKAGE,
  LANGUES,
  type LangueCode,
  detecterLangue,
  directionDe,
  initPromise,
} from "@/lib/i18n";

function appliquerAuDocument(code: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = code;
  document.documentElement.dir = directionDe(code);
}

/**
 * Langue courante + changement de langue.
 * Applique `lang`/`dir` sur <html> et persiste le choix dans localStorage.
 */
export function useLangue() {
  const { i18n: instance } = useTranslation();
  const langue = (instance.resolvedLanguage ?? instance.language) as LangueCode;

  // Au premier montage côté client : appliquer la langue détectée
  // (une fois i18next initialisé, l'init étant asynchrone).
  useEffect(() => {
    void initPromise.then(() => {
      const detectee = detecterLangue();
      if (detectee !== i18n.language) {
        return i18n.changeLanguage(detectee).then(() => {
          appliquerAuDocument(detectee);
        });
      }
      appliquerAuDocument(detectee);
      return undefined;
    });
  }, []);

  // À chaque changement de langue : mettre à jour <html>.
  useEffect(() => {
    appliquerAuDocument(langue);
  }, [langue]);

  const changerLangue = useCallback((code: LangueCode) => {
    try {
      window.localStorage.setItem(CLE_STOCKAGE, code);
    } catch {
      /* localStorage indisponible */
    }
    void i18n.changeLanguage(code).then(() => appliquerAuDocument(code));
  }, []);

  return { langue, changerLangue, langues: LANGUES, direction: directionDe(langue) };
}
