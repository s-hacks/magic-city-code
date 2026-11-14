// Food sources: every existing store in the whole city (people walk across the
// mission's edges) plus any hubs the student placed. This file finds the closest one.
import type { LonLat, Store } from "@mcc/shared";
import { estimateWalkMinutes } from "./geo";

/** Used when there is no food source at all, so numbers stay finite and JSON-safe. */
export const NO_SOURCE_MINUTES = 999;

export interface FoodSource {
  position: LonLat;
  hubSiteId: string | null; // null for an existing store
}

export interface Nearest {
  minutes: number;
  target: LonLat;
  hubSiteId: string | null;
}

export function storeSources(stores: Store[]): FoodSource[] {
  const sources: FoodSource[] = [];
  for (const store of stores) sources.push({ position: [store.lon, store.lat], hubSiteId: null });
  return sources;
}

/** Closest source to `from`. Ties go to the earlier source (stores come before hubs). */
export function nearestSource(from: LonLat, sources: FoodSource[]): Nearest {
  let best: Nearest = { minutes: NO_SOURCE_MINUTES, target: from, hubSiteId: null };
  let found = false;
  for (const source of sources) {
    const minutes = estimateWalkMinutes(from, source.position);
    if (!found || minutes < best.minutes) {
      best = { minutes, target: source.position, hubSiteId: source.hubSiteId };
      found = true;
    }
  }
  if (found && best.minutes > NO_SOURCE_MINUTES) best = { ...best, minutes: NO_SOURCE_MINUTES };
  return best;
}

/** Keep `current` unless `candidate` is strictly closer. */
export function closerOf(from: LonLat, current: Nearest, candidate: FoodSource): Nearest {
  const minutes = estimateWalkMinutes(from, candidate.position);
  if (minutes < current.minutes) return { minutes, target: candidate.position, hubSiteId: candidate.hubSiteId };
  return current;
}
