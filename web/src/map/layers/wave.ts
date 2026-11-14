// Goal-met celebration: a band of gold light sweeps outward from the
// neighborhood center across the whole mission area, then fades.
import { ScatterplotLayer } from "@deck.gl/layers";
import type { LonLat } from "@mcc/shared";
import { blendFor } from "../theme";
import { clamp01, easeOutCubic, withAlpha, type FrameCtx } from "./common";

export interface Wave {
  center: LonLat;
  maxRadius: number; // meters
  startAt: number; // performance.now()
}

export const WAVE_MS = 1800;

export function waveLayers(wave: Wave | null, ctx: FrameCtx) {
  if (!wave) return [];
  const p = clamp01((ctx.now - wave.startAt) / WAVE_MS);
  if (p <= 0 || p >= 1) return [];
  const r = wave.maxRadius * easeOutCubic(p);
  const fade = 1 - p;
  const blend = blendFor(ctx.pal) as any;
  const t = Math.round(ctx.now);
  return [
    new ScatterplotLayer<Wave>({
      id: "goal-wave-band",
      data: [wave],
      getPosition: (d) => d.center,
      getRadius: r,
      filled: false,
      stroked: true,
      lineWidthUnits: "meters",
      getLineWidth: 90 + 160 * fade,
      getLineColor: withAlpha(ctx.pal.wave, 200 * fade),
      parameters: blend,
      updateTriggers: { getRadius: t, getLineWidth: t, getLineColor: t },
    }),
    new ScatterplotLayer<Wave>({
      id: "goal-wave-fill",
      data: [wave],
      getPosition: (d) => d.center,
      getRadius: r,
      getFillColor: withAlpha(ctx.pal.wave, 40 * fade),
      parameters: blend,
      updateTriggers: { getRadius: t, getFillColor: t },
    }),
  ];
}
