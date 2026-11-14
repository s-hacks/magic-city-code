// Builds the MapLibre base style: OpenFreeMap "positron" restyled at load time with the
// real-world colors in ./worldColors.ts (blue water, green parks, tinted land use, colored
// main roads, buildings shaded by height). Positron leaves most land use out, so those
// fills are added just above the residential layer. Day = a familiar street map;
// night = the same city after dark.
// Road and building layers carry metadata.group ("streets" / "buildings") so the
// legend chips can hide them.
// If the tile server cannot be reached (6 s timeout), a plain background style is
// used so the deck.gl lights still show; MapView retries in the background.
import type { StyleSpecification, LayerSpecification } from "maplibre-gl";
import { buildingColorExpr, landLayers, roadColorExpr, worldFor, type World } from "./worldColors";

const BASE_URL = "https://tiles.openfreemap.org/styles/positron";

const NIGHT_LOOK = worldFor("night");
const DAY_LOOK = worldFor("day");

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

function restyleLayer(layer: LayerSpecification, k: World): LayerSpecification | null {
  const l = JSON.parse(JSON.stringify(layer)) as any;
  const id: string = l.id;
  l.paint = l.paint ?? {};
  l.layout = l.layout ?? {};
  switch (l.type) {
    case "background":
      l.paint = { "background-color": k.land };
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
            "fill-extrusion-color": buildingColorExpr(k),
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
              : id.includes("aeroway")
                ? k.industrial
                : k.casing; // piers
      l.paint = { "fill-color": color, "fill-opacity": 1 };
      return l;
    }
    case "line": {
      if (l["source-layer"] === "waterway") {
        l.paint["line-color"] = k.waterway;
      } else if (l["source-layer"] === "boundary") {
        l.paint["line-color"] = k.rail;
        l.paint["line-opacity"] = 0.5;
      } else {
        if (l["source-layer"] === "transportation") l.metadata = { ...(l.metadata ?? {}), group: "streets" };
        // Casings outline the roads; the inner lines take their color from the road class.
        l.paint["line-color"] = id.includes("casing") ? k.casing : l["source-layer"] === "aeroway" ? k.minor : roadColorExpr(k);
        if (l.paint["line-opacity"] === undefined) l.paint["line-opacity"] = 0.95;
      }
      return l;
    }
    case "symbol": {
      // Shields and airport icons are noise at night.
      if (id.includes("shield") || id === "airport") return null;
      l.paint["text-color"] = k.label;
      l.paint["text-halo-color"] = k.labelHalo;
      l.paint["text-halo-width"] = 1.2;
      l.paint["text-opacity"] = k.labelOpacity;
      return l;
    }
    default:
      return l;
  }
}

function fallback(k: World): StyleSpecification {
  return {
    version: 8,
    metadata: { [FALLBACK_KEY]: true },
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": k.land } }],
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
  // Add the land use positron leaves out, right above its residential fill.
  const source = (base.layers.find((l) => (l as { source?: string }).source) as { source?: string } | undefined)?.source ?? "openmaptiles";
  const resIdx = layers.findIndex((l) => l.id === "landuse_residential");
  layers.splice(resIdx < 0 ? 1 : resIdx + 1, 0, ...landLayers(source, k));
  // Buildings are drawn after roads so they rise above them.
  const bIdx = layers.findIndex((l) => l.id === "building-3d");
  if (bIdx >= 0) {
    const [b] = layers.splice(bIdx, 1);
    const firstSymbol = layers.findIndex((l) => l.type === "symbol");
    layers.splice(firstSymbol < 0 ? layers.length : firstSymbol, 0, b);
  }
  return { ...base, layers };
}

export const MAP_BACKGROUND = { night: NIGHT_LOOK.land, day: DAY_LOOK.land };
