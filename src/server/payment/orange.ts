/**
 * STUB Orange Money Web Payment (§8.2).
 * Activation : renseigner ORANGE_ENABLED=true + les identifiants marchands,
 * puis redéployer. Aucun appel réseau n'est effectué tant que le flag est faux.
 */
import {
  comparaisonSure,
  hmacSha256Hex,
  type CreateIntentResult,
  type HandleEventResult,
  type OrderForPayment,
  type PaymentProvider,
  type VerifyWebhookResult,
  type WebhookEvent,
} from "./provider";

const API_BASE = "https://api.orange.com";

function estActif(): boolean {
  return process.env["ORANGE_ENABLED"] === "true";
}

/** TODO: activer quand identifiants disponibles — jeton OAuth2 Orange. */
async function obtenirJeton(): Promise<string> {
  const clientId = process.env["ORANGE_CLIENT_ID"];
  const clientSecret = process.env["ORANGE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Identifiants Orange Money manquants (ORANGE_CLIENT_ID/SECRET).");
  }
  const reponse = await fetch(`${API_BASE}/oauth/v3/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!reponse.ok) throw new Error("Authentification Orange Money refusée.");
  const donnees = (await reponse.json()) as { access_token?: string };
  if (!donnees.access_token) throw new Error("Jeton Orange Money absent.");
  return donnees.access_token;
}

export const orangeProvider: PaymentProvider = {
  code: "orange",
  label: "Orange Money",
  get enabled() {
    return estActif();
  },

  async createIntent(order: OrderForPayment): Promise<CreateIntentResult> {
    if (!estActif()) {
      throw new Error("Orange Money pas encore activé — utilisez le paiement manuel.");
    }

    // TODO: activer quand identifiants disponibles.
    const jeton = await obtenirJeton();
    const origine = process.env["PUBLIC_APP_URL"] ?? "";
    const reponse = await fetch(`${API_BASE}/orange-money-webpay/gn/v1/webpayment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jeton}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchant_key: process.env["ORANGE_MERCHANT_KEY"],
        currency: process.env["INVOICE_CURRENCY"] ?? "GNF",
        order_id: order.order_ref,
        amount: order.amount_gnf,
        return_url: `${origine}/paiement/confirme?ref=${order.order_ref}`,
        cancel_url: `${origine}/paiement/echec?ref=${order.order_ref}`,
        notif_url: `${origine}/api/public/webhooks/orange`,
        lang: "fr",
        reference: "ADRESSE GN",
      }),
    });
    if (!reponse.ok) throw new Error("Création du paiement Orange Money refusée.");
    const donnees = (await reponse.json()) as {
      pay_token?: string;
      payment_url?: string;
    };
    if (!donnees.pay_token || !donnees.payment_url) {
      throw new Error("Réponse Orange Money incomplète.");
    }
    return {
      intent_id: donnees.pay_token,
      action: { type: "url", url: donnees.payment_url },
    };
  },

  /** TODO: activer quand identifiants disponibles — en-tête HMAC-SHA256. */
  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<VerifyWebhookResult> {
    const secret = process.env["ORANGE_WEBHOOK_SECRET"];
    if (!secret) return { valid: false, reason: "ORANGE_WEBHOOK_SECRET non configuré." };

    const recue = (headers["x-orange-signature"] ?? headers["x-signature"] ?? "")
      .replace(/^sha256=/, "")
      .trim()
      .toLowerCase();
    if (!recue) return { valid: false, reason: "Signature absente." };

    const attendue = await hmacSha256Hex(secret, rawBody);
    if (!comparaisonSure(recue, attendue)) {
      return { valid: false, reason: "Signature invalide." };
    }

    let payload: {
      order_id?: string;
      status?: string;
      txnid?: string;
      pay_token?: string;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "Corps JSON illisible." };
    }
    if (!payload.order_id) return { valid: false, reason: "order_id absent." };

    return {
      valid: true,
      event: {
        order_ref: payload.order_id,
        status: payload.status?.toUpperCase() === "SUCCESS" ? "success" : "failed",
        ref: payload.txnid ?? payload.pay_token ?? "",
        raw: payload,
      },
    };
  },

  async handleEvent(event: WebhookEvent): Promise<HandleEventResult> {
    return { order_ref: event.order_ref, status: event.status, ref: event.ref };
  },
};
