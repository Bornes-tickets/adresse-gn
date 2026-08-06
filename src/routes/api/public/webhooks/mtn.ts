/** Webhook MTN Mobile Money (§8.4). Signature HMAC vérifiée avant tout traitement. */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/mtn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = k.toLowerCase() === "authorization" ? "[masqué]" : v;
        });

        const { getProviderRaw } = await import("@/server/payment");
        const { tracerWebhook, appliquerEvenementProvider } = await import(
          "@/lib/payment.server"
        );

        let payload: unknown = null;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          payload = { raw: rawBody.slice(0, 2000) };
        }

        const provider = getProviderRaw("mtn");
        const verification = await provider.verifyWebhook(headers, rawBody);

        const webhookId = await tracerWebhook({
          provider: "mtn",
          headers,
          payload,
          signatureValid: verification.valid,
          error: verification.reason ?? null,
        });

        if (!verification.valid || !verification.event) {
          return new Response(JSON.stringify({ error: "Signature invalide" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const resultat = await appliquerEvenementProvider(webhookId, "mtn", verification.event);
        return new Response(JSON.stringify(resultat), {
          status: resultat.ok ? 200 : 202,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
