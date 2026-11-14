// The engine's front door. Everything the app, the map and the Python worker need
// from the engine is exported here. The engine is pure: no React, no DOM, no network,
// no clock, and only seeded randomness.
export { simulate, baseline } from "./simulate";
export { describeSites, candidateSites } from "./sites";
export { missionAreas, neighborhoodsSummary, needOf, isMissionArea } from "./areas";
export {
  estimateWalkMinutes,
  haversineMeters,
  walkRadiusMeters,
  inBbox,
  pointInPolygon,
  DETOUR_FACTOR,
  WALK_METERS_PER_MINUTE,
  EARTH_RADIUS_METERS,
} from "./geo";
export { TARGET_RESIDENT_DOTS, statusFor } from "./residents";
export { NO_SOURCE_MINUTES } from "./sources";
export { checkActions } from "./rules";
