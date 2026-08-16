// src/lib/push.server.ts
// Envoi des notifications push via l'Edge Function Supabase `send-push`.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PushPayload {
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

/**
 * Envoie une notification push à un ou plusieurs utilisateurs.
 * Silencieux en cas d'erreur (log seulement) — un push raté ne doit jamais casser l'opération métier.
 */
export async function envoyerPush(payload: PushPayload): Promise<{ envoyees: number; echecs: number }> {
  if (!payload.userIds?.length) return { envoyees: 0, echecs: 0 };
  try {
    const { data, error } = await supabaseAdmin.functions.invoke("send-push", { body: payload });
    if (error) {
      console.error("[push] Edge Function error:", error.message);
      return { envoyees: 0, echecs: payload.userIds.length };
    }
    return {
      envoyees: (data as any)?.envoyees ?? 0,
      echecs: (data as any)?.echecs ?? 0,
    };
  } catch (e) {
    console.error("[push] invoke failed:", (e as Error).message);
    return { envoyees: 0, echecs: payload.userIds.length };
  }
}
