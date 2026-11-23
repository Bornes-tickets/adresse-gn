import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// Cache disque des reponses Adresse GN (adresse par numero, lieux par nom).
// Role : si le service Adresse GN (Render) est lent ou injoignable, une recherche deja faite reste servie.
// Les fichiers sont nommes par empreinte, ecrits en 0600, et expirent apres 30 jours.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function cacheDir(): string {
  return process.env.VIAGO_ADDRESS_CACHE_DIR || path.join(os.tmpdir(), "viago-address-cache");
}

function cacheFile(kind: string, key: string): string {
  const hash = createHash("sha256").update(`${kind}:${key.toLowerCase()}`).digest("hex").slice(0, 40);
  return path.join(cacheDir(), `${kind}-${hash}.json`);
}

export async function diskCacheRead(kind: string, key: string): Promise<string | null> {
  try {
    const file = cacheFile(kind, key);
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs > MAX_AGE_MS) return null;
    return await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
}

export async function diskCacheWrite(kind: string, key: string, payload: string): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true, mode: 0o700 });
    const file = cacheFile(kind, key);
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, payload, { mode: 0o600 });
    await fs.rename(tmp, file);
  } catch {
    /* cache facultatif : une ecriture ratee ne doit jamais casser la recherche */
  }
}

export type AddressFetchResult = { status: number; body: string; source: "live" | "stale" };

type Options = { kind: string; key: string; url: string; timeoutMs: number; slowMs: number; maxBytes: number };

// Appelle le service Adresse GN. Si une reponse en cache existe et que le service tarde (> slowMs)
// ou echoue, renvoie la reponse en cache ; l'appel continue en arriere-plan et rafraichit le cache.
export async function fetchAddressJson(o: Options): Promise<AddressFetchResult> {
  const live = (async (): Promise<AddressFetchResult> => {
    const response = await fetch(o.url, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "manual",
      signal: AbortSignal.timeout(o.timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) throw new Error("redirect");
    const body = await response.text();
    if (response.status >= 500) throw new Error("backend-error");
    if (!response.headers.get("content-type")?.includes("application/json") || body.length > o.maxBytes) {
      throw new Error("invalid-response");
    }
    if (response.status === 200) void diskCacheWrite(o.kind, o.key, body);
    return { status: response.status, body, source: "live" };
  })();
  live.catch(() => undefined);

  const stale = await diskCacheRead(o.kind, o.key);
  if (stale === null) return await live;

  const slow = new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), o.slowMs));
  try {
    const first = await Promise.race([live, slow]);
    if (first !== "slow") return first;
  } catch {
    /* service en echec : on sert la reponse en cache */
  }
  return { status: 200, body: stale, source: "stale" };
}
