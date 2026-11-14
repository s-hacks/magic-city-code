// Shared helpers for the deck.gl layer builders: easing, frame context, label defaults.
import type { Palette } from "../theme";
import { LABEL_FONT } from "../theme";

/** Everything a layer builder needs about "now". Built once per animation frame. */
export interface FrameCtx {
  now: number; // performance.now() in ms
  zoom: number; // current map zoom
  pal: Palette;
  dayMode: boolean;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInCubic = (x: number) => Math.pow(clamp01(x), 3);
export const easeInOutCubic = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const withAlpha = (c: number[], a: number): [number, number, number, number] => [c[0], c[1], c[2], Math.round(a)];

/** Dot size multiplier so lights stay readable from a city overview down to a block. */
export const zoomScale = (zoom: number) => Math.min(1.5, Math.max(0.45, Math.pow(2, (zoom - 14) * 0.6)));

/** TextLayer props that read well on a projector. */
export function labelProps(pal: Palette) {
  return {
    fontFamily: LABEL_FONT,
    fontWeight: 600,
    characterSet: "auto" as const,
    fontSettings: { sdf: true, fontSize: 64, buffer: 10, radius: 12 },
    outlineWidth: 3,
    outlineColor: pal.labelOutline,
    sizeUnits: "pixels" as const,
    billboard: true,
    getTextAnchor: "middle" as const,
    getAlignmentBaseline: "bottom" as const,
  };
}
