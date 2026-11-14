// Work that only depends on the mission and the city data, done once and remembered.
// Student runs only add a handful of hubs, so everything here is reused between runs:
// which areas count, where the resident dots sit, and how far each dot already is
// from the nearest existing source (grocery stores, or nothing for "none" missions).
import type { Area, CityData, LonLat, Mission, Site } from "@mcc/shared";
import { missionAreas, needOf } from "./areas";
import { makeHomes, type ResidentHome } from "./residents";
import { nearestSource, storeSources, type FoodSource, type Nearest } from "./sources";

export interface PreparedMission {
  areas: Area[];
  areaNeed: number[]; // need column value per area, same order as `areas`
  areaDots: number[]; // how many resident dots each area got
  needTotal: number; // total of the mission's need column over its areas
  homes: ResidentHome[];
  homeExistingNearest: Nearest[]; // nearest existing source for each home (before any hub)
  existing: FoodSource[]; // what already counts as a source: all stores, or none
  stores: FoodSource[]; // every store in the city (for minutes_to_store), whatever the mission
  /** Filled in lazily by other modules (baseline score, site descriptions). */
  cache: Map<string, unknown>;
}

/** Missing means "stores", so older mission JSON keeps working. */
export function existingSourcesOf(mission: Mission): "stores" | "none" {
  return mission.existingSources ?? "stores";
}

/** Everything about a mission that changes the prepared numbers. */
function missionKey(mission: Mission): string {
  return JSON.stringify([
    mission.id,
    mission.area.neighborhood,
    mission.area.bbox,
    mission.needColumn,
    mission.walkMinutes,
    mission.siteKinds,
    existingSourcesOf(mission),
  ]);
}

const preparedByData = new WeakMap<CityData, Map<string, PreparedMission>>();
const siteIndexByData = new WeakMap<CityData, Map<string, Site>>();

export function prepareMission(mission: Mission, data: CityData): PreparedMission {
  let byKey = preparedByData.get(data);
  if (byKey === undefined) {
    byKey = new Map();
    preparedByData.set(data, byKey);
  }
  const key = missionKey(mission);
  const existingPrepared = byKey.get(key);
  if (existingPrepared !== undefined) return existingPrepared;

  const areas = missionAreas(mission, data);
  const areaNeed: number[] = [];
  let needTotal = 0;
  for (const area of areas) {
    const need = needOf(area, mission.needColumn);
    areaNeed.push(need);
    needTotal += need;
  }

  const stores = storeSources(data.stores);
  const existing = existingSourcesOf(mission) === "stores" ? stores : [];
  const homes = makeHomes(areas, mission.needColumn);
  const homeExistingNearest: Nearest[] = [];
  for (const home of homes) homeExistingNearest.push(nearestSource(home.position, existing));
  const areaDots: number[] = areas.map(() => 0);
  for (const home of homes) areaDots[home.areaIndex]++;

  const prepared: PreparedMission = {
    areas,
    areaNeed,
    areaDots,
    needTotal,
    homes,
    homeExistingNearest,
    existing,
    stores,
    cache: new Map(),
  };
  byKey.set(key, prepared);
  return prepared;
}

/** Look up a site by id quickly. */
export function siteIndex(data: CityData): Map<string, Site> {
  let index = siteIndexByData.get(data);
  if (index === undefined) {
    index = new Map();
    for (const site of data.sites) index.set(site.id, site);
    siteIndexByData.set(data, index);
  }
  return index;
}

export function sitePosition(site: Site): LonLat {
  return [site.lon, site.lat];
}
