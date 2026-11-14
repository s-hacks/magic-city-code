// Builds the MapLibre base style: OpenFreeMap "positron" restyled at load time.
// Night = near-black navy land, steel-blue 3D buildings, muted roads, dim labels.
// Day = the same layout in brighter colors for washed-out projectors.
// If the tile server cannot be reached (6 s timeout), a plain background style is
// used so the deck.gl lights still show; MapView retries in the background.
import type { StyleSpecification, LayerSpecification } from "maplibre-gl";

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

const NIGHT_LOOK: Look = {
  background: "#0B1020",
  park: "#0E1A26",
  water: "#06142A",
  residential: "#0D1326",
  wood: "#0E1924",
  waterway: "#0C2240",
  buildingLow: "#202B4D",
  buildingHigh: "#3A4F85",
  buildingOpacity: 0.92,
  motorway: "#3A4768",
  major: "#2B3756",
  minor: "#1C2541",
  casing: "#0F1529",
  rail: "#232D48",
  boundary: "#2A3350",
  text: "#8D99BC",
  textHalo: "#0B1020",
  textOpacity: 0.6,
};

const DAY_LOOK: Look = {
  background: "#E8ECF4",
  park: "#D5E5D3",
  water: "#A8C6E8",
  residential: "#E0E4EE",
  wood: "#CFE0CC",
  waterway: "#A8C6E8",
  buildingLow: "#B3BED3",
  buildingHigh: "#8796B6",
  buildingOpacity: 0.85,
  motorway: "#FFFFFF",
  major: "#FFFFFF",
  minor: "#F7F8FB",
  casing: "#C3CAD9",
  rail: "#B8BFCE",
  boundary: "#9AA3B8",
  text: "#3E4A66",
  textHalo: "#FFFFFF",
  textOpacity: 0.9,
};

const FETCH_TIMEOUT_MS = 6000;
const FALLBACK_KEY = "mcc:fallback";

// Only a successful (or still pending) fetch is kept. A failure clears the cache so
// the next call (day/night toggle, background retry) tries the network again.
let baseStyle: Promise<StyleSpecification | null> | null = null;

function fetchBase(): Promise<StyleSpecification | null> {
  if (!baseStyle) {
    const attempt: Promise<StyleSpecification | null> = fetch(BASE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      .then((r) => (r.ok ? (r.json() as Promise<StyleSpecification>) : null))
      .catch(() => null)
      .then((style) => {
        if (!style && baseStyle === attempt) baseStyle = null;
        return style;
      });
    baseStyle = attempt;
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
  return {
    version: 8,
    metadata: { [FALLBACK_KEY]: true },
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": k.background } }],
  };
}

/** True for the plain background style used when the tile server could not be reached. */
export function isFallbackStyle(style: StyleSpecification | null | undefined): boolean {
  return !!(style?.metadata as Record<string, unknown> | undefined)?.[FALLBACK_KEY];
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
