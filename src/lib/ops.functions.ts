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

export const opsBeacons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireOps } = await import("@/lib/admin.server");
    const { listerBalises } = await import("@/lib/admin-ops.server");
    await requireOps(context.userId);
    return listerBalises({
      page: Number(data['page'] ?? 1),
      pageSize: Number(data['pageSize'] ?? 50),
      statuses: (data['statuses'] as string[] | undefined) ?? [],
      lotId: (data['lotId'] as string | null) ?? null,
      from: (data['from'] as string | null) ?? null,
      to: (data['to'] as string | null) ?? null,
      q: (data['q'] as string | null) ?? null,
    });
  });

export const opsLots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireOps } = await import("@/lib/admin.server");
    const { listerLots } = await import("@/lib/admin-ops.server");
    await requireOps(context.userId);
    return listerLots();
  });

export const opsGenerateLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      quantity: number;
      regionId: string;
      category?: string | null;
      supplier?: string | null;
      unitPriceGnf?: number | string | null;
    }) => {
      const quantite = Math.round(Number(input.quantity));
      if (!Number.isFinite(quantite) || quantite < 1 || quantite > 1000) {
        throw new Error("La quantité doit être comprise entre 1 et 1000.");
      }
      if (!input.regionId) throw new Error("Zone obligatoire.");
      const CATEGORIES_VALIDES = [
        "digital_only",
        "residential",
        "residential_plus",
        "professional",
        "institutional",
        "custom",
      ];
      const category = input.category?.trim() || "residential";
      if (!CATEGORIES_VALIDES.includes(category)) throw new Error("Catégorie de balise invalide.");
      const prix = input.unitPriceGnf;
      return {
        quantity: quantite,
        regionId: String(input.regionId),
        category,
        supplier: input.supplier?.trim() || null,
        unitPriceGnf: prix != null && prix !== "" ? Number(prix) : null,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const { requireOps } = await import("@/lib/admin.server");
    const { genererLotBalises } = await import("@/lib/admin-ops.server");
    await requireOps(context.userId);
    return genererLotBalises(data);
  });

export const opsAssignLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lotId: string; agentId: string }) => ({
    lotId: String(input.lotId),
    agentId: String(input.agentId),
  }))
  .handler(async ({ context, data }) => {
    const { requireOps } = await import("@/lib/admin.server");
    const { affecterLotAgent } = await import("@/lib/admin-ops.server");
    await requireOps(context.userId);
    return affecterLotAgent(data.lotId, data.agentId);
  });

export const opsExportQrPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lotId: string }) => ({ lotId: String(input.lotId) }))
  .handler(async ({ context, data }) => {
    const { requireOps } = await import("@/lib/admin.server");
    const { numerosDuLot, codeDuLot } = await import("@/lib/admin-ops.server");
    const { genererPdfQr, baseSite } = await import("@/lib/admin-pdf.server");
    await requireOps(context.userId);
    const base = baseSite();
    const [numeros, lotCode] = await Promise.all([numerosDuLot(data.lotId), codeDuLot(data.lotId)]);
    if (numeros.length === 0) throw new Error("Aucune balise dans ce lot.");
    const pdf = await genererPdfQr(numeros, base);
    return { ...pdf, balises: numeros.length, lotCode };
  });

export const opsExportQrZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { lotId: string }) => ({ lotId: String(input.lotId) }))
  .handler(async ({ context, data }) => {
    const { requireOps } = await import("@/lib/admin.server");
    const { numerosDuLot, codeDuLot } = await import("@/lib/admin-ops.server");
    const { baseSite } = await import("@/lib/admin-pdf.server");
    const { genererZipPng } = await import("@/lib/admin-qr-export.server");
    await requireOps(context.userId);
    const base = baseSite();
    const [numeros, lotCode] = await Promise.all([numerosDuLot(data.lotId), codeDuLot(data.lotId)]);
    if (numeros.length === 0) throw new Error("Aucune balise dans ce lot.");
    const zip = await genererZipPng(numeros, base);
    return { ...zip, lotCode };
  });
export const opsRegions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireOps } = await import("@/lib/admin.server");
    await requireOps(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("regions")
      .select("id, code, name, country_code")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const opsFournisseurs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireOps } = await import("@/lib/admin.server");
    await requireOps(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("lots")
      .select("supplier")
      .not("supplier", "is", null)
      .limit(500);
    if (error) throw new Error(error.message);
    const uniq = [...new Set((data ?? []).map((l: any) => l.supplier).filter(Boolean))].sort();
    return uniq;
  });
