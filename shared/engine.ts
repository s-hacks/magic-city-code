// Types passed between student code, the engine and the map.
import type { LonLat, SiteKind } from "./data";

/** Student code only produces these. It never draws. */
export interface Action {
  type: "place_hub";
  siteId: string;
  line?: number; // source line in the student's code, for highlighting
}

/** What Python's city.sites() returns for each site (computed by the engine). */
export interface SiteInfo {
  id: string;
  name: string;
  kind: SiteKind;
  lat: number;
  lon: number;
  families_nearby: number; // need-column count within walkMinutes of the site
  families_without_car: number; // households_no_car within walkMinutes
  minutes_to_store: number; // estimated walk from site to nearest existing store
}

export interface RuleError {
  code: "too_many" | "duplicate" | "outside_area" | "unknown_site" | "wrong_kind";
  message: string; // kid-readable
  line?: number;
  siteId?: string;
}

export interface PlacedHub {
  siteId: string;
  name: string;
  kind: SiteKind;
  lat: number;
  lon: number;
  line?: number;
  order: number; // 0-based placement order, drives the beam-drop animation
}

export type ResidentStatus = "near" | "mid" | "far"; // gold / yellow / ember-red

/** One glowing resident dot. Positions are stable across runs (seeded by area id). */
export interface ResidentDot {
  id: number;
  areaId: string;
  position: LonLat; // home
  target: LonLat; // nearest food source (store or hub)
  minutes: number; // estimated walk
  status: ResidentStatus;
  servedBy: string | null; // hub siteId if a hub is the nearest food source
}

export interface Metrics {
  coverage: number; // 0..1, need-weighted share within walkMinutes
  avgWalkMinutes: number; // need-weighted
  needTotal: number; // total of mission.needColumn in the mission area
  needCovered: number;
  baselineCoverage: number; // coverage with zero actions
  helped: number; // needCovered - baseline needCovered
}

export interface Result {
  ok: boolean; // false if any rule error
  errors: RuleError[];
  placed: PlacedHub[];
  metrics: Metrics;
  residents: ResidentDot[];
  goalMet: boolean;
  walkRadiusMeters: number; // straight-line radius equivalent of walkMinutes
}
