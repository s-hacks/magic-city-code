// Which blocks (Census block groups) belong to a mission, and how much
// need each one has. An area counts if its center sits inside the mission's box,
// or if the data already tags it with the mission's neighborhood.
import type { Area, CityData, Mission, Neighborhood, NeedColumn } from "@mcc/shared";
import { inBbox } from "./geo";

export function isMissionArea(area: Area, mission: Mission): boolean {
  if (inBbox(area.center, mission.area.bbox)) return true;
  return area.neighborhood !== null && area.neighborhood === mission.area.neighborhood;
}

/** The block groups counted by this mission, in data order. */
export function missionAreas(mission: Mission, data: CityData): Area[] {
  const result: Area[] = [];
  for (const area of data.areas) {
    if (isMissionArea(area, mission)) result.push(area);
  }
  return result;
}

/** How much need an area has for a given column (missing or bad values count as 0). */
export function needOf(area: Area, column: NeedColumn): number {
  const value = area[column];
  return typeof value === "number" && value > 0 ? value : 0;
}

/**
 * Neighborhoods touched by this mission (the mission's own one, plus any that hold one of its areas), each with the number of households
 * from the mission's areas that sit in it. Feeds Python's city.neighborhoods().
 */
export function neighborhoodsSummary(
  mission: Mission,
  data: CityData,
): (Neighborhood & { households: number })[] {
  const areas = missionAreas(mission, data);
  const householdsById = new Map<string, number>();
  for (const area of areas) {
    if (area.neighborhood === null) continue;
    householdsById.set(area.neighborhood, (householdsById.get(area.neighborhood) ?? 0) + needOf(area, "households"));
  }
  const result: (Neighborhood & { households: number })[] = [];
  for (const hood of data.neighborhoods) {
    const counted = householdsById.has(hood.id);
    const isMain = hood.id === mission.area.neighborhood;
    if (!counted && !isMain) continue;
    result.push({ ...hood, households: Math.round(householdsById.get(hood.id) ?? 0) });
  }
  return result;
}
