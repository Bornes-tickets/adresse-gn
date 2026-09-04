"use client";


const messages: Record<string, string> = {
  "home.hero.inputLabel":
    "Numéro de balise",

  "home.errors.incomplete":
    "Ce numéro semble incomplet — saisissez les 6 chiffres de la balise (ex. 582741) ou le numéro entier GN-CKY-582741.",

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
