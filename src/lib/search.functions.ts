/** Fonctions serveur publiques : recherche, journal d'itinéraire, établissement. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestHeaders } from "@tanstack/react-start/server";

import type { EstablishmentDetails, SearchResponse } from "@/lib/beacon";

export const searchBeacon = createServerFn({ method: "POST" })
  .inputValidator((input: { number: string }) => {
    if (typeof input?.number !== "string") throw new Error("Numéro requis");
    return { number: input.number.slice(0, 32) };
  })
  .handler(async ({ data }): Promise<SearchResponse> => {
    console.log("[searchBeacon] Paramètre public_number reçu:", data.number);
    try {
      const { clientIp, runSearch, userIdFromAuthHeader } = await import(
        "@/lib/search.server"
      );
      const headers = new Headers(
        getRequestHeaders() as unknown as Record<string, string>,
      );
      const userId = await userIdFromAuthHeader(
        getRequestHeader("authorization") ?? null,
      );
      const response = await runSearch(data.number, clientIp(headers), userId);
      console.log("[searchBeacon] Résultat:", JSON.stringify(response));
      return response;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[searchBeacon] Échec brut:", message, e);
      return {
        status: "error",
        beacon_id: null,
        result: null,
        message,
      };
    }
  });

export const logRoute = createServerFn({ method: "POST" })
  .inputValidator((input: { number: string; provider: string }) => {
    if (typeof input?.number !== "string" || typeof input?.provider !== "string") {
      throw new Error("Paramètres invalides");
    }
    return { number: input.number.slice(0, 32), provider: input.provider.slice(0, 32) };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { recordRouteLog, userIdFromAuthHeader } = await import("@/lib/search.server");
    const userId = await userIdFromAuthHeader(getRequestHeader("authorization") ?? null);
    await recordRouteLog(data.number, data.provider, userId);
    return { ok: true };
  });

export const getEstablishment = createServerFn({ method: "POST" })
  .inputValidator((input: { number: string }) => {
    if (typeof input?.number !== "string") throw new Error("Numéro requis");
    return { number: input.number.slice(0, 32) };
  })
  .handler(async ({ data }): Promise<EstablishmentDetails | null> => {
    const { fetchEstablishment } = await import("@/lib/search.server");
    return fetchEstablishment(data.number);
  });
