/** Endpoint léger de vérification de connectivité réelle. */
import { createServerFn } from "@tanstack/react-start";

export const ping = createServerFn({ method: "GET" }).handler(async () => "ok" as const);
