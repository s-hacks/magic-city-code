// Colors and blend settings for the map, in one place.
// Night is the default look; Day is a brighter palette for washed-out projectors.
// Tokens follow docs/ui-plan.md section 10.

export type RGBA = [number, number, number, number];

export const TOKENS = {
  night: "#0B1020",
  steel: "#1C2540",
  ember: "#FF5A3C",
  gold: "#FFC44D",
  beacon: "#5CC8FF",
  go: "#3DDC97",
  paper: "#F2F5FF",
};

export interface Palette {
  residentFar: RGBA;
  residentMid: RGBA;
  residentNear: RGBA;
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

export const NIGHT: Palette = {
  residentFar: [255, 80, 55, 140],
  residentMid: [255, 118, 50, 165],
  residentNear: [255, 200, 80, 235],
  store: [150, 220, 255, 255],
  storeLine: [92, 200, 255, 200],
  siteFill: [11, 16, 32, 220],
  siteKind: {
    church: [200, 180, 255, 255],
    school: [120, 230, 200, 255],
    library: [255, 210, 150, 255],
    community_center: [150, 200, 255, 255],
  },
  beam: [255, 196, 77, 230],
  beamHalo: [255, 170, 40, 60],
  ring: [255, 196, 77, 220],
  haze: [255, 60, 40],
  hazeMaxAlpha: 85,
  flare: [255, 90, 60, 255],
  label: [242, 245, 255, 255],
  labelOutline: [11, 16, 32, 235],
  wave: [255, 210, 110, 255],
  additive: true,
};

export const DAY: Palette = {
  residentFar: [205, 35, 25, 215],
  residentMid: [225, 90, 30, 225],
  residentNear: [205, 140, 0, 255],
  store: [0, 110, 190, 255],
  storeLine: [0, 110, 190, 220],
  siteFill: [255, 255, 255, 235],
  siteKind: {
    church: [100, 60, 190, 255],
    school: [0, 130, 100, 255],
    library: [170, 90, 0, 255],
    community_center: [20, 90, 180, 255],
  },
  beam: [230, 150, 0, 235],
  beamHalo: [230, 150, 0, 70],
  ring: [200, 120, 0, 255],
  haze: [220, 40, 20],
  hazeMaxAlpha: 80,
  flare: [214, 48, 31, 255],
  label: [20, 26, 48, 255],
  labelOutline: [255, 255, 255, 240],
  wave: [230, 150, 0, 255],
  additive: false,
};

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
