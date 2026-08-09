/** Langue active côté navigateur, restreinte aux langues du CMS. */
import { useTranslation } from "react-i18next";

import { LANGUES, type Langue } from "@/lib/cms";

export function useLangueCms(): Langue {
  const { i18n } = useTranslation();
  const code = (i18n.resolvedLanguage ?? i18n.language ?? "fr").slice(0, 2) as Langue;
  return LANGUES.includes(code) ? code : "fr";
}
