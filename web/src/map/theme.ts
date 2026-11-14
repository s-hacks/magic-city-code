// Colors and blend settings for the deck.gl lights, in one place.
// Every color here is derived from the UI tokens in ../theme.ts (indigo neutrals plus
// a gold accent and fixed signal colors), so swapping that file restyles the CSS, the base
// map and the lights together. Night is the default look; Day is the brighter projector fallback (D key).

import { themes, type ThemeName } from "../theme";

export type RGBA = [number, number, number, number];

/** "#RRGGBB" -> [r, g, b, a]. */
export function rgba(hex: string, a = 255): RGBA {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
}

/** Mix two "#RRGGBB" colors; t = 0 gives `a`, t = 1 gives `b`. */
function mix(a: string, b: string, t: number, alpha = 255): RGBA {
  const x = rgba(a);
  const y = rgba(b);
  return [0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t)).concat(alpha) as RGBA;
}

export interface Palette {
  residentFar: RGBA; // unlit: ash
  residentMid: RGBA; // longer walk: ash warming toward the accent
  residentNear: RGBA; // lit: gold
  store: RGBA;
  storeLine: RGBA;
  siteFill: RGBA;
  siteKind: Record<string, RGBA>;
  beam: RGBA;
  beamHalo: RGBA;
  ring: RGBA;
  haze: [number, number, number]; // alpha is computed per area
  hazeMaxAlpha: number;
  flare: RGBA;
  label: RGBA;
  labelOutline: RGBA;
  wave: RGBA;
  additive: boolean; // additive glow only works on a dark map
}

function build(name: ThemeName): Palette {
  const t = themes[name];
  const night = name === "night";
  // Signal colors mean the same thing everywhere (docs/ui-plan.md §10):
  // gold = lit / your hubs, green = grocery stores (fresh food), orange = problems.
  // Sites are quiet outlines; every kind shares the muted ink.
  const site = rgba(t.muted);
  return {
    residentFar: rgba(t.ash, night ? 170 : 210),
    // Only lit residents are gold; a longer walk is still mostly ash, faintly warm.
    residentMid: mix(t.ash, t.accent, 0.2, night ? 180 : 215),
    residentNear: rgba(t.accent, night ? 245 : 255),
    store: rgba(t.green),
    storeLine: rgba(t.green, night ? 150 : 200),
    siteFill: rgba(t.bg, 225),
    siteKind: { church: site, school: site, library: site, community_center: site },
    beam: rgba(t.accent, 235),
    beamHalo: rgba(t.accent, night ? 60 : 70),
    ring: rgba(t.accent, 230),
    haze: rgba(t.orange).slice(0, 3) as [number, number, number],
    hazeMaxAlpha: night ? 55 : 35,
    flare: rgba(t.orange),
    label: rgba(t.text),
    labelOutline: rgba(t.bg, 235),
    wave: rgba(t.accent),
    additive: night,
  };
}

export const NIGHT: Palette = build("night");
export const DAY: Palette = build("day");

export const palette = (dayMode?: boolean) => (dayMode ? DAY : NIGHT);

/** luma.gl v9 parameters: additive glow, no depth test (so lights sit on top). */
export const ADDITIVE = {
  depthWriteEnabled: false,
  depthCompare: "always",
  blend: true,
  blendColorOperation: "add",
  blendColorSrcFactor: "src-alpha",
  blendColorDstFactor: "one",
  blendAlphaOperation: "add",
  blendAlphaSrcFactor: "one",
  blendAlphaDstFactor: "one-minus-src-alpha",
} as const;

/** Normal alpha blending, no depth test. Used in day mode and for markers. */
export const OVER = {
  depthWriteEnabled: false,
  depthCompare: "always",
  blend: true,
  blendColorOperation: "add",
  blendColorSrcFactor: "src-alpha",
  blendColorDstFactor: "one-minus-src-alpha",
  blendAlphaOperation: "add",
  blendAlphaSrcFactor: "one",
  blendAlphaDstFactor: "one-minus-src-alpha",
} as const;

export const blendFor = (p: Palette) => (p.additive ? ADDITIVE : OVER);

export const LABEL_FONT = "'Space Grotesk', 'Inter', system-ui, sans-serif";
