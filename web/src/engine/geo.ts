// Map math in plain words: how far apart two points are, how long that takes to walk,
// and whether a point is inside a box or a shape.
// Walking time is an ESTIMATE: straight-line distance x 1.3 (streets are not straight),
// at about 80 meters per minute (roughly 3 miles per hour). It ignores highways and sidewalks.
import type { LonLat } from "@mcc/shared";

export const EARTH_RADIUS_METERS = 6_371_000;
/** Streets wind around, so a real walk is about 30% longer than a straight line. */
export const DETOUR_FACTOR = 1.3;
/** About 3 miles per hour. */
export const WALK_METERS_PER_MINUTE = 80;

export type Bbox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Straight-line ("as the crow flies") distance in meters between two [lon, lat] points. */
export function haversineMeters(a: LonLat, b: LonLat): number {
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const dLat = lat2 - lat1;
  const dLon = toRadians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimated walk in minutes between two [lon, lat] points. */
export function estimateWalkMinutes(a: LonLat, b: LonLat): number {
  return (haversineMeters(a, b) * DETOUR_FACTOR) / WALK_METERS_PER_MINUTE;
}

/** The straight-line radius you can cover in `minutes` of estimated walking (for drawing rings). */
export function walkRadiusMeters(minutes: number): number {
  return (minutes * WALK_METERS_PER_MINUTE) / DETOUR_FACTOR;
}

export function inBbox(point: LonLat, bbox: Bbox): boolean {
  return point[0] >= bbox[0] && point[0] <= bbox[2] && point[1] >= bbox[1] && point[1] <= bbox[3];
}

/**
 * Is the point inside the shape? Uses the "even-odd" ray test across every ring,
 * so holes and multi-part shapes both work.
 */
export function pointInPolygon(point: LonLat, rings: LonLat[][]): boolean {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
  }
  return inside;
}

/** The smallest box that holds every ring of a shape, or null if the shape is empty. */
export function polygonBbox(rings: LonLat[][]): Bbox | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (minLon === Infinity) return null;
  return [minLon, minLat, maxLon, maxLat];
}
