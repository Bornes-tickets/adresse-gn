// src/lib/push.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const pushSubscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; p256dh: string; auth: string; user_agent?: string }) => {
    if (!input.endpoint || !input.p256dh || !input.auth) throw new Error("Abonnement push invalide.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions" as any).upsert({
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.user_agent ?? null,
      last_used_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const pushUnsubscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => ({ endpoint: String(input.endpoint) }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions" as any)
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/** Envoi test (permet de vérifier la config VAPID + service worker). */
export const pushTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { envoyerPush } = await import("@/lib/push.server");
    await envoyerPush({
      userIds: [context.userId],
      title: "Test Adresse GN",
      body: "Les notifications fonctionnent 🎉",
      url: "/",
      tag: "test",
    });
    return { success: true };
  });
