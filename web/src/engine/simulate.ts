// The heart of the engine: take a mission and the student's actions, and work out
// what happens. Pure function: same inputs always give the same result.
//
// Steps:
//  1. Check the actions against the rules; keep only the valid hubs.
//  2. Food sources = every store in the city + the placed hubs.
//  3. For each mission block, find the nearest food source from the block's center.
//     A block is "covered" if that estimated walk is within the mission's limit.
//     Coverage = covered need / total need, where need is the mission's need column
//     (for example households with no car). So bigger blocks count for more.
//  4. Make the resident dots (same spots every run), each walking to its own nearest source.
//
// Why coverage uses block centers and not dots: the Census counts are per block, so the
// center is the honest unit, and the number does not wobble with dot placement.
// Dots are the picture; block centers are the score.
import type { Action, CityData, Level, Metrics, Mission, PlacedHub, ResidentDot, Result } from "@mcc/shared";
import { walkRadiusMeters } from "./geo";
import { checkActions } from "./rules";
import { statusFor } from "./residents";
import { closerOf, type FoodSource, type Nearest } from "./sources";
import { prepareMission, type PreparedMission } from "./prepare";

/** Small tolerance so 0.8 coverage counts as reaching an 0.8 goal despite float rounding. */
const GOAL_EPSILON = 1e-9;

function pickLevel(mission: Mission, levelIndex: number): Level {
  const last = mission.levels.length - 1;
  const index = Math.min(Math.max(0, Math.floor(levelIndex)), last);
  return mission.levels[index];
}

function hubSources(placed: PlacedHub[]): FoodSource[] {
  const sources: FoodSource[] = [];
  for (const hub of placed) sources.push({ position: [hub.lon, hub.lat], hubSiteId: hub.siteId });
  return sources;
}

function nearestWithHubs(from: [number, number], storeNearest: Nearest, hubs: FoodSource[]): Nearest {
  let best = storeNearest;
  for (const hub of hubs) best = closerOf(from, best, hub);
  return best;
}

interface AreaScore {
  needCovered: number;
  avgWalkMinutes: number;
}

/** Score the mission blocks for a given set of hubs. */
function scoreAreas(prepared: PreparedMission, walkMinutes: number, hubs: FoodSource[]): AreaScore {
  let needCovered = 0;
  let weightedMinutes = 0;
  for (let i = 0; i < prepared.areas.length; i++) {
    const nearest = nearestWithHubs(prepared.areas[i].center, prepared.areaStoreNearest[i], hubs);
    const need = prepared.need[i];
    if (nearest.minutes <= walkMinutes) needCovered += need;
    weightedMinutes += need * nearest.minutes;
  }
  const avgWalkMinutes = prepared.needTotal > 0 ? weightedMinutes / prepared.needTotal : 0;
  return { needCovered, avgWalkMinutes };
}

function baselineScore(prepared: PreparedMission, walkMinutes: number): AreaScore {
  const cached = prepared.cache.get("baselineScore") as AreaScore | undefined;
  if (cached !== undefined) return cached;
  const score = scoreAreas(prepared, walkMinutes, []);
  prepared.cache.set("baselineScore", score);
  return score;
}

function makeResidents(prepared: PreparedMission, walkMinutes: number, hubs: FoodSource[]): ResidentDot[] {
  const residents: ResidentDot[] = [];
  for (let i = 0; i < prepared.homes.length; i++) {
    const home = prepared.homes[i];
    const nearest = nearestWithHubs(home.position, prepared.homeStoreNearest[i], hubs);
    residents.push({
      id: i,
      areaId: home.areaId,
      position: home.position,
      target: nearest.target,
      minutes: Math.round(nearest.minutes * 10) / 10,
      status: statusFor(nearest.minutes, walkMinutes),
      servedBy: nearest.hubSiteId,
    });
  }
  return residents;
}

export function simulate(mission: Mission, actions: Action[], data: CityData, levelIndex = 0): Result {
  const prepared = prepareMission(mission, data);
  const level = pickLevel(mission, levelIndex);
  const { placed, errors } = checkActions(mission, level, actions, data);
  const hubs = hubSources(placed);

  const before = baselineScore(prepared, mission.walkMinutes);
  const now = hubs.length === 0 ? before : scoreAreas(prepared, mission.walkMinutes, hubs);
  const share = (covered: number) => (prepared.needTotal > 0 ? covered / prepared.needTotal : 0);

  const metrics: Metrics = {
    coverage: share(now.needCovered),
    avgWalkMinutes: now.avgWalkMinutes,
    needTotal: prepared.needTotal,
    needCovered: now.needCovered,
    baselineCoverage: share(before.needCovered),
    helped: now.needCovered - before.needCovered,
  };
  const ok = errors.length === 0;
  return {
    ok,
    errors,
    placed,
    metrics,
    residents: makeResidents(prepared, mission.walkMinutes, hubs),
    goalMet: ok && metrics.coverage >= level.goal.target - GOAL_EPSILON,
    walkRadiusMeters: walkRadiusMeters(mission.walkMinutes),
  };
}

/** The "before" picture: the same mission with no hubs placed. */
export function baseline(mission: Mission, data: CityData, levelIndex = 0): Result {
  return simulate(mission, [], data, levelIndex);
}
