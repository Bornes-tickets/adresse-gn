/** Points d'entrée serveur de l'espace Ops (production, lots, exports QR). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const opsWhoami = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireOps } = await import("@/lib/admin.server");
    return requireOps(context.userId);
  });

export const opsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireOps } = await import("@/lib/admin.server");
    const { chargerDashboardOps } = await import("@/lib/ops-ops.server");
    await requireOps(context.userId);
    return chargerDashboardOps();
  });
