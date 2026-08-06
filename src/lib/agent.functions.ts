/** Recherche de l'email d'un agent à partir de son numéro de badge. */
import { createServerFn } from "@tanstack/react-start";

export const lookupAgentEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { badgeNumber: string }) => {
    if (typeof input?.badgeNumber !== "string" || input.badgeNumber.trim().length === 0) {
      throw new Error("Numéro de badge requis");
    }
    return { badgeNumber: input.badgeNumber.trim().slice(0, 32) };
  })
  .handler(async ({ data }): Promise<{ email: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, active")
      .eq("badge_number", data.badgeNumber)
      .maybeSingle();

    if (!agent || agent.active === false) return { email: null };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", agent.id)
      .maybeSingle();

    if (profile?.role !== "agent") return { email: null };

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(agent.id);
    return { email: authUser?.user?.email ?? null };
  });
