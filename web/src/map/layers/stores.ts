// Existing grocery stores: steady blue-white beacons (soft glow + a thin vertical light).
import { IconLayer, LineLayer } from "@deck.gl/layers";
import type { Store } from "@mcc/shared";
import { GLOW_MAPPING, glowAtlas } from "../sprites";
import { blendFor } from "../theme";
import { zoomScale, type FrameCtx } from "./common";

const BEACON_HEIGHT = 140; // meters

export function storeLayers(stores: Store[], ctx: FrameCtx) {
  const { pal } = ctx;
  return [
    new LineLayer<Store>({
      id: "store-beams",
      data: stores,
      getSourcePosition: (d) => [d.lon, d.lat, 0],
      getTargetPosition: (d) => [d.lon, d.lat, BEACON_HEIGHT],
      getColor: pal.storeLine,
      getWidth: 3,
      widthUnits: "pixels",
      parameters: blendFor(pal) as any,
    }),
    new IconLayer<Store>({
      id: "store-glow",
      data: stores,
      iconAtlas: glowAtlas(),
      iconMapping: GLOW_MAPPING,
      getIcon: () => "glow",
      getPosition: (d) => [d.lon, d.lat],
      getSize: 46,
      sizeScale: zoomScale(ctx.zoom),
      sizeUnits: "pixels",
      getColor: pal.store,
      pickable: true,
      parameters: blendFor(pal) as any,
      updateTriggers: { getColor: ctx.dayMode },
    }),
  ];
}
