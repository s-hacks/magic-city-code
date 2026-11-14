// Work that only depends on the mission and the city data, done once and remembered.
// Student runs only add a handful of hubs, so everything here is reused between runs:
// which areas count, how far each area and each dot is from the nearest store, and so on.
import type { Area, CityData, LonLat, Mission, Site } from "@mcc/shared";
import { missionAreas, needOf } from "./areas";
import { makeHomes, type ResidentHome } from "./residents";
import { nearestSource, storeSources, type FoodSource, type Nearest } from "./sources";

export interface PreparedMission {
  areas: Area[];
  need: number[]; // need column value per area, same order as `areas`
  needTotal: number;
  areaStoreNearest: Nearest[]; // nearest existing store for each area center
  homes: ResidentHome[];
  homeStoreNearest: Nearest[]; // nearest existing store for each home
  stores: FoodSource[];
  /** Filled in lazily by other modules (baseline result, site descriptions). */
  cache: Map<string, unknown>;
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
  const existing = byKey.get(key);
  if (existing !== undefined) return existing;

  const areas = missionAreas(mission, data);
  const need: number[] = [];
  let needTotal = 0;
  for (const area of areas) {
    const value = needOf(area, mission.needColumn);
    need.push(value);
    needTotal += value;
  }
  const stores = storeSources(data.stores);
  const areaStoreNearest: Nearest[] = [];
  for (const area of areas) areaStoreNearest.push(nearestSource(area.center, stores));
  const homes = makeHomes(areas, mission.needColumn);
  const homeStoreNearest: Nearest[] = [];
  for (const home of homes) homeStoreNearest.push(nearestSource(home.position, stores));

  const prepared: PreparedMission = {
    areas,
    need,
    needTotal,
    areaStoreNearest,
    homes,
    homeStoreNearest,
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
