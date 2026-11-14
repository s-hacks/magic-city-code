// Camera moves: the home fly-in over Birmingham, the ease into a mission's
// neighborhood, and the small push-in when Run is pressed.
import type { Map as MlMap, PaddingOptions } from "maplibre-gl";
import type { LonLat } from "@mcc/shared";

export const BHAM_CENTER: LonLat = [-86.81, 33.52];

export const MISSION_PITCH = 55;
export const MISSION_BEARING = -20;

export type Bbox = [number, number, number, number];

export const bboxCenter = (b: Bbox): LonLat => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

/** Rough half-diagonal of a bbox in meters. */
export function bboxRadiusMeters(b: Bbox): number {
  const midLat = ((b[1] + b[3]) / 2) * (Math.PI / 180);
  const dx = (b[2] - b[0]) * 111320 * Math.cos(midLat);
  const dy = (b[3] - b[1]) * 110540;
  return Math.hypot(dx, dy) / 2;
}

/** Start high above the city, flat, then glide down to a pitched 3D view.
 *  `padding` keeps the city clear of screen overlays (the home hero sits on the left);
 *  it is applied as a one-off offset so later mission framing is not affected. */
export function flyIn(map: MlMap, padding?: PaddingOptions) {
  const offset: [number, number] = padding ? [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2] : [0, 0];
  map.stop();
  map.jumpTo({ center: [BHAM_CENTER[0] + 0.02, BHAM_CENTER[1] - 0.04], zoom: 9.3, pitch: 0, bearing: 0 });
  // With an overlay on one side there is less room, so pull back to keep every flare in view.
  const zoom = padding && Math.abs(offset[0]) > 100 ? 11.7 : 12.3;
  map.flyTo({ center: [BHAM_CENTER[0] - (padding ? 0.01 : 0), BHAM_CENTER[1] - 0.005], zoom, pitch: 52, bearing: -18, offset, duration: 5000, curve: 1.25, essential: true });
}

function fit(map: MlMap, bbox: Bbox, padding: PaddingOptions) {
  const c = map.getContainer();
  const pad = { ...padding };
  // If the panels leave too little room, shrink the padding instead of failing.
  if (pad.left + pad.right > c.clientWidth * 0.8) pad.left = pad.right = c.clientWidth * 0.1;
  if (pad.top + pad.bottom > c.clientHeight * 0.8) pad.top = pad.bottom = c.clientHeight * 0.1;
  const cam = map.cameraForBounds([bbox[0], bbox[1], bbox[2], bbox[3]], { padding: pad, bearing: MISSION_BEARING });
  const center = (cam?.center as any) ?? bboxCenter(bbox);
  // A pitched view squeezes the far edge, so we can come in a little closer.
  const zoom = (cam?.zoom ?? 14) + 0.15;
  return { center, zoom };
}

/** Ease into a mission's area, tilted. Returns the target zoom for later push-ins. */
export function flyToMission(map: MlMap, bbox: Bbox, padding: PaddingOptions): number {
  const { center, zoom } = fit(map, bbox, padding);
  map.stop();
  map.flyTo({ center, zoom, pitch: MISSION_PITCH, bearing: MISSION_BEARING, duration: 2800, curve: 1.3, essential: true });
  return zoom;
}

/** Small push toward the neighborhood when Run is pressed. */
export function runPushIn(map: MlMap, bbox: Bbox, padding: PaddingOptions) {
  const { center, zoom } = fit(map, bbox, padding);
  map.easeTo({ center, zoom: zoom + 0.25, pitch: MISSION_PITCH, bearing: MISSION_BEARING - 4, duration: 1200, essential: true });
}
