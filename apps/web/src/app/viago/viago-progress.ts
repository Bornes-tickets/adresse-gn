export type RouteCoordinate = {
  lat: number;
  lng: number;
};

export type RouteProgress =
  | {
      status: "on_route";
      remainingMeters: number;
      travelledMeters: number;
      totalMeters: number;
      percent: number;
      lateralMeters: number;
    }
  | {
      status: "off_route" | "ambiguous";
      lateralMeters: number;
    };

type Candidate = {
  along: number;
  lateral: number;
  segment: number;
};

const EARTH_RADIUS_M = 6371008.8;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(
  a: RouteCoordinate,
  b: RouteCoordinate,
): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M *
    Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function matchRouteProgress(
  route: readonly RouteCoordinate[],
  position: RouteCoordinate,
  accuracyMeters: number,
  previousMeters: number | null,
  elapsedSeconds: number | null,
): RouteProgress | null {
  if (
    route.length < 2 ||
    !Number.isFinite(position.lat) ||
    !Number.isFinite(position.lng) ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0 ||
    accuracyMeters > 50
  ) {
    return null;
  }

  const lengths: number[] = [];
  const cumulative: number[] = [0];

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (
      !a || !b ||
      !Number.isFinite(a.lat) ||
      !Number.isFinite(a.lng) ||
      !Number.isFinite(b.lat) ||
      !Number.isFinite(b.lng)
    ) {
      return null;
    }

    const length = distanceMeters(a, b);
    if (!Number.isFinite(length)) return null;

    lengths.push(length);
    cumulative.push(cumulative[i] + length);
  }

  const total = cumulative[cumulative.length - 1];
  if (!Number.isFinite(total) || total < 1) return null;

  const latScale = EARTH_RADIUS_M;
  const lngScale =
    EARTH_RADIUS_M * Math.cos(radians(position.lat));

  const candidates: Candidate[] = [];

  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] < 0.01) continue;

    const a = route[i];
    const b = route[i + 1];

    const ax = radians(a.lng - position.lng) * lngScale;
    const ay = radians(a.lat - position.lat) * latScale;
    const bx = radians(b.lng - position.lng) * lngScale;
    const by = radians(b.lat - position.lat) * latScale;

    const dx = bx - ax;
    const dy = by - ay;
    const squared = dx * dx + dy * dy;

    if (squared < 0.0001) continue;

    const fraction = Math.max(
      0,
      Math.min(1, -(ax * dx + ay * dy) / squared),
    );

    const nearestX = ax + dx * fraction;
    const nearestY = ay + dy * fraction;

    candidates.push({
      along: cumulative[i] + lengths[i] * fraction,
      lateral: Math.hypot(nearestX, nearestY),
      segment: i,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.lateral - b.lateral);

  const nearest = candidates[0];
  const threshold = Math.max(30, accuracyMeters * 1.5);

  if (nearest.lateral > threshold) {
    return {
      status: "off_route",
      lateralMeters: nearest.lateral,
    };
  }

  let chosen = nearest;

  if (previousMeters !== null) {
    const nearby = candidates.filter(
      (item) => item.lateral <= nearest.lateral + 20,
    );

    nearby.sort((a, b) => {
      const scoreA =
        a.lateral + Math.abs(a.along - previousMeters) * 0.3;
      const scoreB =
        b.lateral + Math.abs(b.along - previousMeters) * 0.3;
      return scoreA - scoreB;
    });

    chosen = nearby[0];

    const elapsed = Math.max(
      0,
      Math.min(elapsedSeconds ?? 0, 120),
    );

    const maximumAdvance = 100 + 40 * elapsed;

    if (
      chosen.along < previousMeters - 60 ||
      chosen.along > previousMeters + maximumAdvance
    ) {
      return {
        status: "ambiguous",
        lateralMeters: chosen.lateral,
      };
    }

  } else {
    const alternative = candidates.find(
      (item) =>
        Math.abs(item.segment - nearest.segment) > 2 &&
        Math.abs(item.along - nearest.along) > 120 &&
        item.lateral <= nearest.lateral + Math.max(10, accuracyMeters),
    );

    if (alternative) {
      return {
        status: "ambiguous",
        lateralMeters: nearest.lateral,
      };
    }
  }

  const along = previousMeters !== null
    ? Math.max(previousMeters, chosen.along)
    : chosen.along;

  const travelled = Math.max(0, Math.min(total, along));
  const remaining = Math.max(0, total - travelled);

  return {
    status: "on_route",
    remainingMeters: remaining,
    travelledMeters: travelled,
    totalMeters: total,
    percent: Math.min(100, Math.max(0, travelled / total * 100)),
    lateralMeters: chosen.lateral,
  };
}
