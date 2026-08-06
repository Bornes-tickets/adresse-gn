/**
 * Contrat commun des prestataires de paiement (§8 du cahier des charges).
 * Serveur uniquement — src/server/* est exclu des bundles navigateur.
 */

export type ProviderCode = "manual" | "orange" | "mtn" | "card";

export interface OrderForPayment {
  id: string;
  order_ref: string;
  amount_gnf: number;
  offer_code: string;
  customer_id: string | null;
  customer_phone?: string | null;
}

export type PaymentAction =
  | { type: "manual"; instructions: string; whatsapp: string; orderRef: string }
  | { type: "url"; url: string }
  | { type: "ussd"; ussd: string; instructions: string };

export interface CreateIntentResult {
  intent_id: string;
  action: PaymentAction;
}

export interface WebhookEvent {
  order_ref: string;
  status: "success" | "failed";
  ref: string;
  raw: unknown;
}

export interface VerifyWebhookResult {
  valid: boolean;
  event?: WebhookEvent;
  reason?: string;
}

export interface HandleEventResult {
  order_ref: string;
  status: "success" | "failed";
  ref: string;
}

export interface PaymentProvider {
  code: ProviderCode;
  /** Libellé affiché dans l'interface. */
  label: string;
  /** false ⇒ bouton grisé côté client, createIntent lève une erreur claire. */
  enabled: boolean;
  createIntent(order: OrderForPayment): Promise<CreateIntentResult>;
  verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<VerifyWebhookResult>;
  handleEvent(event: WebhookEvent): Promise<HandleEventResult>;
}

/** Comparaison à temps constant sans dépendre de Node crypto. */
export function comparaisonSure(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 hexadécimal via WebCrypto (disponible dans le runtime serveur). */
export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encodeur = new TextEncoder();
  const cle = await crypto.subtle.importKey(
    "raw",
    encodeur.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cle, encodeur.encode(payload));
  return [...new Uint8Array(signature)]
    .map((o) => o.toString(16).padStart(2, "0"))
    .join("");
}
