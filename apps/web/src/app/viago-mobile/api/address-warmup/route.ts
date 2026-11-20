export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reveille le service Adresse GN (hebergement qui se met en veille) des l'ouverture de Viago,
// pour que la premiere recherche de l'utilisateur ne paie pas le demarrage a froid.
export async function GET(): Promise<Response> {
  const base = (process.env.VIAGO_ADDRESS_API_BASE_URL ?? "https://adresse-gn-api.onrender.com").replace(/\/+$/, "");
  try {
    await fetch(`${base}/api/v1/addresses/WARMUP-000000/`, {
      method: "GET", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(90000),
    });
  } catch {
    /* sans importance : le but est seulement de reveiller le service */
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
