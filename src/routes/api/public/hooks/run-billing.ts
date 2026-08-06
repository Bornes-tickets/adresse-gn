/**
 * Facturation récurrente déclenchée par pg_cron (§9.3).
 * Authentification : clé anon Supabase dans l'en-tête apikey.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/run-billing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cle = request.headers.get("apikey");
        const attendue =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!cle || !attendue || cle !== attendue) {
          return new Response(JSON.stringify({ error: "Non autorisé" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { lancerFacturationRecurrente } = await import("@/lib/payment.server");
        const resultat = await lancerFacturationRecurrente(null);
        return new Response(JSON.stringify({ ok: true, ...resultat }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
