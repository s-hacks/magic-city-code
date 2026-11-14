// Builds the MapLibre base style: OpenFreeMap "positron" restyled at load time.
// Colors come from the UI tokens in ../theme.ts: graphite land and buildings, quiet
// roads, dim labels. Day = the same layout on light neutrals for washed-out projectors.
// Road and building layers carry metadata.group ("streets" / "buildings") so the
// legend chips can hide them.
// If the tile server cannot be reached, a plain background style is used so the
// deck.gl lights still show.
import type { StyleSpecification, LayerSpecification } from "maplibre-gl";
import { themes, type ThemeName } from "../theme";

const BASE_URL = "https://tiles.openfreemap.org/styles/positron";

interface Look {
  background: string;
  park: string;
  water: string;
  residential: string;
  wood: string;
  waterway: string;
  buildingLow: string;
  buildingHigh: string;
  buildingOpacity: number;
  motorway: string;
  major: string;
  minor: string;
  casing: string;
  rail: string;
  boundary: string;
  text: string;
  textHalo: string;
  textOpacity: number;
}

function lookFor(name: ThemeName): Look {
  const t = themes[name];
  const night = name === "night";
  return {
    background: t.land,
    park: t.park,
    water: t.water,
    residential: t.land,
    wood: t.park,
    waterway: t.water,
    buildingLow: t.buildingLow,
    buildingHigh: t.buildingHigh,
    buildingOpacity: 0.92,
    motorway: t.roadMajor,
    major: t.roadMajor,
    minor: t.road,
    casing: night ? t.land : t.line,
    rail: t.road,
    boundary: t.line,
    text: t.muted,
    textHalo: t.bg,
    textOpacity: night ? 0.55 : 0.85,
  };
}

const NIGHT_LOOK = lookFor("night");
const DAY_LOOK = lookFor("day");

let baseStyle: Promise<StyleSpecification | null> | null = null;

function fetchBase(): Promise<StyleSpecification | null> {
  if (!baseStyle) {
    baseStyle = fetch(BASE_URL)
      .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : null))
      .catch(() => null);
  }
  return baseStyle;
}

function roadColor(id: string, k: Look): string {
  if (id.includes("casing")) return k.casing;
  if (id.includes("motorway")) return k.motorway;
  if (id.includes("major")) return k.major;
  if (id.includes("railway")) return k.rail;
  return k.minor;
}

function restyleLayer(layer: LayerSpecification, k: Look): LayerSpecification | null {
  const l = JSON.parse(JSON.stringify(layer)) as any;
  const id: string = l.id;
  l.paint = l.paint ?? {};
  l.layout = l.layout ?? {};
  switch (l.type) {
    case "background":
      l.paint = { "background-color": k.background };
      return l;
    case "fill": {
      if (id === "building") {
        // Swap the flat footprint for a 3D extrusion.
        return {
          id: "building-3d",
          type: "fill-extrusion",
          source: l.source,
          "source-layer": "building",
          minzoom: 12.5,
          metadata: { group: "buildings" },
          paint: {
            "fill-extrusion-color": [
              "interpolate", ["linear"], ["coalesce", ["get", "render_height"], ["get", "height"], 6],
              0, k.buildingLow, 60, k.buildingHigh,
            ],
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 6],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": k.buildingOpacity,
          },
        } as any;
      }
      const color = id.includes("water")
        ? k.water
        : id.includes("park")
          ? k.park
          : id.includes("wood") || id.includes("landcover")
            ? k.wood
            : id.includes("residential")
              ? k.residential
              : k.minor;
      l.paint = { "fill-color": color, "fill-opacity": 1 };
      return l;
    }
    case "line": {
      if (l["source-layer"] === "waterway") {
        l.paint["line-color"] = k.waterway;
      } else if (l["source-layer"] === "boundary") {
        l.paint["line-color"] = k.boundary;
        l.paint["line-opacity"] = 0.5;
      } else {
        if (l["source-layer"] === "transportation") l.metadata = { ...(l.metadata ?? {}), group: "streets" };
        l.paint["line-color"] = roadColor(id, k);
        if (l.paint["line-opacity"] === undefined) l.paint["line-opacity"] = 0.95;
      }
      return l;
    }
    case "symbol": {
      // Shields and airport icons are noise at night.
      if (id.includes("shield") || id === "airport") return null;
      l.paint["text-color"] = k.text;
      l.paint["text-halo-color"] = k.textHalo;
      l.paint["text-halo-width"] = 1.2;
      l.paint["text-opacity"] = k.textOpacity;
      return l;
    }
    default:
      return l;
  }
}

function fallback(k: Look): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": k.background } }] };
}

/** The restyled base map for night (default) or day. */
export async function buildMapStyle(dayMode: boolean): Promise<StyleSpecification> {
  const k = dayMode ? DAY_LOOK : NIGHT_LOOK;
  const base = await fetchBase();
  if (!base) return fallback(k);
  const layers = base.layers.map((l) => restyleLayer(l, k)).filter(Boolean) as LayerSpecification[];
  // Buildings are drawn after roads so they rise above them.
  const bIdx = layers.findIndex((l) => l.id === "building-3d");
  if (bIdx >= 0) {
    const [b] = layers.splice(bIdx, 1);
    const firstSymbol = layers.findIndex((l) => l.type === "symbol");
    layers.splice(firstSymbol < 0 ? layers.length : firstSymbol, 0, b);
  }
  return { ...base, layers };
}

export const MAP_BACKGROUND = { night: NIGHT_LOOK.background, day: DAY_LOOK.background };
