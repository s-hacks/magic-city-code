// Shapes of the static city data files in web/public/data/ (built by data/build.py).
// Every agent reads and writes these exact field names.

export type LonLat = [number, number];

/** One Census block group inside Birmingham. File: areas.json (Area[]). */
export interface Area {
  id: string; // 12-digit block-group GEOID
  neighborhood: string | null; // Neighborhood.id whose bbox holds the center, or null
  center: LonLat; // population-weighted or geometric center
  polygon: LonLat[][]; // outer ring(s), simplified, 5-decimal coords
  households: number;
  households_no_car: number;
  kids: number; // people under 18
  seniors: number; // people 65+
}

/** An existing supermarket. File: stores.json (Store[]). */
export interface Store {
  id: string; // "store_<osm id>"
  name: string;
  lat: number;
  lon: number;
}

export type SiteKind = "church" | "school" | "library" | "community_center";
export const SITE_KINDS: SiteKind[] = ["church", "school", "library", "community_center"];

/** A place that could host a hub. File: sites.json (Site[]). */
export interface Site {
  id: string; // "site_<osm id>"
  name: string;
  kind: SiteKind;
  lat: number;
  lon: number;
}

/** File: neighborhoods.json (Neighborhood[]). Hand-written. */
export interface Neighborhood {
  id: string; // kebab-case, e.g. "west-end"
  name: string; // "West End"
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  center: LonLat;
}

/** Need columns a mission can count. Keys of Area. */
export type NeedColumn = "households" | "households_no_car" | "kids" | "seniors";
export const NEED_COLUMNS: NeedColumn[] = ["households", "households_no_car", "kids", "seniors"];

export interface CityData {
  areas: Area[];
  stores: Store[];
  sites: Site[];
  neighborhoods: Neighborhood[];
}
