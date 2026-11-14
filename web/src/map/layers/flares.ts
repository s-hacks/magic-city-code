// Home-screen problem flares: a pulsing ember light rising over a neighborhood,
// with a short label ("No grocery store"). A new flare shoots up from the ground
// the first time its id appears, so reporting a problem visibly launches one.
import { IconLayer, LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { GLOW_MAPPING, glowAtlas } from "../sprites";
import { blendFor, OVER } from "../theme";
import { clamp01, easeOutCubic, labelProps, withAlpha, type FrameCtx } from "./common";

export interface Flare {
  id: string;
  lon: number;
  lat: number;
  label: string;
}

export interface TimedFlare extends Flare {
  bornAt: number; // performance.now() when first seen
}

const HEIGHT = 900; // meters
const RISE_MS = 1400;
const PULSE_MS = 2200;

interface FlareFrame {
  f: TimedFlare;
  h: number; // current head height
  pulse: number; // 0..1 repeating
  shown: number; // 0..1 label fade
}

export function flareLayers(flares: TimedFlare[], hoveredId: string | null, ctx: FrameCtx) {
  const { pal, now } = ctx;
  const t = Math.round(now);
  const data: FlareFrame[] = flares.map((f) => {
    const age = now - f.bornAt;
    const rise = easeOutCubic(age / RISE_MS);
    return { f, h: HEIGHT * rise, pulse: ((age + f.id.length * 397) % PULSE_MS) / PULSE_MS, shown: clamp01((age - RISE_MS * 0.6) / 500) };
  });
  const blend = blendFor(pal) as any;
  return [
    new ScatterplotLayer<FlareFrame>({
      id: "flare-ground-pulse",
      data,
      getPosition: (d) => [d.f.lon, d.f.lat],
      getRadius: (d) => 120 + 520 * d.pulse,
      filled: false,
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 3,
      getLineColor: (d) => withAlpha(pal.flare, 220 * (1 - d.pulse)),
      parameters: blend,
      updateTriggers: { getRadius: t, getLineColor: [t, ctx.dayMode] },
    }),
    new LineLayer<FlareFrame>({
      id: "flare-trails",
      data,
      getSourcePosition: (d) => [d.f.lon, d.f.lat, 0],
      getTargetPosition: (d) => [d.f.lon, d.f.lat, d.h],
      getColor: withAlpha(pal.flare, 170),
      getWidth: 3,
      widthUnits: "pixels",
      parameters: blend,
      updateTriggers: { getTargetPosition: t, getColor: ctx.dayMode },
    }),
    new IconLayer<FlareFrame>({
      id: "flare-heads",
      data,
      iconAtlas: glowAtlas(),
      iconMapping: GLOW_MAPPING,
      getIcon: () => "glow",
      getPosition: (d) => [d.f.lon, d.f.lat, d.h],
      sizeUnits: "pixels",
      getSize: (d) => (d.f.id === hoveredId ? 90 : 60) + 18 * Math.sin(d.pulse * Math.PI * 2),
      getColor: pal.flare,
      pickable: true,
      parameters: blend,
      updateTriggers: { getPosition: t, getSize: [t, hoveredId], getColor: ctx.dayMode },
    }),
    new TextLayer<FlareFrame>({
      id: "flare-labels",
      data,
      ...labelProps(pal),
      getPosition: (d) => [d.f.lon, d.f.lat, d.h],
      getPixelOffset: [0, -34],
      getText: (d) => d.f.label,
      getSize: (d) => (d.f.id === hoveredId ? 24 : 20),
      getColor: (d) => withAlpha(pal.label, 255 * d.shown),
      background: true,
      getBackgroundColor: (d) => withAlpha(pal.labelOutline, 200 * d.shown),
      backgroundPadding: [10, 6, 10, 6],
      pickable: true,
      parameters: OVER as any,
      updateTriggers: { getPosition: t, getColor: [t, ctx.dayMode], getBackgroundColor: [t, ctx.dayMode], getSize: hoveredId },
    }),
  ];
}
