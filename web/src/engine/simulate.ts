// The heart of the engine: take a mission and the student's actions, and work out
// what happens. Pure function: same inputs always give the same result.
//
// Steps:
//  1. Check the actions against the rules; keep only the valid hubs.
//  2. Sources = what already exists (every grocery store in the city, or nothing when
//     mission.existingSources is "none") + the placed hubs.
//  3. For each resident dot, find the nearest source from the dot's own home.
//     A dot is "near" if that estimated walk is within the mission's limit.
//  4. Score with dot weights. Each dot stands for (block need / dots in that block), where
//     need is the mission's need column (for example households with no car).
//       coverage       = weight of near dots / total need
//       needCovered    = weight of near dots
//       avgWalkMinutes = weight-averaged walk over all dots
//       helped         = needCovered now - needCovered with no hubs
//
// Why dots and not block centers: a block is not a point. Scoring at the center made a
// store 10.3 minutes from a center count for nobody, even when half the block lives
// closer. Dots spread each block's need over its real shape. Dot positions are seeded,
// so the score is the same on every run.
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

function nearestWithHubs(from: [number, number], existingNearest: Nearest, hubs: FoodSource[]): Nearest {
  let best = existingNearest;
  for (const hub of hubs) best = closerOf(from, best, hub);
  return best;
}

interface Outcome {
  needCovered: number;
  avgWalkMinutes: number;
  residents: ResidentDot[];
}

/** Walk every dot to its nearest source and add up the weighted score. */
function runDots(prepared: PreparedMission, walkMinutes: number, hubs: FoodSource[]): Outcome {
  // Count near dots per block, then need covered = block need x (near dots / block dots).
  // Same as adding up dot weights, but a fully covered block counts exactly its need.
  const nearDots: number[] = prepared.areas.map(() => 0);
  let weightedMinutes = 0;
  const residents: ResidentDot[] = [];
  for (let i = 0; i < prepared.homes.length; i++) {
    const home = prepared.homes[i];
    const nearest = nearestWithHubs(home.position, prepared.homeExistingNearest[i], hubs);
    const status = statusFor(nearest.minutes, walkMinutes);
    if (status === "near") nearDots[home.areaIndex]++;
    weightedMinutes += home.weight * nearest.minutes;
    residents.push({
      id: i,
      areaId: home.areaId,
      position: home.position,
      target: nearest.target,
      minutes: Math.round(nearest.minutes * 10) / 10,
      status,
      servedBy: nearest.hubSiteId,
    });
  }
  let needCovered = 0;
  for (let a = 0; a < prepared.areas.length; a++) {
    if (nearDots[a] === 0) continue;
    needCovered += nearDots[a] === prepared.areaDots[a] ? prepared.areaNeed[a] : (prepared.areaNeed[a] * nearDots[a]) / prepared.areaDots[a];
  }
  const avgWalkMinutes = prepared.needTotal > 0 ? weightedMinutes / prepared.needTotal : 0;
  return { needCovered, avgWalkMinutes, residents };
}

/** needCovered with no hubs, worked out once per mission. */
function baselineCovered(prepared: PreparedMission, walkMinutes: number): number {
  const cached = prepared.cache.get("baselineCovered") as number | undefined;
  if (cached !== undefined) return cached;
  const covered = runDots(prepared, walkMinutes, []).needCovered;
  prepared.cache.set("baselineCovered", covered);
  return covered;
}

export function simulate(mission: Mission, actions: Action[], data: CityData, levelIndex = 0): Result {
  const prepared = prepareMission(mission, data);
  const level = pickLevel(mission, levelIndex);
  const { placed, errors } = checkActions(mission, level, actions, data);
  const hubs = hubSources(placed);

  const now = runDots(prepared, mission.walkMinutes, hubs);
  const beforeCovered = hubs.length === 0 ? now.needCovered : baselineCovered(prepared, mission.walkMinutes);
  const share = (covered: number) => (prepared.needTotal > 0 ? covered / prepared.needTotal : 0);

  const metrics: Metrics = {
    coverage: share(now.needCovered),
    avgWalkMinutes: now.avgWalkMinutes,
    needTotal: prepared.needTotal,
    needCovered: now.needCovered,
    baselineCoverage: share(beforeCovered),
    helped: now.needCovered - beforeCovered,
  };
  const ok = errors.length === 0;
  return {
    ok,
    errors,
    placed,
    metrics,
    residents: now.residents,
    goalMet: ok && metrics.coverage >= level.goal.target - GOAL_EPSILON,
    walkRadiusMeters: walkRadiusMeters(mission.walkMinutes),
  };
}

/** The "before" picture: the same mission with no hubs placed. */
export function baseline(mission: Mission, data: CityData, levelIndex = 0): Result {
  return simulate(mission, [], data, levelIndex);
}
