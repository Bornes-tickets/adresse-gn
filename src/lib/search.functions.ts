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
    const { clientIp, runSearch, userIdFromAuthHeader } = await import(
      "@/lib/search.server"
    );
    const headers = new Headers(
      getRequestHeaders() as unknown as Record<string, string>,
    );
    const userId = await userIdFromAuthHeader(getRequestHeader("authorization") ?? null);
    return runSearch(data.number, clientIp(headers), userId);
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
