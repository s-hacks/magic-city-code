// Resident dots: about 3,000 little "homes" spread over the mission's blocks.
// Each block gets dots in proportion to its need (at least one if it has any need).
// Dots are scattered inside the block's real shape using a random generator seeded by
// the block's id, so they sit in exactly the same spots on every run.
// Each dot also carries a weight: the block's need divided by its number of dots.
// The score adds up these weights, so a block's whole need is always counted, split
// evenly over its dots, and part of a block can be covered while the rest is not.
import type { Area, LonLat, NeedColumn, ResidentStatus } from "@mcc/shared";
import { pointInPolygon, polygonBbox } from "./geo";
import { needOf } from "./areas";
import { hashString, seededRandom } from "./random";

export const TARGET_RESIDENT_DOTS = 3000;
/** How many random spots we try inside a block's shape before giving up and using its center. */
const MAX_TRIES_PER_DOT = 40;
/** When we fall back to the center, nudge dots up to this many degrees (~50 m) so they don't stack. */
const CENTER_JITTER_DEGREES = 0.0005;

export interface ResidentHome {
  areaId: string;
  areaIndex: number; // position of the block in the mission's area list
  position: LonLat;
  weight: number; // share of the block's mission need this dot stands for
  noCarWeight: number; // share of the block's no-car households this dot stands for
}

/** How many dots each area gets. Same order as `areas`. */
export function dotsPerArea(areas: Area[], column: NeedColumn, target = TARGET_RESIDENT_DOTS): number[] {
  let total = 0;
  for (const area of areas) total += needOf(area, column);
  const counts: number[] = [];
  for (const area of areas) {
    const need = needOf(area, column);
    if (need <= 0 || total <= 0) {
      counts.push(0);
      continue;
    }
    counts.push(Math.max(1, Math.round((target * need) / total)));
  }
  return counts;
}

/** Scatter `count` homes inside one area, always the same way for the same area id. */
export function homesForArea(area: Area, areaIndex: number, count: number, column: NeedColumn): ResidentHome[] {
  const weight = count > 0 ? needOf(area, column) / count : 0;
  const noCarWeight = count > 0 ? needOf(area, "households_no_car") / count : 0;
  const random = seededRandom(hashString(area.id));
  const box = polygonBbox(area.polygon);
  const homes: ResidentHome[] = [];
  for (let n = 0; n < count; n++) {
    let position: LonLat | null = null;
    if (box !== null) {
      for (let tries = 0; tries < MAX_TRIES_PER_DOT; tries++) {
        const lon = box[0] + random() * (box[2] - box[0]);
        const lat = box[1] + random() * (box[3] - box[1]);
        if (pointInPolygon([lon, lat], area.polygon)) {
          position = [lon, lat];
          break;
        }
      }
    }
    if (position === null) {
      const dLon = (random() * 2 - 1) * CENTER_JITTER_DEGREES;
      const dLat = (random() * 2 - 1) * CENTER_JITTER_DEGREES;
      position = [area.center[0] + dLon, area.center[1] + dLat];
    }
    homes.push({ areaId: area.id, areaIndex, position, weight, noCarWeight });
  }
  return homes;
}

/** All homes for the mission, block by block, in data order. */
export function makeHomes(areas: Area[], column: NeedColumn, target = TARGET_RESIDENT_DOTS): ResidentHome[] {
  const counts = dotsPerArea(areas, column, target);
  const homes: ResidentHome[] = [];
  for (let i = 0; i < areas.length; i++) {
    for (const home of homesForArea(areas[i], i, counts[i], column)) homes.push(home);
  }
  return homes;
}

/** near = within the walk limit, mid = up to twice the limit, far = beyond that. */
export function statusFor(minutes: number, walkMinutes: number): ResidentStatus {
  if (minutes <= walkMinutes) return "near";
  if (minutes <= 2 * walkMinutes) return "mid";
  return "far";
}
