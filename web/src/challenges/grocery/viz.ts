// Grocery Gap on the map: every real Census block group as a 3D block. Red towers are households
// without a car and no grocery store within a mile; their height is how many. In the replay each new
// store drops in, a one-mile ring spreads out, and the towers it reaches turn gold.
// The block shapes are drawn once; the replay only changes each block's state (feature-state).
import type { Map as MLMap } from 'maplibre-gl';
import type * as maplibregl from 'maplibre-gl';
import type { Verdict, Viz } from '../types';
import { colors, css, div, fc, fit, layers, line, markerSet, point, type LngLat } from '../common/viz';
import { meters } from '../leaks/check';
import { reach, unserved, type GroceryData, type GroceryTest, type Place } from './check';

const PER_PICK = 70;

export function createGroceryViz(map: MLMap, d: GroceryData): Viz<GroceryTest> {
  const C = colors();
  // static block shapes, keyed by block group id
  map.addSource('g-areas', {
    type: 'geojson', promoteId: 'id',
    data: fc(d.areas.filter((a) => d.polygons[a.id]).map((a) => ({ type: 'Feature', properties: { id: a.id, h: 30 + a.no_car * 3 }, geometry: { type: 'Polygon', coordinates: d.polygons[a.id] } }))),
  });
  const s: maplibregl.ExpressionSpecification = ['number', ['feature-state', 's'], 0];
  const areaLayer: maplibregl.LayerSpecification = { id: 'g-areas', type: 'fill-extrusion', source: 'g-areas', paint: {
    'fill-extrusion-color': ['match', s, 1, C.green, 2, C.red, 3, C.gold, C.muted],
    'fill-extrusion-height': ['match', s, 2, ['get', 'h'], 3, ['get', 'h'], 1, 18, 4],
    'fill-extrusion-opacity': 0.8,
  } };
  map.addLayer(areaLayer);
  const L = layers(map, ['g-rings', 'g-ghost', 'g-stores', 'g-sites'], [
    { id: 'g-ghost', type: 'line', source: 'g-ghost', paint: { 'line-color': C.text, 'line-width': 2, 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.8 } },
    { id: 'g-rings', type: 'line', source: 'g-rings', paint: { 'line-color': C.gold, 'line-width': 3, 'line-opacity': 0.95 } },
    { id: 'g-stores', type: 'circle', source: 'g-stores', paint: { 'circle-radius': 4, 'circle-color': C.text, 'circle-stroke-color': C.green, 'circle-stroke-width': 2 } },
    { id: 'g-sites', type: 'circle', source: 'g-sites', paint: { 'circle-radius': 3, 'circle-color': css('--violet'), 'circle-opacity': 0.9 } },
  ]);
  const pins = markerSet(map), ghostPins = markerSet(map);
  const at = (p: { lat: number; lon: number }): LngLat => [p.lon, p.lat];
  const ring = (c: Place, r: number): LngLat[] => Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI;
    return [c.lon + (r * Math.cos(a)) / (111_320 * Math.cos((c.lat * Math.PI) / 180)), c.lat + (r * Math.sin(a)) / 110_540];
  });
  const alive = () => !!(map as unknown as { style?: unknown }).style;

  const box = div('leak-counter glass');
  const num = div('lc-num', '0'), sub = div('lc-sub', ''), bar = div('lc-bar'), fill = div('lc-fill');
  bar.append(fill);
  box.append(div('lc-label', 'Families reached'), num, bar, sub);
  map.getContainer().append(box);

  let test: GroceryTest | null = null, verdict: Verdict | null = null, picks: Place[] = [];
  let waiting: GroceryData['areas'] = [];
  const state = new Map<string, number>();
  let pinned = 0;

  const setState = (id: string, v: number) => {
    if (state.get(id) === v) return;
    state.set(id, v);
    map.setFeatureState({ source: 'g-areas', id }, { s: v });
  };

  function draw(k: number) {
    if (!test || !alive()) return;
    const p = Math.min(picks.length, Math.floor(k / PER_PICK));
    const f = p < picks.length ? Math.min(1, (k - p * PER_PICK) / (PER_PICK * 0.7)) : 0;
    let families = 0;
    for (const a of waiting) {
      const on = picks.slice(0, p).some((x) => meters(a, x) <= d.radius) || (f > 0 && meters(a, picks[p]) <= d.radius * f);
      setState(a.id, on ? 3 : 2);
      if (on) families += a.no_car;
    }
    L.set('g-rings', picks.slice(0, p + (f > 0 ? 1 : 0)).map((x, i) => line(ring(x, d.radius * (i < p ? 1 : f)))));
    if (p !== pinned) {
      pins.clear();
      picks.slice(0, p).forEach((x) => { const el = div('site-pin'); el.append(div('name', x.name), div('dot')); pins.add(at(x), el, 'bottom'); });
      pinned = p;
    }
    num.textContent = families.toLocaleString();
    sub.textContent = `households without a car · best possible ${test.best.score.toLocaleString()}`;
    fill.style.width = `${Math.min(100, (families / Math.max(1, test.best.score)) * 100)}%`;
  }

  return {
    show(t, run, v) {
      test = t; verdict = v; ghostPins.clear(); pins.clear(); pinned = 0; L.set('g-ghost', []);
      box.classList.remove('ok', 'bad');
      if (alive()) map.removeFeatureState({ source: 'g-areas' });
      state.clear();
      waiting = unserved(t, d);
      const waitingIds = new Set(waiting.map((a) => a.id));
      for (const id of t.areas) if (!waitingIds.has(id)) setState(id, 1);
      const val = run?.result?.value;
      const ok = Array.isArray(val) && v && ['pass', 'longer'].includes(v.kind);
      picks = ok ? (val as string[]).map((id) => d.sites.find((x) => x.id === id)!).filter(Boolean) : [];
      const sites = new Set(t.sites);
      L.set('g-stores', d.stores.map((x) => point(at(x))));
      L.set('g-sites', d.sites.filter((x) => sites.has(x.id)).map((x) => point(at(x))));
      draw(0);
      fit(map, d.areas.filter((a) => t.areas.includes(a.id)).map(at), 12.5, 55);
      return picks.length ? picks.length * PER_PICK : 0;
    },
    seek(k) { draw(k); return 0; },
    finish() {
      if (!test || !verdict) return;
      draw(picks.length * PER_PICK);
      box.classList.toggle('ok', verdict.ok);
      box.classList.toggle('bad', !verdict.ok);
      if (picks.length) num.textContent = reach(picks.map((x) => x.id), test, d).families.toLocaleString();
    },
    ghost(on) {
      ghostPins.clear();
      if (!test || !on) { L.set('g-ghost', []); return; }
      const best = test.best.picks.map((id) => d.sites.find((x) => x.id === id)!).filter(Boolean);
      L.set('g-ghost', best.map((x) => line(ring(x, d.radius))));
      best.forEach((x) => { const el = div('site-pin ghosted'); el.append(div('name', x.name), div('dot')); ghostPins.add(at(x), el, 'bottom'); });
    },
    destroy() {
      pins.clear(); ghostPins.clear(); box.remove(); L.destroy();
      if (alive()) {
        if (map.getLayer('g-areas')) map.removeLayer('g-areas');
        if (map.getSource('g-areas')) map.removeSource('g-areas');
      }
    },
  };
}
