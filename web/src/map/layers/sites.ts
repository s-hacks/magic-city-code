// Possible hub sites: a dark disc with a colored outline and a kind pictogram
// (church, school, library, rec center). The hovered site grows and brightens.
import { IconLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Site } from "@mcc/shared";
import { siteIconUrl } from "../sprites";
import { OVER } from "../theme";
import { withAlpha, zoomScale, type FrameCtx } from "./common";

export function siteLayers(sites: Site[], hoveredId: string | null, ctx: FrameCtx) {
  const { pal } = ctx;
  const s = zoomScale(ctx.zoom);
  const kindColor = (d: Site) => pal.siteKind[d.kind] ?? pal.label;
  return [
    new ScatterplotLayer<Site>({
      id: "site-discs",
      data: sites,
      getPosition: (d) => [d.lon, d.lat],
      radiusUnits: "pixels",
      getRadius: (d) => (d.id === hoveredId ? 19 : 13) * s,
      filled: true,
      stroked: true,
      getFillColor: (d) => (d.id === hoveredId ? withAlpha(kindColor(d), 90) : pal.siteFill),
      getLineColor: (d) => withAlpha(kindColor(d), d.id === hoveredId ? 255 : 170),
      lineWidthUnits: "pixels",
      getLineWidth: (d) => (d.id === hoveredId ? 3.5 : 2),
      pickable: true,
      parameters: OVER as any,
      updateTriggers: {
        getRadius: [hoveredId, s],
        getFillColor: [hoveredId, ctx.dayMode],
        getLineColor: [hoveredId, ctx.dayMode],
        getLineWidth: hoveredId,
      },
      transitions: { getRadius: 150 },
    }),
    new IconLayer<Site>({
      id: "site-icons",
      data: sites,
      getPosition: (d) => [d.lon, d.lat],
      getIcon: (d) => ({ url: siteIconUrl(d.kind), width: 64, height: 64, id: d.kind, mask: true }),
      getSize: (d) => (d.id === hoveredId ? 22 : 15) * s,
      sizeUnits: "pixels",
      getColor: (d) => withAlpha(kindColor(d), d.id === hoveredId ? 255 : 200),
      pickable: false,
      parameters: OVER as any,
      updateTriggers: { getSize: [hoveredId, s], getColor: [hoveredId, ctx.dayMode] },
    }),
  ];
}
