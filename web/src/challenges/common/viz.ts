// Small map helpers shared by the newer challenges' visualizers: theme colors, GeoJSON
// builders, DOM markers and camera fitting. Each challenge's viz.ts draws its own layers.
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import type { Feature } from 'geojson';
import './challenges.css';

export type LngLat = [number, number];

export const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export const colors = () => ({ blue: css('--blue'), cyan: css('--cyan'), gold: css('--accent'), orange: css('--orange'), red: css('--red'), text: css('--text'), muted: css('--muted'), green: css('--green') });

export const fc = (features: Feature[]) => ({ type: 'FeatureCollection' as const, features });
export const point = (c: LngLat, properties: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: c } });
export const line = (coordinates: LngLat[], properties: Record<string, unknown> = {}): Feature => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });

export function div(cls: string, text = '') {
  const e = document.createElement('div');
  e.className = cls;
  e.textContent = text;
  return e;
}

/** Markers that can be removed together. */
export function markerSet(map: MLMap) {
  let list: maplibregl.Marker[] = [];
  return {
    add(at: LngLat, el: HTMLElement, anchor: maplibregl.PositionAnchor = 'center') {
      list.push(new maplibregl.Marker({ element: el, anchor }).setLngLat(at).addTo(map));
    },
    clear() { list.forEach((m) => m.remove()); list = []; },
  };
}

export function fit(map: MLMap, points: LngLat[], maxZoom = 15.5) {
  if (!points.length) return;
  const b = new maplibregl.LngLatBounds(points[0], points[0]);
  points.forEach((p) => b.extend(p));
  map.fitBounds(b, { padding: { top: 90, bottom: 110, left: 70, right: 70 }, pitch: 40, bearing: -10, duration: 1100, maxZoom });
}

/** Add GeoJSON sources + layers; returns a setter and a cleanup. */
export function layers(map: MLMap, sources: string[], specs: maplibregl.LayerSpecification[]) {
  for (const id of sources) map.addSource(id, { type: 'geojson', data: fc([]) });
  specs.forEach((l) => map.addLayer(l));
  return {
    set: (id: string, features: Feature[]) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(fc(features)),
    destroy() {
      specs.forEach((l) => map.getLayer(l.id) && map.removeLayer(l.id));
      sources.forEach((id) => map.getSource(id) && map.removeSource(id));
    },
  };
}

export const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
