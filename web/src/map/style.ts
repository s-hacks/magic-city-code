import type { Map as MLMap, StyleSpecification, LayerSpecification, ExpressionSpecification, GeoJSONSourceSpecification } from 'maplibre-gl';
import { themes, type ThemeName } from '../theme';

// Layer groups drive the layer toggles: every layer carries metadata.group.
export type LayerGroup = 'streets' | 'buildings' | 'residents' | 'stores' | 'sites' | 'shelters' | 'hubs';

const empty: GeoJSONSourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
const lit: ExpressionSpecification = ['boolean', ['feature-state', 'lit'], false];
const hover: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];
const zoomed = (lo: number, hi: number): ExpressionSpecification => ['interpolate', ['exponential', 1.6], ['zoom'], 11, lo, 17, hi];

export function makeStyle(name: ThemeName): StyleSpecification {
  const t = themes[name];
  const g = (group: LayerGroup, layer: LayerSpecification): LayerSpecification => ({ ...layer, metadata: { group } });

  return {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'sky-color': t.sky,
      'horizon-color': t.horizon,
      'fog-color': t.land,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.75,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 0.6, 12, 0],
    },
    light: { anchor: 'map', color: '#ffffff', intensity: name === 'night' ? 0.25 : 0.4, position: [1.4, 200, 35] },
    sources: {
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap · OpenFreeMap' },
      residents: { ...empty, promoteId: 'id' },
      stores: empty,
      sites: { ...empty, promoteId: 'id' },
      shelters: empty,
      hubBeams: empty,
      hubPoints: empty,
      rings: empty,
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': t.land } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': t.water } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': t.park } },
      { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': t.park } },

      g('streets', { id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': t.road, 'line-width': zoomed(0.3, 5) } }),
      g('streets', { id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': t.roadMajor, 'line-width': zoomed(0.6, 9) } }),
      g('streets', { id: 'road-motorway', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': t.violet, 'line-opacity': 0.55, 'line-width': zoomed(1, 12) } }),
      g('streets', { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': t.road, 'line-width': 1, 'line-dasharray': [3, 3] } }),

      g('buildings', { id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, t.buildingLow, 60, t.buildingHigh],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        } }),

      // reach rings sit on the ground, under the dots
      g('hubs', { id: 'rings', type: 'line', source: 'rings',
        paint: { 'line-color': t.accent, 'line-width': 1.5, 'line-opacity': ['get', 'o'] } }),

      g('residents', { id: 'residents-halo', type: 'circle', source: 'residents',
        paint: {
          'circle-color': t.accent, 'circle-blur': 1,
          'circle-radius': zoomed(4, 16),
          'circle-opacity': ['case', lit, name === 'night' ? 0.35 : 0.18, 0],
          ...({ 'circle-opacity-transition': { duration: 600 } } as object), // not in MapLibre 4's paint types
        } }),
      g('residents', { id: 'residents', type: 'circle', source: 'residents',
        paint: {
          'circle-color': ['case', lit, t.accent, t.ash],
          'circle-radius': ['interpolate', ['exponential', 1.6], ['zoom'], 11, ['case', lit, 1.4, 1], 17, ['case', lit, 4, 2.6]],
          'circle-opacity': ['case', lit, 1, 0.55],
        } }),

      g('stores', { id: 'stores-halo', type: 'circle', source: 'stores',
        paint: { 'circle-color': t.store, 'circle-radius': 22, 'circle-blur': 1, 'circle-opacity': 0.25 } }),
      g('stores', { id: 'stores', type: 'circle', source: 'stores',
        paint: { 'circle-color': t.store, 'circle-radius': 6, 'circle-stroke-color': t.bg, 'circle-stroke-width': 2 } }),

      g('shelters', { id: 'shelters', type: 'circle', source: 'shelters',
        paint: { 'circle-color': 'transparent', 'circle-radius': 7, 'circle-stroke-color': t.store, 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.8 } }),
      g('shelters', { id: 'shelters-core', type: 'circle', source: 'shelters',
        paint: { 'circle-color': t.store, 'circle-radius': 2.5 } }),

      g('sites', { id: 'sites', type: 'circle', source: 'sites',
        paint: {
          'circle-color': t.bg,
          'circle-radius': ['case', hover, 10, 7],
          'circle-stroke-color': ['case', hover, t.text, t.muted],
          'circle-stroke-width': 2,
        } }),

      g('hubs', { id: 'hub-glow', type: 'circle', source: 'hubPoints',
        paint: { 'circle-color': t.accent, 'circle-radius': 34, 'circle-blur': 1, 'circle-opacity': ['*', 0.6, ['get', 'o']] } }),
      g('hubs', { id: 'hub-beams', type: 'fill-extrusion', source: 'hubBeams',
        paint: { 'fill-extrusion-color': t.accent, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.9 } }),
    ],
  };
}

/** Re-color a live map (theme switch) without rebuilding sources or custom layers. */
export function applyTheme(m: MLMap, name: ThemeName) {
  const s = makeStyle(name);
  for (const l of s.layers) for (const [k, v] of Object.entries((l as { paint?: object }).paint ?? {})) m.setPaintProperty(l.id, k as never, v as never);
  m.setSky(s.sky!);
  m.setLight(s.light!);
}
