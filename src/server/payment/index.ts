/**
 * Fabrique des prestataires de paiement.
 * Serveur uniquement — ne jamais importer depuis un composant.
 */
import { manualProvider } from "./manual";
import { mtnProvider } from "./mtn";
import { orangeProvider } from "./orange";
import type { PaymentProvider, ProviderCode } from "./provider";

const REGISTRE: Record<string, PaymentProvider> = {
  manual: manualProvider,
  orange: orangeProvider,
  mtn: mtnProvider,
};

/** Renvoie l'implémentation ; erreur claire si code inconnu ou provider désactivé. */
export function getProvider(code: string): PaymentProvider {
  const provider = REGISTRE[code];
  if (!provider) {
    throw new Error(`Moyen de paiement inconnu : « ${code} ».`);
  }
  if (!provider.enabled) {
    throw new Error(
      `${provider.label} n'est pas encore activé — utilisez le paiement manuel.`,
    );
  }
  return provider;
}

/** Provider sans contrôle d'activation (webhooks : on doit pouvoir tracer même désactivé). */
export function getProviderRaw(code: string): PaymentProvider {
  const provider = REGISTRE[code];
  if (!provider) throw new Error(`Moyen de paiement inconnu : « ${code} ».`);
  return provider;
}

/** État d'activation exposé au client (aucun secret). */
export function listerMoyensPaiement(): {
  code: ProviderCode;
  label: string;
  enabled: boolean;
}[] {
  return (["orange", "mtn", "manual"] as ProviderCode[]).map((code) => {
    const p = REGISTRE[code]!;
    return { code, label: p.label, enabled: p.enabled };
  });
}
