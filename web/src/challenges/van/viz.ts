// Stray-Dog Van Route on the map: the depot and numbered reports on real corners. After a run
// the van's route draws itself along the streets, lighting up each report as it is reached.
import type { Map as MLMap } from 'maplibre-gl';
import type { TestRun } from '../../py/runner';
import type { Verdict, Viz } from '../types';
import { colors, div, fit, km, layers, line, markerSet, type LngLat } from '../common/viz';
import { routeMeters, type VanData, type VanTest } from './check';

const STEPS = 180; // replay length: about 3 seconds

export function createVanViz(map: MLMap, d: VanData): Viz<VanTest> {
  const C = colors();
  const ll = (node: number): LngLat => { const [lat, lon] = d.nodes[node]; return [lon, lat]; };
  const L = layers(map, ['v-route', 'v-ghost'], [
    { id: 'v-ghost', type: 'line', source: 'v-ghost', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.text, 'line-width': 3, 'line-opacity': 0.75, 'line-dasharray': [1.5, 1.5] } },
    { id: 'v-route-glow', type: 'line', source: 'v-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.gold, 'line-width': 14, 'line-blur': 9, 'line-opacity': 0.5 } },
    { id: 'v-route', type: 'line', source: 'v-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.gold, 'line-width': 5 } },
  ]);
  const pins = markerSet(map), tags = markerSet(map);

  /** Street corners from place a to place b (by graph node). */
  const leg = (a: number, b: number): LngLat[] => {
    if (a === b) return [ll(a)];
    const p = a < b ? d.paths[`${a}-${b}`] : d.paths[`${b}-${a}`]?.slice().reverse();
    return (p ?? [a, b]).map(ll);
  };

  let test: VanTest | null = null, verdict: Verdict | null = null;
  let route: number[] = [], legs: LngLat[][] = [], total = 0, pinEls: HTMLElement[] = [];

  const routeOf = (run: TestRun | null) => {
    const v = run?.result?.value;
    if (!test || !Array.isArray(v)) return [];
    return (v as number[]).filter((p) => Number.isInteger(p) && p >= 0 && p < test!.places.length);
  };

  function draw(upto: number) { // upto: 0..1 of the route length
    if (!test) return;
    const coords: LngLat[] = [];
    const want = upto * total;
    let done = 0;
    pinEls.forEach((el) => el.classList.remove('visited'));
    for (let i = 0; i < legs.length; i++) {
      const c = legs[i];
      if (done + c.length <= want) {
        coords.push(...c);
        done += c.length;
        pinEls[route[i + 1]]?.classList.add('visited');
      } else {
        coords.push(...c.slice(0, Math.max(1, Math.ceil(want - done))));
        break;
      }
    }
    L.set('v-route', coords.length > 1 ? [line(coords)] : []);
  }

  return {
    show(t, run, v) {
      test = t; verdict = v;
      pins.clear(); tags.clear(); L.set('v-route', []); L.set('v-ghost', []);
      pinEls = t.places.map((p, i) => {
        const el = div(`stop-pin ${i === 0 ? 'depot' : ''}`, i === 0 ? 'Depot' : String(i));
        el.title = i === 0 ? 'Van depot' : `${p.label}: ${p.note}`;
        return el;
      });
      // two reports on one corner: nudge the second so both numbers show
      const used = new Map<number, number>();
      t.places.forEach((p, i) => {
        const k = used.get(p.node) ?? 0;
        used.set(p.node, k + 1);
        const [x, y] = ll(p.node);
        pins.add([x + k * 0.0004, y], pinEls[i]);
      });
      fit(map, t.places.map((p) => ll(p.node)));
      route = routeOf(run);
      legs = route.slice(1).map((p, i) => leg(t.places[route[i]].node, t.places[p].node));
      total = legs.reduce((s, c) => s + c.length, 0);
      return route.length > 1 ? STEPS : 0;
    },

    seek(k) { draw(k / STEPS); return 0; },

    finish() {
      if (!test || !verdict) return;
      draw(1);
      tags.clear();
      if (verdict.kind === 'missing') {
        const seen = new Set(route);
        test.places.forEach((p, i) => { if (i > 0 && !seen.has(i)) pinEls[i]?.classList.add('missed'); });
      }
      if (route.length > 1 && (verdict.ok || verdict.kind === 'longer')) {
        const coords = legs.flat();
        const mid = coords[Math.floor(coords.length / 2)];
        if (mid) tags.add(mid, div(`map-tag ${verdict.ok ? 'gold' : 'warn'}`, `${km(routeMeters(route, test))}${verdict.ok ? '' : ` · best ${km(test.best.meters)}`}`), 'bottom');
      }
    },

    ghost(on) {
      if (!test || !on) { L.set('v-ghost', []); return; }
      const o = test.best.order;
      L.set('v-ghost', [line(o.slice(1).flatMap((p, i) => leg(test!.places[o[i]].node, test!.places[p].node)))]);
    },

    destroy() { pins.clear(); tags.clear(); L.destroy(); },
  };
}
