/**
 * Logique serveur de la recherche par numéro : rate-limiting, journalisation,
 * lecture des données. Ce fichier est bloqué des bundles navigateur.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BEACON_REGEX } from "@/lib/geo";
import type {
  BeaconResult,
  EstablishmentDetails,
  SearchResponse,
} from "@/lib/beacon";

const MAX_PER_MINUTE = 60;
const MAX_CONSECUTIVE_MISSES = 5;
const MISS_BLOCK_MINUTES = 5;

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}

/** Identifie l'utilisateur à partir du jeton porteur, si présent. */
export async function userIdFromAuthHeader(
  authorization: string | null,
): Promise<string | null> {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

/** 60 requêtes/minute/IP. */
async function underRateLimit(ip: string): Promise<boolean> {
  const bucket = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const { data } = await supabaseAdmin
    .from("rate_limits")
    .select("count")
    .eq("ip", ip)
    .eq("minute_bucket", bucket)
    .maybeSingle();

  const next = (data?.count ?? 0) + 1;
  await supabaseAdmin
    .from("rate_limits")
    .upsert({ ip, minute_bucket: bucket, count: next }, { onConflict: "ip,minute_bucket" });

  return next <= MAX_PER_MINUTE;
}

/** Blocage temporaire après 5 numéros introuvables consécutifs. */
async function missBlockSeconds(ip: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("search_misses")
    .select("blocked_until")
    .eq("ip", ip)
    .maybeSingle();
  if (!data?.blocked_until) return 0;
  const remaining = new Date(data.blocked_until).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

async function registerMiss(ip: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("search_misses")
    .select("miss_count")
    .eq("ip", ip)
    .maybeSingle();
  const count = (data?.miss_count ?? 0) + 1;
  const blocked =
    count >= MAX_CONSECUTIVE_MISSES
      ? new Date(Date.now() + MISS_BLOCK_MINUTES * 60000).toISOString()
      : null;
  await supabaseAdmin.from("search_misses").upsert(
    {
      ip,
      miss_count: count >= MAX_CONSECUTIVE_MISSES ? 0 : count,
      blocked_until: blocked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ip" },
  );
}

async function resetMisses(ip: string): Promise<void> {
  await supabaseAdmin.from("search_misses").upsert(
    { ip, miss_count: 0, blocked_until: null, updated_at: new Date().toISOString() },
    { onConflict: "ip" },
  );
}

async function beaconIdFor(publicNumber: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("beacons")
    .select("id")
    .eq("public_number", publicNumber)
    .maybeSingle();
  return data?.id ?? null;
}

/** Recherche complète : validation, quotas, RPC, journalisation. */
export async function runSearch(
  rawNumber: string,
  ip: string,
  userId: string | null,
): Promise<SearchResponse> {
  const number = rawNumber.trim().toUpperCase();

  if (!BEACON_REGEX.test(number)) {
    return {
      status: "invalid",
      beacon_id: null,
      result: null,
      message: "Format de numéro invalide (attendu GN-XXX-999999).",
    };
  }

  const blocked = await missBlockSeconds(ip);
  if (blocked > 0) {
    return {
      status: "rate_limited",
      beacon_id: null,
      result: null,
      retry_after_seconds: blocked,
      message: "Trop de recherches infructueuses. Réessayez dans quelques minutes.",
    };
  }

  if (!(await underRateLimit(ip))) {
    return {
      status: "rate_limited",
      beacon_id: null,
      result: null,
      retry_after_seconds: 60,
      message: "Trop de recherches. Réessayez dans une minute.",
    };
  }

  const { data, error } = await supabaseAdmin.rpc("search_by_number", {
    p_number: number,
  });
  if (error) throw new Error(error.message);

  const result = ((data as BeaconResult[] | null) ?? [])[0] ?? null;
  const beaconId = result ? await beaconIdFor(result.public_number) : null;

  await supabaseAdmin.from("search_logs").insert({
    query: number,
    beacon_id_found: beaconId,
    user_id: userId,
    ip: ip === "unknown" ? null : ip,
  });

  if (result) {
    await resetMisses(ip);
    return { status: "found", beacon_id: beaconId, result };
  }

  await registerMiss(ip);
  return {
    status: "not_found",
    beacon_id: null,
    result: null,
    message: "Aucune adresse ne correspond à ce numéro.",
  };
}

/** Journalise le lancement d'un itinéraire (anon ne peut pas écrire dans route_logs). */
export async function recordRouteLog(
  publicNumber: string,
  provider: string,
  userId: string | null,
): Promise<void> {
  const beaconId = await beaconIdFor(publicNumber.trim().toUpperCase());
  if (!beaconId) return;
  await supabaseAdmin.from("route_logs").insert({
    beacon_id: beaconId,
    user_id: userId,
    provider,
    launched_at: new Date().toISOString(),
  });
}

/** Détails d'établissement (photos incluses) pour une balise active. */
export async function fetchEstablishment(
  publicNumber: string,
): Promise<EstablishmentDetails | null> {
  const number = publicNumber.trim().toUpperCase();
  if (!BEACON_REGEX.test(number)) return null;

  const { data: beacon } = await supabaseAdmin
    .from("beacons")
    .select("id, status")
    .eq("public_number", number)
    .maybeSingle();
  if (!beacon || beacon.status !== "active") return null;

  const { data: address } = await supabaseAdmin
    .from("addresses")
    .select("id")
    .eq("beacon_id", beacon.id)
    .maybeSingle();
  if (!address) return { beacon_id: beacon.id, establishment: null, photos: [] };

  const { data: establishment } = await supabaseAdmin
    .from("establishments")
    .select("id, business_name, phone, description, cover_url, opening_hours")
    .eq("address_id", address.id)
    .maybeSingle();
  if (!establishment) return { beacon_id: beacon.id, establishment: null, photos: [] };

  const { data: photos } = await supabaseAdmin
    .from("establishment_photos")
    .select("id, url, order")
    .eq("establishment_id", establishment.id)
    .order("order", { ascending: true });

  return {
    beacon_id: beacon.id,
    establishment: {
      id: establishment.id,
      business_name: establishment.business_name,
      phone: establishment.phone,
      description: establishment.description,
      cover_url: establishment.cover_url,
      opening_hours: (establishment.opening_hours as Record<string, string> | null) ?? null,
    },
    photos: photos ?? [],
  };
}
