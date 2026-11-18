import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fichier PMTiles unique, jamais choisi par l'appelant (aucun chemin dans l'URL).
// Le fichier est genere par preparer_tuiles_guinee.ps1 dans <depot>/.tiles/guinea.pmtiles.
function tilesPath(): string {
  const configured = process.env.VIAGO_PMTILES_PATH;
  if (configured) return configured;
  return path.resolve(process.cwd(), "..", "..", ".tiles", "guinea.pmtiles");
}

const BASE_HEADERS = {
  "Accept-Ranges": "bytes",
  "Content-Type": "application/octet-stream",
  "Cache-Control": "public, max-age=3600",
};

export async function GET(request: Request): Promise<Response> {
  const file = tilesPath();
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return Response.json({ status: "error", message: "Tuiles locales absentes." }, { status: 404 });
  }

  const range = request.headers.get("range");
  if (!range) {
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, { status: 200, headers: { ...BASE_HEADERS, "Content-Length": String(size) } });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  let start: number;
  let end: number;
  if (match[1] === "") {
    // "bytes=-N" : les N derniers octets
    const tail = Number(match[2]);
    start = Math.max(0, size - tail);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      ...BASE_HEADERS,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}
