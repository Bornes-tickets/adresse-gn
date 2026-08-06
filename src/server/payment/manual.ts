/**
 * Prestataire « paiement manuel » : WhatsApp, espèces ou virement.
 * Aucun appel réseau — l'administration confirme la réception dans /admin/payments.
 */
import type {
  CreateIntentResult,
  HandleEventResult,
  OrderForPayment,
  PaymentProvider,
  VerifyWebhookResult,
  WebhookEvent,
} from "./provider";

function numeroWhatsapp(): string {
  return process.env["MANUAL_WHATSAPP_NUMBER"] ?? "+224620000000";
}

export const manualProvider: PaymentProvider = {
  code: "manual",
  label: "Paiement manuel (WhatsApp / espèces / virement)",
  enabled: true,

  async createIntent(order: OrderForPayment): Promise<CreateIntentResult> {
    const numero = numeroWhatsapp();
    return {
      intent_id: `manual_${order.order_ref}`,
      action: {
        type: "manual",
        whatsapp: numero,
        orderRef: order.order_ref,
        instructions:
          `Contactez-nous par WhatsApp au ${numero} pour finaliser votre paiement ` +
          `de ${order.amount_gnf.toLocaleString("fr-FR")} GNF. ` +
          `Référence à mentionner : ${order.order_ref}. ` +
          `Vous pouvez également régler en espèces à notre agence de Kaloum ou par virement bancaire. ` +
          `Dès réception, notre équipe confirme votre commande et vous recevez votre facture.`,
      },
    };
  },

  async verifyWebhook(): Promise<VerifyWebhookResult> {
    // Le mode manuel n'expose aucun webhook : toute notification est rejetée.
    return { valid: false, reason: "Le paiement manuel ne reçoit pas de webhook." };
  },

  async handleEvent(event: WebhookEvent): Promise<HandleEventResult> {
    throw new Error(
      `Le paiement manuel ne traite pas d'événement webhook (${event.order_ref}).`,
    );
  },
};
