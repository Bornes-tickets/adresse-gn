"use client";


const messages: Record<string, string> = {
  "home.hero.inputLabel":
    "Numéro de balise",

  "home.errors.incomplete":
    "Numéro Adresse GN invalide — saisissez un numéro complet au format CCCCC-NNNNNNNNC (ex. CKY04-582741369).",

  "home.errors.rateLimited":
    "Beaucoup de recherches d'un coup — patientez quelques secondes puis réessayez.",

  "home.errors.notFound":
    "Nous n'avons pas trouvé cette adresse — vérifiez le numéro ou contactez le propriétaire du lieu.",
};


export function useTranslation() {
  return {
    t(key: string) {
      return messages[key] ?? key;
    },
  };
}
