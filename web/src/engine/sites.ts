// The places a student may choose for a hub, with the facts Python's city.sites() shows:
// how many families live within the walk limit, how many of them have no car,
// and how far the site already is from a store. All walking times are estimates.
import type { CityData, Mission, Site, SiteInfo } from "@mcc/shared";
import { estimateWalkMinutes, inBbox } from "./geo";
import { needOf } from "./areas";
import { nearestSource } from "./sources";
import { prepareMission, sitePosition } from "./prepare";

/** Sites inside the mission box whose kind the mission allows, in data order. */
export function candidateSites(mission: Mission, data: CityData): Site[] {
  const result: Site[] = [];
  for (const site of data.sites) {
    if (!mission.siteKinds.includes(site.kind)) continue;
    if (!inBbox(sitePosition(site), mission.area.bbox)) continue;
    result.push(site);
  }
  return result;
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/**
 * Facts for every candidate site. "Nearby" means the center of a mission block is within
 * the mission's walk limit of the site. Remembered per mission, so calling it again is free.
 */
export function describeSites(mission: Mission, data: CityData): SiteInfo[] {
  const prepared = prepareMission(mission, data);
  const cached = prepared.cache.get("describeSites") as SiteInfo[] | undefined;
  if (cached !== undefined) return cached;

  const result: SiteInfo[] = [];
  for (const site of candidateSites(mission, data)) {
    const position = sitePosition(site);
    let familiesNearby = 0;
    let familiesWithoutCar = 0;
    for (const area of prepared.areas) {
      if (estimateWalkMinutes(position, area.center) > mission.walkMinutes) continue;
      familiesNearby += needOf(area, mission.needColumn);
      familiesWithoutCar += needOf(area, "households_no_car");
    }
    const nearestStore = nearestSource(position, prepared.stores);
    result.push({
      id: site.id,
      name: site.name,
      kind: site.kind,
      lat: site.lat,
      lon: site.lon,
      families_nearby: Math.round(familiesNearby),
      families_without_car: Math.round(familiesWithoutCar),
      minutes_to_store: roundTo(nearestStore.minutes, 1),
    });
  }
  prepared.cache.set("describeSites", result);
  return result;
}
