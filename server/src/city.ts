// Reads the static city data (neighborhoods, block groups, candidate sites) from web/public/data.
// Files may not exist yet while the data is being built, so every loader copes with a missing file.
// Files are re-read when they change on disk.
import fs from "node:fs";
import path from "node:path";
import type { Area, CityData as EngineCityData, Neighborhood, Site, SiteKind, Store } from "@mcc/shared";
import { DATA_DIR } from "./paths";

export interface CityData {
  neighborhoods: Neighborhood[] | null; // null = file missing
  areas: Area[] | null;
  sites: Site[] | null;
  stores?: Store[] | null;
}

const cache = new Map<string, { mtimeMs: number; value: unknown }>();

/** Read a JSON file, or return null if it is missing or broken. Cached by modified time. */
export function readJsonFile<T>(file: string): T | null {
  try {
    const stat = fs.statSync(file);
    const hit = cache.get(file);
    if (hit && hit.mtimeMs === stat.mtimeMs) return hit.value as T;
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    cache.set(file, { mtimeMs: stat.mtimeMs, value });
    return value;
  } catch {
    return null;
  }
}

export function loadCity(dir: string = DATA_DIR): CityData {
  const arr = <T>(name: string) => {
    const v = readJsonFile<T[]>(path.join(dir, name));
    return Array.isArray(v) ? v : null;
  };
  return {
    neighborhoods: arr<Neighborhood>("neighborhoods.json"),
    areas: arr<Area>("areas.json"),
    sites: arr<Site>("sites.json"),
    stores: arr<Store>("stores.json"),
  };
}

type BBox = [number, number, number, number];

export function inBBox(lon: number, lat: number, bbox: BBox): boolean {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

/** Block groups that belong to a neighborhood (tagged with it, or centered inside its box). */
export function areasIn(city: CityData, hood: Neighborhood): Area[] | null {
  if (!city.areas) return null;
  return city.areas.filter((a) => a.neighborhood === hood.id || inBBox(a.center[0], a.center[1], hood.bbox));
}

/** Candidate sites of the given kinds inside a box. */
export function sitesIn(city: CityData, bbox: BBox, kinds: SiteKind[]): Site[] | null {
  if (!city.sites) return null;
  const allowed = new Set(kinds);
  return city.sites.filter((s) => allowed.has(s.kind) && inBBox(s.lon, s.lat, bbox));
}

export function findNeighborhood(city: CityData, id: string | null | undefined): Neighborhood | null {
  if (!id) return null;
  return (city.neighborhoods ?? []).find((n) => n.id === id) ?? null;
}

/**
 * Rough boxes used only while neighborhoods.json does not exist yet, so the offline demo
 * still has somewhere to point. The real file always wins.
 */
export const FALLBACK_NEIGHBORHOODS: Neighborhood[] = [
  { id: "west-end", name: "West End", bbox: [-86.885, 33.475, -86.845, 33.5], center: [-86.865, 33.488] },
  { id: "ensley", name: "Ensley", bbox: [-86.91, 33.505, -86.87, 33.535], center: [-86.89, 33.52] },
  { id: "woodlawn", name: "Woodlawn", bbox: [-86.775, 33.522, -86.735, 33.548], center: [-86.755, 33.535] },
  { id: "east-lake", name: "East Lake", bbox: [-86.745, 33.55, -86.705, 33.58], center: [-86.725, 33.565] },
  { id: "southside", name: "Southside", bbox: [-86.815, 33.49, -86.785, 33.512], center: [-86.8, 33.5] },
];

/** The neighborhood list to offer: the real file if present, else the rough fallback list. */
export function neighborhoodList(city: CityData): Neighborhood[] {
  return city.neighborhoods && city.neighborhoods.length > 0 ? city.neighborhoods : FALLBACK_NEIGHBORHOODS;
}

export function findNeighborhoodOrFallback(city: CityData, id: string | null | undefined): Neighborhood | null {
  if (!id) return null;
  return neighborhoodList(city).find((n) => n.id === id) ?? null;
}

/** How many candidate sites of each kind are inside a box, or null if sites.json is missing. */
export function siteCounts(city: CityData, bbox: BBox): Partial<Record<SiteKind, number>> | null {
  if (!city.sites) return null;
  const counts: Partial<Record<SiteKind, number>> = {};
  for (const s of city.sites) if (inBBox(s.lon, s.lat, bbox)) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
  return counts;
}

/** The full data set the engine needs, or null if any file is still missing. */
export function engineData(city: CityData): EngineCityData | null {
  if (!city.areas || !city.sites || !city.neighborhoods || !city.stores) return null;
  return { areas: city.areas, sites: city.sites, neighborhoods: city.neighborhoods, stores: city.stores };
}
