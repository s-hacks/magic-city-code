// Flood Cut-Off on the map: the student's search spreads out from every shelter at once, and each
// street lights up in the color of its walk time (green near a shelter, then gold, orange, red past
// 20 minutes). Flooded underpasses are dashed orange; corners cut off completely pulse red.
import type * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import type { Feature } from 'geojson';
import type { TestRun } from '../../py/runner';
import type { Verdict, Viz } from '../types';
import { colors, div, fc, fit, line, markerSet, point, type LngLat } from '../common/viz';
import { expected, type FloodData, type FloodTest } from './check';

export function createFloodViz(map: MLMap, d: FloodData): Viz<FloodTest> {
  const C = colors();
  const ll = (n: number): LngLat => { const [lat, lon] = d.graph.nodes[n]; return [lon, lat]; };
  const incident = new Map<number, number[]>();
  const edgeFeats = d.graph.edges.map(([u, v, , g], i) => {
    for (const n of [u, v]) (incident.get(n) ?? incident.set(n, []).get(n)!).push(i);
    return line([ll(u), ...((g ?? []) as LngLat[]), ll(v)], { i });
  });

  map.addSource('f-edges', { type: 'geojson', data: fc(edgeFeats), promoteId: 'i' });
  for (const id of ['f-flood', 'f-front', 'f-cut']) map.addSource(id, { type: 'geojson', data: fc([]) });
  const dval: maplibregl.ExpressionSpecification = ['number', ['feature-state', 'd'], -1];
  const ramp: maplibregl.ExpressionSpecification = ['interpolate', ['linear'], dval, 0, C.green, d.walkLimit * 0.4, C.gold, d.walkLimit * 0.75, C.orange, d.walkLimit, C.red];
  const specs: maplibregl.LayerSpecification[] = [
    { id: 'f-glow', type: 'line', source: 'f-edges', paint: { 'line-color': ramp, 'line-width': 7, 'line-blur': 5, 'line-opacity': ['case', ['>=', dval, 0], 0.35, 0] } },
    { id: 'f-edges', type: 'line', source: 'f-edges', layout: { 'line-cap': 'round' }, paint: { 'line-color': ramp, 'line-width': 2.2, 'line-opacity': ['case', ['>=', dval, 0], 0.95, 0] } },
    { id: 'f-flood', type: 'line', source: 'f-flood', paint: { 'line-color': C.orange, 'line-width': 7, 'line-dasharray': [1, 1] } },
    { id: 'f-front', type: 'circle', source: 'f-front', paint: { 'circle-radius': 5, 'circle-color': C.cyan, 'circle-blur': 0.5, 'circle-opacity': 0.9 } },
    { id: 'f-cut', type: 'circle', source: 'f-cut', paint: { 'circle-radius': 9, 'circle-color': C.red, 'circle-blur': 0.4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
  ];
  specs.forEach((l) => map.addLayer(l));
  const src = (id: string) => map.getSource(id) as GeoJSONSource;
  const pins = markerSet(map);

  const box = div('leak-counter glass');
  const num = div('lc-num', '0'), sub = div('lc-sub', ''), bar = div('lc-bar'), fill = div('lc-fill');
  bar.append(fill);
  box.append(div('lc-label', 'Corners with a walk to a shelter'), num, bar, sub);
  map.getContainer().append(box);
  const total = Object.keys(d.graph.nodes).length;

  let test: FloodTest | null = null, verdict: Verdict | null = null, run: TestRun | null = null;
  let got: Record<string, number> = {}, pops: number[] = [], cur = 0;
  const reached = new Map<number, number>();
  const lit = new Set<number>();

  const light = (n: number) => {
    const m = got[String(n)];
    if (m === undefined || reached.has(n)) return;
    reached.set(n, m);
    for (const e of incident.get(n) ?? []) {
      const [u, v] = d.graph.edges[e];
      const o = u === n ? v : u;
      if (reached.has(o) && !lit.has(e)) { lit.add(e); map.setFeatureState({ source: 'f-edges', id: e }, { d: Math.max(m, reached.get(o)!) }); }
    }
  };
  const reset = () => { map.removeFeatureState({ source: 'f-edges' }); reached.clear(); lit.clear(); cur = 0; };
  const counter = () => {
    const near = [...reached.values()].filter((m) => m <= d.walkLimit).length;
    num.textContent = reached.size.toLocaleString();
    sub.textContent = `of ${total.toLocaleString()} · ${Math.round((near / total) * 100)}% within a 20-minute walk`;
    fill.style.width = `${(reached.size / total) * 100}%`;
  };

  return {
    show(t, r, v) {
      test = t; run = r; verdict = v; reset(); pins.clear(); box.classList.remove('ok', 'bad');
      const val = r?.result?.value;
      got = val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, number>) : {};
      pops = [];
      const ev = r?.events ?? [];
      for (let i = 0; i < ev.length; i += 3) if (ev[i] === 1 && String(ev[i + 1]) in got) pops.push(i);
      src('f-flood').setData(fc(t.closed.map(([a, b]) => line([ll(a), ll(b)]))));
      src('f-front').setData(fc([]));
      src('f-cut').setData(fc([]));
      for (const s of t.shelters) { const el = div('pin goal'); el.append(div('pin-dot'), div('pin-label', s.name)); pins.add(ll(s.node), el, 'bottom'); }
      counter();
      fit(map, Object.values(d.graph.nodes).map(([la, lo]) => [lo, la] as LngLat), 14);
      return pops.length;
    },
    seek(k) {
      if (k < cur) reset();
      const ev = run?.events ?? [];
      while (cur < k) light(ev[pops[cur++] + 1]);
      const front: Feature[] = [];
      for (let i = cur - 1; i >= 0 && front.length < 10; i--) front.push(point(ll(ev[pops[i] + 1])));
      src('f-front').setData(fc(front));
      counter();
      return cur > 0 ? ev[pops[cur - 1] + 2] : 0;
    },
    finish() {
      if (!test || !verdict) return;
      // anything the replay didn't reach (no heap used, or capped events): light it all now
      const order = Object.entries(got).sort((a, b) => a[1] - b[1]).map(([n]) => Number(n));
      for (const n of order) light(n);
      src('f-front').setData(fc([]));
      counter();
      const exp = expected(test, d);
      if (test.shelters.length) {
        const cut = Object.keys(d.graph.nodes).map(Number).filter((n) => !exp.has(n));
        src('f-cut').setData(fc(cut.slice(0, 200).map((n) => point(ll(n)))));
      }
      box.classList.toggle('ok', verdict.ok);
      box.classList.toggle('bad', !verdict.ok);
    },
    ghost(on) {
      if (!test) return;
      reset();
      if (on) {
        const exp = expected(test, d);
        got = Object.fromEntries([...exp].map(([n, m]) => [String(n), m]));
        for (const [n] of [...exp].sort((a, b) => a[1] - b[1])) light(n);
      }
      counter();
    },
    destroy() {
      pins.clear(); box.remove();
      specs.forEach((l) => map.getLayer(l.id) && map.removeLayer(l.id));
      ['f-edges', 'f-flood', 'f-front', 'f-cut'].forEach((id) => map.getSource(id) && map.removeSource(id));
    },
  };
}
