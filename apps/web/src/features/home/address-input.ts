import {
  isValidBeaconNumber,
  normalizeBeaconNumber,
} from "../../lib/geo";


function canonicalizeCandidate(
  candidate: string,
): string | null {
  const normalized =
    normalizeBeaconNumber(
      candidate,
    );

  return isValidBeaconNumber(
    normalized,
  )
    ? normalized
    : null;
}


export function extractAddressNumberFromQr(
  content: string,
): string | null {
  const value =
    content
      .trim()
      .toUpperCase();

  const match = value.match(
    /(?:[A-Z]{3}\d{2}-\d{9}|[A-Z]{3}\d{2}\d{9})/,
  );

  if (!match) {
    return null;
  }

  return canonicalizeCandidate(
    match[0],
  );
}


export function extractAddressNumberFromSpeech(
  transcript: string,
): string | null {
  const value =
    transcript
      .trim()
      .toUpperCase();

  const compact =
    value.replace(
      /[^A-Z0-9]/g,
      "",
    );

  const v1Match =
    compact.match(
      /[A-Z]{3}\d{2}\d{9}/,
    );

  if (!v1Match) {
    return null;
  }

  return canonicalizeCandidate(
    v1Match[0],
  );
}
