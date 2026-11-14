// Placed hubs: a gold beam of light drops from the sky at each site, lands,
// then a reach ring ripples out to the walk distance and stays as a thin circle.
// Animation is time-based: each hub has a dropAt time, and every frame we
// rebuild these few (<=10) items from `now`.
import { ColumnLayer, IconLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { PlacedHub } from "@mcc/shared";
import { GLOW_MAPPING, glowAtlas } from "../sprites";
import { blendFor, OVER } from "../theme";
import { clamp01, easeInCubic, easeOutCubic, labelProps, withAlpha, zoomScale, type FrameCtx } from "./common";

export interface TimedHub extends PlacedHub {
  dropAt: number; // performance.now() ms when the beam starts falling
}

export const BEAM_HEIGHT = 520; // meters
const DROP_FROM = 2200; // meters above ground at the start of the fall
export const DROP_MS = 450;
const RING_MS = 900;
const RIPPLE_MS = 1300;

interface HubFrame {
  hub: TimedHub;
  z: number; // beam base height
  landed: number; // 0..1 how far past landing (for glow/label fade-in)
  ring: number; // 0..1 ring growth
  ripple: number; // 0..1 one-shot ripple past the ring
}

function frame(hubs: TimedHub[], now: number): HubFrame[] {
  const out: HubFrame[] = [];
  for (const hub of hubs) {
    const dt = now - hub.dropAt;
    if (dt < 0) continue;
    const fall = clamp01(dt / DROP_MS);
    const after = dt - DROP_MS;
    out.push({
      hub,
      z: DROP_FROM * (1 - easeInCubic(fall)),
      landed: clamp01(after / 300),
      ring: after <= 0 ? 0 : easeOutCubic(after / RING_MS),
      ripple: after <= RING_MS * 0.6 ? 0 : clamp01((after - RING_MS * 0.6) / RIPPLE_MS),
    });
  }
  return out;
}

export function hubLayers(hubs: TimedHub[], walkRadiusMeters: number, ctx: FrameCtx) {
  const { pal, now } = ctx;
  const f = frame(hubs, now);
  const blend = blendFor(pal) as any;
  const t = Math.round(now); // update trigger for time-based accessors
  const rippling = f.filter((h) => h.ripple > 0 && h.ripple < 1);
  return [
    // Covered area: a very faint gold disc.
    new ScatterplotLayer<HubFrame>({
      id: "hub-reach-fill",
      data: f,
      getPosition: (d) => [d.hub.lon, d.hub.lat],
      getRadius: (d) => walkRadiusMeters * d.ring,
      getFillColor: (d) => withAlpha(pal.ring, 16 * d.ring),
      stroked: false,
      parameters: OVER as any,
      updateTriggers: { getRadius: t, getFillColor: [t, ctx.dayMode] },
    }),
    new ScatterplotLayer<HubFrame>({
      id: "hub-reach-ring",
      data: f.filter((d) => d.ring > 0),
      getPosition: (d) => [d.hub.lon, d.hub.lat],
      getRadius: (d) => walkRadiusMeters * d.ring,
      filled: false,
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 2.5,
      getLineColor: (d) => withAlpha(pal.ring, 120 + 100 * (1 - d.ring)),
      parameters: blend,
      updateTriggers: { getRadius: t, getLineColor: [t, ctx.dayMode] },
    }),
    new ScatterplotLayer<HubFrame>({
      id: "hub-ripple",
      data: rippling,
      getPosition: (d) => [d.hub.lon, d.hub.lat],
      getRadius: (d) => walkRadiusMeters * (1 + 0.35 * easeOutCubic(d.ripple)),
      filled: false,
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: (d) => 6 * (1 - d.ripple) + 1,
      getLineColor: (d) => withAlpha(pal.ring, 200 * (1 - d.ripple)),
      parameters: blend,
      updateTriggers: { getRadius: t, getLineWidth: t, getLineColor: [t, ctx.dayMode] },
    }),
    new IconLayer<HubFrame>({
      id: "hub-base-glow",
      data: f.filter((d) => d.landed > 0),
      iconAtlas: glowAtlas(),
      iconMapping: GLOW_MAPPING,
      getIcon: () => "glow",
      getPosition: (d) => [d.hub.lon, d.hub.lat],
      sizeUnits: "pixels",
      sizeScale: zoomScale(ctx.zoom),
      getSize: (d) => 40 + 60 * d.landed * (1 - 0.3 * d.ring),
      getColor: (d) => withAlpha(pal.beam, 255 * d.landed),
      parameters: blend,
      updateTriggers: { getSize: t, getColor: [t, ctx.dayMode] },
    }),
    new ColumnLayer<HubFrame>({
      id: "hub-beam-halo",
      data: f,
      diskResolution: 16,
      radius: 50,
      extruded: true,
      material: false,
      getPosition: (d) => [d.hub.lon, d.hub.lat, d.z],
      getElevation: BEAM_HEIGHT,
      getFillColor: pal.beamHalo,
      parameters: blend,
      updateTriggers: { getPosition: t, getFillColor: ctx.dayMode },
    }),
    new ColumnLayer<HubFrame>({
      id: "hub-beam",
      data: f,
      diskResolution: 12,
      radius: 16,
      extruded: true,
      material: false,
      getPosition: (d) => [d.hub.lon, d.hub.lat, d.z],
      getElevation: BEAM_HEIGHT,
      getFillColor: pal.beam,
      parameters: blend,
      updateTriggers: { getPosition: t, getFillColor: ctx.dayMode },
    }),
    new TextLayer<HubFrame>({
      id: "hub-labels",
      data: f.filter((d) => d.landed > 0),
      ...labelProps(pal),
      getPosition: (d) => [d.hub.lon, d.hub.lat, BEAM_HEIGHT + 20],
      getText: (d) => d.hub.name,
      // Stagger every other label so neighbors don't overlap.
      getPixelOffset: (d) => [0, d.hub.order % 2 ? -30 : 0],
      getSize: 18,
      getColor: (d) => withAlpha(pal.label, 255 * d.landed),
      outlineColor: pal.labelOutline,
      parameters: OVER as any,
      updateTriggers: { getColor: [t, ctx.dayMode] },
    }),
  ];
}
