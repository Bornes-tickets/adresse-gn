/** Points d'entrée serveur de l'espace Sales (commercial). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const salesWhoami = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSales } = await import("@/lib/admin.server");
    return requireSales(context.userId);
  });

/** Dashboard commercial : KPI et activité récente côté ventes. */
export const salesDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSales } = await import("@/lib/admin.server");
    const { chargerDashboardSales } = await import("@/lib/sales-ops.server");
    await requireSales(context.userId);
    return chargerDashboardSales();
  });
