/**
 * STUB MTN MoMo Collection API (§8.3).
 * Activation : renseigner MTN_ENABLED=true + les identifiants marchands,
 * puis redéployer. Aucun appel réseau tant que le flag est faux.
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

const API_BASE = "https://proxy.momoapi.mtn.com";

function estActif(): boolean {
  return process.env["MTN_ENABLED"] === "true";
}

/** TODO: activer quand identifiants disponibles — jeton Collection MTN MoMo. */
async function obtenirJeton(): Promise<string> {
  const apiUser = process.env["MTN_API_USER"];
  const apiKey = process.env["MTN_API_KEY"];
  const subKey = process.env["MTN_SUBSCRIPTION_KEY"];
  if (!apiUser || !apiKey || !subKey) {
    throw new Error("Identifiants MTN MoMo manquants (MTN_API_USER/API_KEY/SUBSCRIPTION_KEY).");
  }
  const reponse = await fetch(`${API_BASE}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${apiUser}:${apiKey}`)}`,
      "Ocp-Apim-Subscription-Key": subKey,
    },
  });
  if (!reponse.ok) throw new Error("Authentification MTN MoMo refusée.");
  const donnees = (await reponse.json()) as { access_token?: string };
  if (!donnees.access_token) throw new Error("Jeton MTN MoMo absent.");
  return donnees.access_token;
}

export const mtnProvider: PaymentProvider = {
  code: "mtn",
  label: "MTN Mobile Money",
  get enabled() {
    return estActif();
  },

  async createIntent(order: OrderForPayment): Promise<CreateIntentResult> {
    if (!estActif()) {
      throw new Error("MTN Mobile Money pas encore activé — utilisez le paiement manuel.");
    }

    // TODO: activer quand identifiants disponibles.
    const jeton = await obtenirJeton();
    const origine = process.env["PUBLIC_APP_URL"] ?? "";
    const referenceId = crypto.randomUUID();
    const reponse = await fetch(`${API_BASE}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jeton}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": "mtnguinea",
        "Ocp-Apim-Subscription-Key": process.env["MTN_SUBSCRIPTION_KEY"] ?? "",
        "X-Callback-Url": `${origine}/api/public/webhooks/mtn`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(order.amount_gnf),
        currency: process.env["INVOICE_CURRENCY"] ?? "GNF",
        externalId: order.order_ref,
        payer: { partyIdType: "MSISDN", partyId: order.customer_phone ?? "" },
        payerMessage: `Adresse GN ${order.order_ref}`,
        payeeNote: `Commande ${order.order_ref}`,
      }),
    });
    if (!reponse.ok && reponse.status !== 202) {
      throw new Error("Création du paiement MTN MoMo refusée.");
    }
    return {
      intent_id: referenceId,
      action: {
        type: "ussd",
        ussd: "*133#",
        instructions:
          `Composez *133# sur votre téléphone MTN et validez la demande de paiement ` +
          `de ${order.amount_gnf.toLocaleString("fr-FR")} GNF pour la commande ${order.order_ref}.`,
      },
    };
  },

  /** TODO: activer quand identifiants disponibles — en-tête HMAC-SHA256. */
  async verifyWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<VerifyWebhookResult> {
    const secret = process.env["MTN_WEBHOOK_SECRET"];
    if (!secret) return { valid: false, reason: "MTN_WEBHOOK_SECRET non configuré." };

    const recue = (headers["x-momo-signature"] ?? headers["x-signature"] ?? "")
      .replace(/^sha256=/, "")
      .trim()
      .toLowerCase();
    if (!recue) return { valid: false, reason: "Signature absente." };

    const attendue = await hmacSha256Hex(secret, rawBody);
    if (!comparaisonSure(recue, attendue)) {
      return { valid: false, reason: "Signature invalide." };
    }

    let payload: {
      externalId?: string;
      status?: string;
      financialTransactionId?: string;
      referenceId?: string;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "Corps JSON illisible." };
    }
    if (!payload.externalId) return { valid: false, reason: "externalId absent." };

    return {
      valid: true,
      event: {
        order_ref: payload.externalId,
        status: payload.status?.toUpperCase() === "SUCCESSFUL" ? "success" : "failed",
        ref: payload.financialTransactionId ?? payload.referenceId ?? "",
        raw: payload,
      },
    };
  },

  async handleEvent(event: WebhookEvent): Promise<HandleEventResult> {
    return { order_ref: event.order_ref, status: event.status, ref: event.ref };
  },
};
