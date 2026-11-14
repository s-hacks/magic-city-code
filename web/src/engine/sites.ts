// The places a student may choose for a hub, with the facts Python's city.sites() shows:
// how many families live within the walk limit, how many of them have no car,
// and how far the site already is from a grocery store. All walking times are estimates.
// "Families nearby" adds up the weights of the resident dots within the walk limit of the
// site, the same way the coverage score counts people, so the two always agree.
import type { CityData, Mission, Site, SiteInfo } from "@mcc/shared";
import { estimateWalkMinutes, inBbox, walkRadiusMeters } from "./geo";
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

const METERS_PER_DEGREE_LAT = (6_371_000 * Math.PI) / 180;

/**
 * Facts for every candidate site. "Nearby" means a resident dot is within the mission's
 * walk limit of the site. Remembered per mission, so calling it again is free.
 */
export function describeSites(mission: Mission, data: CityData): SiteInfo[] {
  const prepared = prepareMission(mission, data);
  const cached = prepared.cache.get("describeSites") as SiteInfo[] | undefined;
  if (cached !== undefined) return cached;

  const result: SiteInfo[] = [];
  for (const site of candidateSites(mission, data)) {
    const position = sitePosition(site);
    // Quick box check first (a bit bigger than the walk circle) to skip far-away dots cheaply.
    const latReach = (walkRadiusMeters(mission.walkMinutes) / METERS_PER_DEGREE_LAT) * 1.01;
    const lonReach = latReach / Math.cos((site.lat * Math.PI) / 180);
    let familiesNearby = 0;
    let familiesWithoutCar = 0;
    for (const home of prepared.homes) {
      if (Math.abs(home.position[1] - site.lat) > latReach) continue;
      if (Math.abs(home.position[0] - site.lon) > lonReach) continue;
      if (estimateWalkMinutes(position, home.position) > mission.walkMinutes) continue;
      familiesNearby += home.weight;
      familiesWithoutCar += home.noCarWeight;
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
