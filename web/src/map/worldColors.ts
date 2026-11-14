// Real-world colors for the base map, shared by the mission/home map (mapStyle.ts) and the
// code-challenge map (style.ts). Day reads like a familiar street map: blue water, green
// parks and woods, tinted land use (homes, shops, industry, schools, hospitals), slate-blue
// highways and white main roads (kept out of the signal colors), warm buildings that turn
// glassy blue as they get taller. Night is the
// same city after dark: deep blue water, dark greens, violet-tinted districts and indigo
// roads, so the gold, green and orange signal lights on top still stand out.
// All layers here read OpenMapTiles vector tiles (OpenFreeMap).
import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";
import type { ThemeName } from "../theme";

export interface World {
  land: string;
  residential: string;
  commercial: string;
  industrial: string;
  school: string;
  hospital: string;
  cemetery: string;
  sports: string;
  park: string;
  grass: string;
  wood: string;
  farmland: string;
  sand: string;
  wetland: string;
  water: string;
  waterway: string;
  motorway: string;
  trunk: string;
  primary: string;
  secondary: string;
  tertiary: string;
  minor: string;
  path: string;
  casing: string;
  rail: string;
  buildingLow: string;
  buildingMid: string;
  buildingHigh: string;
  buildingOpacity: number;
  label: string;
  labelHalo: string;
  labelOpacity: number;
}

const DAY: World = {
  land: "#F2EFE9",
  residential: "#ECE6DF",
  commercial: "#F8E6DE",
  industrial: "#E6E1EE",
  school: "#F4EFDA",
  hospital: "#F8DADF",
  cemetery: "#D5E6CE",
  sports: "#C6E8C0",
  park: "#BFE3B4",
  grass: "#D3ECC6",
  wood: "#A3D198",
  farmland: "#EEF0D2",
  sand: "#F4E5BE",
  wetland: "#C6E5DF",
  water: "#94C6F0",
  waterway: "#7FB6E6",
  motorway: "#93A6D3", // slate blue: highways stay clear of the gold route and orange floods
  trunk: "#B5C2E2",
  primary: "#FFFFFF",
  secondary: "#FFFFFF",
  tertiary: "#FFFFFF",
  minor: "#FFFFFF",
  path: "#E2D3BE",
  casing: "#C4C9D8",
  rail: "#ADA6A0",
  buildingLow: "#DED9D2",
  buildingMid: "#D3C8BB",
  buildingHigh: "#AFBFD6",
  buildingOpacity: 0.9,
  label: "#3D4155",
  labelHalo: "#FFFFFF",
  labelOpacity: 0.9,
};

const NIGHT: World = {
  land: "#0B1028",
  residential: "#10163A",
  commercial: "#1F1745",
  industrial: "#191B3A",
  school: "#2A2342",
  hospital: "#301B3C",
  cemetery: "#102B2C",
  sports: "#0F3A30",
  park: "#0F3D34",
  grass: "#11332E",
  wood: "#0B3B2F",
  farmland: "#1A2B24",
  sand: "#2B2722",
  wetland: "#0E2F3C",
  water: "#17499A",
  waterway: "#1F60BC",
  motorway: "#8A63FF",
  trunk: "#6B5BE6",
  primary: "#4C62D8",
  secondary: "#3A4CAE",
  tertiary: "#2D3A88",
  minor: "#222C6E",
  path: "#2A3070",
  casing: "#0B1028",
  rail: "#3A3F70",
  buildingLow: "#1A2152",
  buildingMid: "#2C2F7E",
  buildingHigh: "#6E48CF",
  buildingOpacity: 0.92,
  label: "#A6AEDD",
  labelHalo: "#070A1C",
  labelOpacity: 0.6,
};

export const worldFor = (name: ThemeName): World => (name === "day" ? DAY : NIGHT);

const isPolygon: ExpressionSpecification = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];

/** Road color by OpenMapTiles class, so main roads, highways and side streets read apart. */
export function roadColorExpr(w: World): ExpressionSpecification {
  return [
    "match", ["get", "class"],
    "motorway", w.motorway,
    "trunk", w.trunk,
    "primary", w.primary,
    "secondary", w.secondary,
    "tertiary", w.tertiary,
    ["path", "track"], w.path,
    ["rail", "transit"], w.rail,
    w.minor,
  ];
}

/** Building color by height: low houses warm, towers glassy. */
export function buildingColorExpr(w: World): ExpressionSpecification {
  return [
    "interpolate", ["linear"], ["coalesce", ["get", "render_height"], ["get", "height"], 6],
    0, w.buildingLow, 18, w.buildingMid, 70, w.buildingHigh,
  ];
}

/** Land use and land cover fills the base style leaves out, drawn just above the background. */
export function landLayers(source: string, w: World, group?: string): LayerSpecification[] {
  const meta = group ? { metadata: { group } } : {};
  const landuse = (id: string, classes: string[], color: string, minzoom = 10): LayerSpecification => ({
    id: `land-${id}`,
    type: "fill",
    source,
    "source-layer": "landuse",
    minzoom,
    filter: ["all", isPolygon, ["match", ["get", "class"], classes, true, false]],
    paint: { "fill-color": color, "fill-opacity": 1 },
    ...meta,
  });
  const cover = (id: string, classes: string[], color: string): LayerSpecification => ({
    id: `cover-${id}`,
    type: "fill",
    source,
    "source-layer": "landcover",
    filter: ["all", isPolygon, ["match", ["get", "class"], classes, true, false]],
    paint: { "fill-color": color, "fill-opacity": 1 },
    ...meta,
  });
  return [
    cover("farmland", ["farmland"], w.farmland),
    cover("grass", ["grass"], w.grass),
    cover("sand", ["sand"], w.sand),
    cover("wetland", ["wetland"], w.wetland),
    landuse("commercial", ["commercial", "retail"], w.commercial),
    landuse("industrial", ["industrial", "railway", "garages", "quarry"], w.industrial),
    landuse("school", ["school", "college", "university", "kindergarten"], w.school, 11),
    landuse("hospital", ["hospital"], w.hospital, 11),
    landuse("cemetery", ["cemetery"], w.cemetery, 11),
    landuse("sports", ["stadium", "pitch", "playground", "track", "zoo", "theme_park"], w.sports, 12),
  ];
}
