// Residents: ~3,000 soft points of light, one IconLayer with a glow sprite.
// far = dim ember-red, mid = amber, near = bright gold and larger.
// Color, size and position change through deck.gl attribute transitions, so a
// Run or a Compare toggle animates on the GPU without per-dot React state.
// After a Run, residents served by a new hub drift part of the way toward it.
import { IconLayer } from "@deck.gl/layers";
import type { ResidentDot } from "@mcc/shared";
import { GLOW_MAPPING, glowAtlas } from "../sprites";
import { blendFor } from "../theme";
import { easeInOutCubic, zoomScale, type FrameCtx } from "./common";

export interface ResidentView {
  residents: ResidentDot[]; // keep the same array reference between frames
  drift: boolean; // true after a Run completes: served dots lean toward their hub
  key: string; // changes whenever the shown statuses change
}

const DRIFT = 0.18; // share of the way toward the food source

const SIZE = { far: 13, mid: 14, near: 24 } as const;

export function residentsLayer(view: ResidentView, ctx: FrameCtx) {
  const { pal } = ctx;
  return new IconLayer<ResidentDot>({
    id: "residents",
    data: view.residents,
    iconAtlas: glowAtlas(),
    iconMapping: GLOW_MAPPING,
    getIcon: () => "glow",
    sizeUnits: "pixels",
    sizeScale: zoomScale(ctx.zoom),
    getSize: (d) => SIZE[d.status],
    getColor: (d) => (d.status === "near" ? pal.residentNear : d.status === "mid" ? pal.residentMid : pal.residentFar),
    getPosition: (d) => {
      if (!view.drift || d.status !== "near" || !d.servedBy) return d.position;
      return [
        d.position[0] + (d.target[0] - d.position[0]) * DRIFT,
        d.position[1] + (d.target[1] - d.position[1]) * DRIFT,
      ];
    },
    billboard: true,
    pickable: false,
    parameters: blendFor(pal) as any,
    updateTriggers: {
      getColor: [view.key, ctx.dayMode],
      getSize: view.key,
      getPosition: [view.key, view.drift],
    },
    transitions: {
      getColor: { duration: 700, easing: easeInOutCubic },
      getSize: { duration: 700, easing: easeInOutCubic },
      getPosition: { duration: 1600, easing: easeInOutCubic },
    },
  });
}
