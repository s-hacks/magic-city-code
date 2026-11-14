// Need haze: a faint red glow on the ground over areas with many households
// without a car whose residents are still far from food. Soft glow sprites
// (sized in meters) rather than hard block-group polygons. Fades as areas are covered.
import { IconLayer } from "@deck.gl/layers";
import type { Area } from "@mcc/shared";
import { GLOW_MAPPING, glowAtlas } from "../sprites";
import { blendFor } from "../theme";
import type { FrameCtx } from "./common";

export interface HazeView {
  areas: Area[]; // stable array
  maxNeed: number; // largest households_no_car among `areas`
  farShare: Map<string, number> | null; // areaId -> share of shown residents that are far (null = unknown, treat as 1)
  key: string; // changes when farShare changes
}

export function hazeLayer(view: HazeView, ctx: FrameCtx) {
  const { pal } = ctx;
  const alpha = (a: Area) => {
    const need = view.maxNeed > 0 ? Math.sqrt(a.households_no_car / view.maxNeed) : 0;
    const far = view.farShare ? view.farShare.get(a.id) ?? 0 : 1;
    return pal.hazeMaxAlpha * need * far;
  };
  return new IconLayer<Area>({
    id: "need-haze",
    data: view.areas,
    iconAtlas: glowAtlas(),
    iconMapping: GLOW_MAPPING,
    getIcon: () => "glow",
    getPosition: (d) => d.center,
    sizeUnits: "meters",
    getSize: 900,
    billboard: false,
    getColor: (d) => [pal.haze[0], pal.haze[1], pal.haze[2], alpha(d)],
    parameters: blendFor(pal) as any,
    updateTriggers: { getColor: [view.key, ctx.dayMode] },
    transitions: { getColor: 1200 },
  });
}
