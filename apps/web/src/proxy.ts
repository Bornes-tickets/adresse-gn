import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Tuiles, style, polices et icones de la carte locale : publics, jamais soumis
// à la session Supabase (des centaines de requêtes par carte affichée).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|viago-tiles|viago-map|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
