import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';
import type { TestRun } from '../../py/runner';
import type { RunOptions, Verdict, Viz } from '../types';
import { closedFor, expectedFor, key, miles, pathMeters, repeats, walkMin, type RouteData, type RouteTest } from './check';

type LngLat = [number, number];
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fc = (features: Feature[]) => ({ type: 'FeatureCollection' as const, features });
const line = (coordinates: LngLat[], properties = {}): Feature<LineString> => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });
const div = (cls: string, text = '') => { const e = document.createElement('div'); e.className = cls; e.textContent = text; return e; };

export function createRouteViz(map: MLMap, d: RouteData): Viz<RouteTest> {
  const C = { blue: css('--blue'), cyan: css('--cyan'), gold: css('--accent'), orange: css('--orange'), red: css('--red'), text: css('--text') };
  const ll = (n: number): LngLat => { const [lat, lon] = d.graph.nodes[n]; return [lon, lat]; };

  // edge index: "u-v" -> [edge id, forward?] and node -> incident edge ids
  const edgeOf = new Map<string, [number, boolean]>();
  const incident = new Map<number, number[]>();
  const edgeCoords = d.graph.edges.map(([u, v, , g], i) => {
    edgeOf.set(key(u, v), [i, true]); edgeOf.set(key(v, u), [i, false]);
    for (const n of [u, v]) (incident.get(n) ?? incident.set(n, []).get(n)!).push(i);
    return [ll(u), ...((g ?? []) as LngLat[]), ll(v)];
  });
  const segment = (a: number, b: number): LngLat[] => {
    const e = edgeOf.get(key(a, b));
    if (!e) return [ll(a), ll(b)];
    const c = edgeCoords[e[0]];
    return e[1] ? c : [...c].reverse();
  };
  const pathCoords = (p: number[]) => p.flatMap((n, i) => (i === 0 ? [ll(n)] : segment(p[i - 1], n).slice(1)));

  // --- layers ---------------------------------------------------------------
  const add = (id: string, data = fc([]), promoteId?: string) => map.addSource(id, { type: 'geojson', data, ...(promoteId ? { promoteId } : {}) });
  add('r-edges', fc(edgeCoords.map((c, i) => line(c, { i }))), 'i');
  add('r-nodes', fc(Object.entries(d.graph.nodes).map(([n, [lat, lon]]) => ({ type: 'Feature', properties: { n: Number(n) }, geometry: { type: 'Point', coordinates: [lon, lat] } }))), 'n');
  for (const id of ['r-pulse', 'r-route', 'r-ghost', 'r-flood', 'r-bad']) add(id);
  const s: maplibregl.ExpressionSpecification = ['number', ['feature-state', 's'], 0];
  const layers: maplibregl.LayerSpecification[] = [
    { id: 'r-flood', type: 'line', source: 'r-flood', paint: { 'line-color': C.orange, 'line-width': 7, 'line-opacity': 0.9, 'line-dasharray': [1, 1] } },
    { id: 'r-edges-glow', type: 'line', source: 'r-edges', paint: { 'line-color': C.blue, 'line-width': 9, 'line-blur': 6, 'line-opacity': ['case', ['>', s, 0], 0.45, 0] } },
    { id: 'r-edges', type: 'line', source: 'r-edges', paint: { 'line-color': C.cyan, 'line-width': 1.6, 'line-opacity': ['case', ['>', s, 0], 0.9, 0] } },
    { id: 'r-nodes', type: 'circle', source: 'r-nodes', paint: {
      'circle-radius': ['match', s, 1, 3, 2, 2.2, 3, 4.5, 0],
      'circle-color': ['match', s, 1, 'transparent', 3, C.orange, C.blue],
      'circle-stroke-color': ['match', s, 3, C.orange, C.blue],
      'circle-stroke-width': ['match', s, 1, 1, 0],
      'circle-stroke-opacity': 0.6,
      'circle-opacity': ['match', s, 0, 0, 1],
    } },
    { id: 'r-pulse', type: 'circle', source: 'r-pulse', paint: { 'circle-color': C.cyan, 'circle-radius': ['get', 'r'], 'circle-blur': 0.6, 'circle-opacity': ['get', 'o'] } },
    { id: 'r-ghost', type: 'line', source: 'r-ghost', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.text, 'line-width': 3, 'line-opacity': 0.75, 'line-dasharray': [1.5, 1.5] } },
    { id: 'r-route-glow', type: 'line', source: 'r-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.gold, 'line-width': 16, 'line-blur': 10, 'line-opacity': 0.55 } },
    { id: 'r-route', type: 'line', source: 'r-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.gold, 'line-width': 6 } },
    { id: 'r-bad', type: 'line', source: 'r-bad', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 6, 'line-dasharray': [1.2, 1] } },
  ];
  layers.forEach((l) => map.addLayer(l));
  const src = (id: string) => map.getSource(id) as GeoJSONSource;
  // after the replay, fade the exploration so the gold route reads clearly
  let dimmed = false;
  const dim = (on: boolean) => {
    if (on === dimmed) return;
    dimmed = on;
    const f = on ? 0.3 : 1;
    map.setPaintProperty('r-edges-glow', 'line-opacity', ['case', ['>', s, 0], 0.45 * f, 0]);
    map.setPaintProperty('r-edges', 'line-opacity', ['case', ['>', s, 0], 0.9 * f, 0]);
    map.setPaintProperty('r-nodes', 'circle-opacity', ['match', s, 0, 0, 3, 1, f]);
  };

  // --- state ------------------------------------------------------------------
  let test: RouteTest | null = null, run: TestRun | null = null, verdict: Verdict | null = null, opts: RunOptions = { flood: false };
  let ev: number[] = [], cur = 0, raf = 0;
  let markers: maplibregl.Marker[] = [], endMarkers: maplibregl.Marker[] = [];
  const nodeS = new Map<number, number>(), count = new Map<number, number>(), litEdges = new Set<number>();
  const mark = (at: LngLat, el: HTMLElement, list = markers, anchor: maplibregl.PositionAnchor = 'center') => list.push(new maplibregl.Marker({ element: el, anchor }).setLngLat(at).addTo(map));
  const clearEnd = () => { endMarkers.forEach((m) => m.remove()); endMarkers = []; cancelAnimationFrame(raf); src('r-route').setData(fc([])); src('r-bad').setData(fc([])); };

  function reset() {
    map.removeFeatureState({ source: 'r-nodes' });
    map.removeFeatureState({ source: 'r-edges' });
    nodeS.clear(); count.clear(); litEdges.clear(); cur = 0;
    src('r-pulse').setData(fc([]));
  }
  function apply(i: number) {
    const kind = ev[i * 3], n = ev[i * 3 + 1];
    if (n < 0 || !d.graph.nodes[n]) return;
    if (kind === 0 && !nodeS.get(n)) { nodeS.set(n, 1); map.setFeatureState({ source: 'r-nodes', id: n }, { s: 1 }); }
    if (kind === 2) {
      const c = (count.get(n) ?? 0) + 1;
      count.set(n, c);
      const st = c > 1 ? 3 : 2;
      if (nodeS.get(n) !== st) { nodeS.set(n, st); map.setFeatureState({ source: 'r-nodes', id: n }, { s: st }); }
      for (const e of incident.get(n) ?? []) if (!litEdges.has(e)) { litEdges.add(e); map.setFeatureState({ source: 'r-edges', id: e }, { s: 1 }); }
    }
  }
  function pulse() {
    const pts: Feature[] = [];
    for (let i = cur - 1, seen = 0; i >= 0 && seen < 8; i--) {
      if (ev[i * 3] !== 2) continue;
      const n = ev[i * 3 + 1];
      if (d.graph.nodes[n]) pts.push({ type: 'Feature', properties: { r: 12 - seen, o: 0.9 - seen * 0.1 }, geometry: { type: 'Point', coordinates: ll(n) } });
      seen++;
    }
    src('r-pulse').setData(fc(pts));
  }

  function fit(points: LngLat[]) {
    const b = new maplibregl.LngLatBounds(points[0], points[0]);
    points.forEach((p) => b.extend(p));
    map.fitBounds(b, { padding: { top: 90, bottom: 110, left: 60, right: 60 }, pitch: 45, bearing: -15, duration: 1200, maxZoom: 16 });
  }

  return {
    show(t, r, v, o) {
      test = t; run = r; verdict = v; opts = o;
      markers.forEach((m) => m.remove()); markers = [];
      clearEnd(); reset(); dim(false);
      ev = r?.events ?? [];
      src('r-ghost').setData(fc([]));
      src('r-flood').setData(fc(closedFor(t, d, o).map(([a, b]) => line(segment(a, b)))));
      const pin = (n: number, cls: string, label: string) => {
        const el = div(`pin ${cls}`); el.append(div('pin-dot'), div('pin-label', label));
        mark(ll(n), el, markers, 'bottom');
      };
      pin(t.start, 'start', t.startName);
      if (t.goal !== t.start) pin(t.goal, 'goal', t.goalName);
      const exp = expectedFor(t, o).path;
      fit(exp.length > 1 ? pathCoords(exp) : [ll(t.start), ll(t.goal)]);
      return ev.length / 3;
    },

    seek(k) {
      if (k < cur) reset();
      while (cur < k) apply(cur++);
      if (cur < ev.length / 3) { clearEnd(); dim(false); }
      pulse();
      return cur > 0 ? ev[(cur - 1) * 3 + 2] : 0;
    },

    finish() {
      if (!test || !run || !verdict) return;
      clearEnd();
      src('r-pulse').setData(fc([]));
      const p = run.result?.value ?? [];
      dim(p.length > 1 && verdict.kind !== 'timeout');
      const bad = (a: number, b: number, c: string, label: string) => {
        src('r-bad').setData(fc([line(segment(a, b), { c })]));
        const [x, y] = [ll(a), ll(b)];
        mark([(x[0] + y[0]) / 2, (x[1] + y[1]) / 2], div(`map-tag ${verdict!.kind === 'closed' ? 'warn flash' : 'bad'}`, label), endMarkers);
      };

      if (verdict.kind === 'crash') {
        const last = ev.length ? ev[ev.length - 2] : test.start;
        mark(ll(d.graph.nodes[last] ? last : test.start), div('crash-pulse'), endMarkers);
      }
      if (verdict.kind === 'timeout' || verdict.kind === 'longer') {
        for (const [n, c] of repeats(ev).slice(0, 12)) mark(ll(n), div('map-tag warn small', `${c}×`), endMarkers, 'bottom');
      }
      if (p.length > 1 && verdict.kind !== 'type') {
        // draw the student's route in gold, growing from the start
        const ok = p.filter((n) => d.graph.nodes[n]);
        const coords = pathCoords(ok);
        const t0 = performance.now();
        const grow = (now: number) => {
          const k = Math.min(1, (now - t0) / 1100);
          src('r-route').setData(fc([line(coords.slice(0, Math.max(2, Math.ceil(coords.length * k))))]));
          if (k < 1) raf = requestAnimationFrame(grow);
        };
        raf = requestAnimationFrame(grow);
        const m = pathMeters(p, d);
        const mid = coords[Math.floor(coords.length / 2)];
        if (verdict.kind === 'pass' || verdict.kind === 'longer') mark(mid, div('map-tag gold', `${miles(m)} mi · ${walkMin(m)} min walk`), endMarkers, 'bottom');
      }
      if (verdict.kind === 'endpoints') {
        const wrong = p[0] !== test.start ? p[0] : p[p.length - 1];
        if (d.graph.nodes[wrong]) mark(ll(wrong), div('x-mark', '✕'), endMarkers);
      }
      if (verdict.kind === 'gap' || verdict.kind === 'closed') {
        const closed = new Set(closedFor(test, d, opts).flatMap(([a, b]) => [key(a, b), key(b, a)]));
        for (let i = 1; i < p.length; i++) {
          const [a, b] = [p[i - 1], p[i]];
          if (closed.has(key(a, b))) { bad(a, b, C.orange, 'Flooded street'); break; }
          if (!edgeOf.has(key(a, b)) && d.graph.nodes[a] && d.graph.nodes[b]) { bad(a, b, C.red, 'No street here'); break; }
        }
      }
    },

    ghost(on) {
      src('r-ghost').setData(fc(on && test ? [line(pathCoords(expectedFor(test, opts).path))] : []));
    },

    destroy() {
      clearEnd(); markers.forEach((m) => m.remove());
      layers.forEach((l) => map.getLayer(l.id) && map.removeLayer(l.id));
      ['r-edges', 'r-nodes', 'r-pulse', 'r-route', 'r-ghost', 'r-flood', 'r-bad'].forEach((id) => map.getSource(id) && map.removeSource(id));
    },
  };
}
