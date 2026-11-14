// Don't Get Trapped 1 on the map: every rail crossing is marked (a train where one is stopped),
// and the student's search spreads out from the fire station street by street. When it's done,
// a reachable home gets the ambulance's route in gold; a trapped one shows the cut-off pocket
// in red behind the trains.
import type * as maplibregl from 'maplibre-gl';
import type { Map as MLMap } from 'maplibre-gl';
import type { Feature } from 'geojson';
import type { TestRun } from '../../py/runner';
import type { Verdict, Viz } from '../types';
import { colors, div, fc, fit, layers, line, markerSet, point, type LngLat } from '../common/viz';
import { pocket, reach, type TrappedData, type TrappedTest } from './check';
import './trapped.css';

export function createTrappedViz(map: MLMap, d: TrappedData): Viz<TrappedTest> {
  const C = colors();
  const ll = (n: number): LngLat => { const [lat, lon] = d.graph.nodes[n]; return [lon, lat]; };
  const incident = new Map<number, number[]>();
  const edgeGeom = d.graph.edges.map(([u, v, , g]) => [ll(u), ...((g ?? []) as LngLat[]), ll(v)]);
  d.graph.edges.forEach(([u, v], i) => { for (const n of [u, v]) (incident.get(n) ?? incident.set(n, []).get(n)!).push(i); });

  map.addSource('tr-edges', { type: 'geojson', data: fc(edgeGeom.map((c, i) => line(c, { i }))), promoteId: 'i' });
  const lit: maplibregl.ExpressionSpecification = ['boolean', ['feature-state', 'lit'], false];
  const base: maplibregl.LayerSpecification[] = [
    { id: 'tr-base', type: 'line', source: 'tr-edges', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.muted, 'line-width': 1.2, 'line-opacity': 0.35 } },
    { id: 'tr-glow', type: 'line', source: 'tr-edges', paint: { 'line-color': C.cyan, 'line-width': 7, 'line-blur': 5, 'line-opacity': ['case', lit, 0.35, 0] } },
    { id: 'tr-lit', type: 'line', source: 'tr-edges', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.cyan, 'line-width': 2.2, 'line-opacity': ['case', lit, 0.95, 0] } },
  ];
  base.forEach((l) => map.addLayer(l));
  const extra = layers(map, ['tr-pocket', 'tr-route', 'tr-front'], [
    { id: 'tr-pocket', type: 'circle', source: 'tr-pocket', paint: { 'circle-radius': 6, 'circle-color': C.red, 'circle-opacity': 0.75, 'circle-blur': 0.3, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } },
    { id: 'tr-route-glow', type: 'line', source: 'tr-route', paint: { 'line-color': C.gold, 'line-width': 12, 'line-blur': 6, 'line-opacity': 0.4 } },
    { id: 'tr-route', type: 'line', source: 'tr-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.gold, 'line-width': 4.5 } },
    { id: 'tr-front', type: 'circle', source: 'tr-front', paint: { 'circle-radius': 5, 'circle-color': C.cyan, 'circle-blur': 0.5, 'circle-opacity': 0.9 } },
  ]);
  const pins = markerSet(map);
  const trains = markerSet(map);

  const box = div('leak-counter glass');
  const num = div('lc-num', '0'), sub = div('lc-sub', ''), bar = div('lc-bar'), fill = div('lc-fill');
  bar.append(fill);
  box.append(div('lc-label', 'Corners the ambulance can reach'), num, bar, sub);
  map.getContainer().append(box);
  const total = Object.keys(d.graph.nodes).length;

  let test: TrappedTest | null = null, run: TestRun | null = null, verdict: Verdict | null = null;
  let steps: number[] = [], cur = 0;
  const seen = new Set<number>();
  const litEdges = new Set<number>();

  const visit = (n: number) => {
    if (seen.has(n)) return;
    seen.add(n);
    for (const e of incident.get(n) ?? []) {
      const [u, v] = d.graph.edges[e];
      if (seen.has(u === n ? v : u) && !litEdges.has(e)) { litEdges.add(e); map.setFeatureState({ source: 'tr-edges', id: e }, { lit: true }); }
    }
  };
  const reset = () => { map.removeFeatureState({ source: 'tr-edges' }); seen.clear(); litEdges.clear(); cur = 0; };
  const counter = () => {
    num.textContent = seen.size.toLocaleString();
    sub.textContent = `of ${total.toLocaleString()} corners looked at`;
    fill.style.width = `${(seen.size / total) * 100}%`;
  };

  const drawCrossings = (t: TrappedTest) => {
    trains.clear();
    const stopped = new Set(t.crossings);
    for (const c of d.crossings) {
      const on = stopped.has(c.id);
      const el = div(on ? 'trap-train' : 'trap-xing', on ? 'TRAIN' : '✕');
      el.title = `${c.street}${on ? ': train stopped' : ': clear'}`;
      trains.add([c.at[1], c.at[0]], el);
    }
  };

  const routeTo = (t: TrappedTest): LngLat[] => {
    const parent = reach(d, t.start, t.blocked);
    if (!parent.has(t.goal) || t.start === t.goal) return [];
    const path: number[] = [t.goal];
    while (path[path.length - 1] !== t.start) path.push(parent.get(path[path.length - 1])!);
    path.reverse();
    // follow each street's real shape
    const out: LngLat[] = [ll(path[0])];
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1], path[i]];
      const e = (incident.get(a) ?? []).find((k) => { const [u, v] = d.graph.edges[k]; return (u === a && v === b) || (u === b && v === a); });
      if (e === undefined) { out.push(ll(b)); continue; }
      const g = edgeGeom[e];
      out.push(...(d.graph.edges[e][0] === a ? g.slice(1) : [...g].reverse().slice(1)));
    }
    return out;
  };

  const ending = (t: TrappedTest) => {
    if (t.answer) extra.set('tr-route', t.start === t.goal ? [] : [line(routeTo(t))]);
    else extra.set('tr-pocket', [...pocket(d, t)].map((n) => point(ll(n))));
  };

  return {
    show(t, r, v) {
      test = t; run = r; verdict = v; reset(); pins.clear(); box.classList.remove('ok', 'bad');
      extra.set('tr-route', []); extra.set('tr-pocket', []); extra.set('tr-front', []);
      drawCrossings(t);
      const st = div('pin start'); st.append(div('pin-dot'), div('pin-label', t.startName));
      pins.add(ll(t.start), st, 'bottom');
      if (t.goal !== t.start) { const g = div('pin goal'); g.append(div('pin-dot'), div('pin-label', t.goalName)); pins.add(ll(t.goal), g, 'bottom'); }
      steps = [];
      const ev = r?.events ?? [];
      for (let i = 0; i < ev.length; i += 3) if (ev[i] === 2) steps.push(i);
      counter();
      const crossAt = d.crossings.filter((c) => t.crossings.includes(c.id)).map((c) => [c.at[1], c.at[0]] as LngLat);
      fit(map, [ll(t.start), ll(t.goal), ...(crossAt.length <= 4 ? crossAt : [])], 15);
      return steps.length;
    },
    seek(k) {
      if (k < cur) reset();
      const ev = run?.events ?? [];
      while (cur < k) visit(ev[steps[cur++] + 1]);
      const front: Feature[] = [];
      for (let i = cur - 1; i >= 0 && front.length < 8; i--) front.push(point(ll(ev[steps[i] + 1])));
      extra.set('tr-front', front);
      counter();
      return cur > 0 ? ev[steps[cur - 1] + 2] : 0;
    },
    finish() {
      if (!test || !verdict) return;
      extra.set('tr-front', []);
      counter();
      if (verdict.ok) ending(test);
      box.classList.toggle('ok', verdict.ok);
      box.classList.toggle('bad', !verdict.ok);
    },
    ghost(on) {
      if (!test) return;
      reset();
      extra.set('tr-route', []); extra.set('tr-pocket', []);
      if (on) {
        for (const n of reach(d, test.start, test.blocked).keys()) visit(n);
        ending(test);
      }
      counter();
    },
    destroy() {
      pins.clear(); trains.clear(); box.remove(); extra.destroy();
      base.forEach((l) => map.getLayer(l.id) && map.removeLayer(l.id));
      if (map.getSource('tr-edges')) map.removeSource('tr-edges');
    },
  };
}
