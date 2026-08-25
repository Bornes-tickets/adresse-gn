/** Points d'entrée serveur des commandes invité. Fichier fin : imports + déclarations. */
import { createServerFn } from "@tanstack/react-start";

import type { NouvelleCommande } from "./orders.server";

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input: NouvelleCommande) => {
    if (!input?.full_name || input.full_name.trim().length < 2) throw new Error("Nom invalide");
    if (!input?.phone || input.phone.trim().length < 8) throw new Error("Téléphone invalide");
    if (!input?.address_line || input.address_line.trim().length < 5) throw new Error("Adresse invalide");
    if (!input?.formule_code) throw new Error("Formule manquante");
    return input;
  })
  .handler(async ({ data }) => {
    const { creerCommandeInvite } = await import("./orders.server");
    return creerCommandeInvite(data);
  });

export const getGuestOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "") }))
  .handler(async ({ data }) => {
    const { chargerCommandeInvite } = await import("./orders.server");
    return chargerCommandeInvite(data.token);
  });
