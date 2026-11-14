// Map replay for the "Don't Get Trapped" levels: rail lines, stopped trains, the search, the route,
// and (level 3) the homes that are cut off before and after the student's underpass.
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';
import type { TestRun } from '../../py/runner';
import type { Verdict, Viz } from '../types';
import { driveMin, key, miles, pathMeters, repeats, type LngLat, type TrainData, type TrainTest, type UnderpassTest } from './check';

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fc = (features: Feature[]) => ({ type: 'FeatureCollection' as const, features });
const line = (coordinates: LngLat[], properties = {}): Feature<LineString> => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });
const point = (coordinates: LngLat, properties = {}): Feature => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates } });
const div = (cls: string, text = '') => { const e = document.createElement('div'); e.className = cls; e.textContent = text; return e; };

export function createTrainViz(map: MLMap, d: TrainData): Viz<TrainTest> {
  const C = { blue: css('--blue'), cyan: css('--cyan'), gold: css('--accent'), orange: css('--orange'), red: css('--red'), text: css('--text'), muted: css('--muted') };
  const ll = (n: number): LngLat => { const [lat, lon] = d.graph.nodes[n]; return [lon, lat]; };

  // edge index: "u-v" -> [edge id, forward?], node -> incident edge ids, node -> neighbors
  const edgeOf = new Map<string, [number, boolean]>();
  const incident = new Map<number, number[]>();
  const adj = new Map<number, number[]>();
  const edgeCoords = d.graph.edges.map(([u, v, , g], i) => {
    edgeOf.set(key(u, v), [i, true]); edgeOf.set(key(v, u), [i, false]);
    for (const n of [u, v]) (incident.get(n) ?? incident.set(n, []).get(n)!).push(i);
    (adj.get(u) ?? adj.set(u, []).get(u)!).push(v);
    (adj.get(v) ?? adj.set(v, []).get(v)!).push(u);
    return [ll(u), ...((g ?? []) as LngLat[]), ll(v)];
  });
  const segment = (a: number, b: number): LngLat[] => {
    const e = edgeOf.get(key(a, b));
    if (!e) return [ll(a), ll(b)];
    const c = edgeCoords[e[0]];
    return e[1] ? c : [...c].reverse();
  };
  const pathCoords = (p: number[]) => p.flatMap((n, i) => (i === 0 ? [ll(n)] : segment(p[i - 1], n).slice(1)));

  /** Homes (corner -> households) that `station` cannot reach when `blocked` crossings are closed. */
  const homes = Object.entries(d.homes).map(([n, h]) => [Number(n), h] as const);
  function cutOff(station: number, blocked: Set<number>) {
    const seen = new Set([station]);
    const todo = [station];
    while (todo.length) for (const nb of adj.get(todo.pop()!) ?? []) if (!seen.has(nb) && !blocked.has(nb)) { seen.add(nb); todo.push(nb); }
    return homes.filter(([n]) => !seen.has(n)).map(([n]) => n);
  }
  /** Every home cut off on at least one morning, optionally with an underpass at `pick`. */
  function cutOffAnyMorning(t: UnderpassTest, pick = -1) {
    const out = new Set<number>();
    for (const m of t.scenarios) cutOff(t.station, new Set(m.blocked.filter((c) => c !== pick))).forEach((n) => out.add(n));
    return out;
  }

  // --- layers ---------------------------------------------------------------
  const add = (id: string, data = fc([]), promoteId?: string) => map.addSource(id, { type: 'geojson', data, ...(promoteId ? { promoteId } : {}) });
  add('t-rail', fc(d.rail.map((seg) => line(seg))));
  add('t-edges', fc(edgeCoords.map((c, i) => line(c, { i }))), 'i');
  add('t-nodes', fc(Object.keys(d.graph.nodes).map((n) => point(ll(Number(n)), { n: Number(n) }))), 'n');
  const dynamic = ['t-train', 't-homes', 't-cands', 't-pulse', 't-route', 't-ghost', 't-bad'];
  dynamic.forEach((id) => add(id));
  const s: maplibregl.ExpressionSpecification = ['number', ['feature-state', 's'], 0];
  const layers: maplibregl.LayerSpecification[] = [
    { id: 't-rail', type: 'line', source: 't-rail', paint: { 'line-color': C.muted, 'line-width': 1.2, 'line-opacity': 0.55, 'line-dasharray': [3, 2] } },
    { id: 't-edges-glow', type: 'line', source: 't-edges', paint: { 'line-color': C.blue, 'line-width': 9, 'line-blur': 6, 'line-opacity': ['case', ['>', s, 0], 0.45, 0] } },
    { id: 't-edges', type: 'line', source: 't-edges', paint: { 'line-color': C.cyan, 'line-width': 1.6, 'line-opacity': ['case', ['>', s, 0], 0.9, 0] } },
    { id: 't-nodes', type: 'circle', source: 't-nodes', paint: {
      'circle-radius': ['match', s, 1, 3, 2, 2.2, 3, 4.5, 0],
      'circle-color': ['match', s, 1, 'transparent', 3, C.orange, C.blue],
      'circle-stroke-color': ['match', s, 3, C.orange, C.blue],
      'circle-stroke-width': ['match', s, 1, 1, 0],
      'circle-stroke-opacity': 0.6,
      'circle-opacity': ['match', s, 0, 0, 1],
    } },
    { id: 't-homes', type: 'circle', source: 't-homes', paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'h'], 1, 4, 30, 10],
      'circle-color': ['match', ['get', 's'], 'freed', C.gold, C.red],
      'circle-opacity': 0.85, 'circle-blur': 0.25,
    } },
    { id: 't-train-glow', type: 'line', source: 't-train', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.orange, 'line-width': 14, 'line-blur': 8, 'line-opacity': 0.4 } },
    { id: 't-train', type: 'line', source: 't-train', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.orange, 'line-width': 5 } },
    { id: 't-cands', type: 'circle', source: 't-cands', paint: { 'circle-radius': 7, 'circle-color': 'transparent', 'circle-stroke-color': C.text, 'circle-stroke-width': 2 } },
    { id: 't-pulse', type: 'circle', source: 't-pulse', paint: { 'circle-color': C.cyan, 'circle-radius': ['get', 'r'], 'circle-blur': 0.6, 'circle-opacity': ['get', 'o'] } },
    { id: 't-ghost', type: 'line', source: 't-ghost', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.text, 'line-width': 3, 'line-opacity': 0.75, 'line-dasharray': [1.5, 1.5] } },
    { id: 't-route-glow', type: 'line', source: 't-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.gold, 'line-width': 16, 'line-blur': 10, 'line-opacity': 0.55 } },
    { id: 't-route', type: 'line', source: 't-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.gold, 'line-width': 6 } },
    { id: 't-bad', type: 'line', source: 't-bad', layout: { 'line-cap': 'round' }, paint: { 'line-color': C.red, 'line-width': 6, 'line-dasharray': [1.2, 1] } },
  ];
  layers.forEach((l) => map.addLayer(l));
  const src = (id: string) => map.getSource(id) as GeoJSONSource;
  // after the replay, fade the exploration so the gold route reads clearly
  let dimmed = false;
  const dim = (on: boolean) => {
    if (on === dimmed) return;
    dimmed = on;
    const f = on ? 0.3 : 1;
    map.setPaintProperty('t-edges-glow', 'line-opacity', ['case', ['>', s, 0], 0.45 * f, 0]);
    map.setPaintProperty('t-edges', 'line-opacity', ['case', ['>', s, 0], 0.9 * f, 0]);
    map.setPaintProperty('t-nodes', 'circle-opacity', ['match', s, 0, 0, 3, 1, f]);
  };

  // --- state ------------------------------------------------------------------
  let test: TrainTest | null = null, run: TestRun | null = null, verdict: Verdict | null = null;
  let ev: number[] = [], cur = 0, raf = 0;
  let markers: maplibregl.Marker[] = [], endMarkers: maplibregl.Marker[] = [], ghostMarkers: maplibregl.Marker[] = [];
  const nodeS = new Map<number, number>(), count = new Map<number, number>(), litEdges = new Set<number>();
  const mark = (at: LngLat, el: HTMLElement, list = markers, anchor: maplibregl.PositionAnchor = 'center') => list.push(new maplibregl.Marker({ element: el, anchor }).setLngLat(at).addTo(map));
  const clearEnd = () => { endMarkers.forEach((m) => m.remove()); endMarkers = []; cancelAnimationFrame(raf); src('t-route').setData(fc([])); src('t-bad').setData(fc([])); };
  const clearGhost = () => { ghostMarkers.forEach((m) => m.remove()); ghostMarkers = []; src('t-ghost').setData(fc([])); };
  const homeDots = (t: UnderpassTest, pick = -1) => {
    const before = cutOffAnyMorning(t), after = pick < 0 ? before : cutOffAnyMorning(t, pick);
    src('t-homes').setData(fc([...before].map((n) => point(ll(n), { h: d.homes[n], s: after.has(n) ? 'trapped' : 'freed' }))));
  };

  function reset() {
    map.removeFeatureState({ source: 't-nodes' });
    map.removeFeatureState({ source: 't-edges' });
    nodeS.clear(); count.clear(); litEdges.clear(); cur = 0;
    src('t-pulse').setData(fc([]));
  }
  function apply(i: number) {
    const kind = ev[i * 3], n = ev[i * 3 + 1];
    if (n < 0 || !d.graph.nodes[n]) return;
    if (kind === 0 && !nodeS.get(n)) { nodeS.set(n, 1); map.setFeatureState({ source: 't-nodes', id: n }, { s: 1 }); }
    if (kind === 2) {
      const c = (count.get(n) ?? 0) + 1;
      count.set(n, c);
      const st = c > 1 ? 3 : 2;
      if (nodeS.get(n) !== st) { nodeS.set(n, st); map.setFeatureState({ source: 't-nodes', id: n }, { s: st }); }
      for (const e of incident.get(n) ?? []) if (!litEdges.has(e)) { litEdges.add(e); map.setFeatureState({ source: 't-edges', id: e }, { s: 1 }); }
    }
  }
  function pulse() {
    const pts: Feature[] = [];
    for (let i = cur - 1, seen = 0; i >= 0 && seen < 8; i--) {
      if (ev[i * 3] !== 2) continue;
      const n = ev[i * 3 + 1];
      if (d.graph.nodes[n]) pts.push(point(ll(n), { r: 12 - seen, o: 0.9 - seen * 0.1 }));
      seen++;
    }
    src('t-pulse').setData(fc(pts));
  }
  function fit(points: LngLat[]) {
    const b = new maplibregl.LngLatBounds(points[0], points[0]);
    points.forEach((p) => b.extend(p));
    map.fitBounds(b, { padding: { top: 90, bottom: 110, left: 70, right: 70 }, pitch: 40, bearing: -15, duration: 1200, maxZoom: 15.5 });
  }
  const pin = (n: number, cls: string, label: string) => {
    const el = div(`pin ${cls}`); el.append(div('pin-dot'), div('pin-label', label));
    mark(ll(n), el, markers, 'bottom');
  };

  return {
    show(t, r, v) {
      test = t; run = r; verdict = v;
      markers.forEach((m) => m.remove()); markers = [];
      clearEnd(); clearGhost(); reset(); dim(false);
      ev = r?.events ?? [];
      const trains = t.level === 'underpass' ? t.scenarios.flatMap((m) => m.trains) : t.trains;
      src('t-train').setData(fc(trains.flatMap((tr) => tr.track.map((seg) => line(seg)))));
      if (t.level === 'underpass') {
        src('t-cands').setData(fc(t.candidates.map((c) => point(ll(c), { c }))));
        homeDots(t);
        pin(t.station, 'start', t.stationName);
        if (cutOffAnyMorning(t).has(d.harris)) pin(d.harris, 'goal', 'Harris Homes');
        fit([ll(t.station), ...t.candidates.map(ll)]);
      } else {
        src('t-cands').setData(fc([])); src('t-homes').setData(fc([]));
        pin(t.start, 'start', t.startName);
        pin(t.goal, 'goal', t.goalName);
        for (const tr of t.trains) mark(ll(tr.at), div('map-tag warn small', `Train · ${d.xname.get(tr.at) ?? ''}`), markers, 'right');
        const around = t.level === 'route' && t.expected.path.length > 1 ? pathCoords(t.expected.path) : [];
        fit([ll(t.start), ll(t.goal), ...around, ...t.trains.map((tr) => ll(tr.at))]);
      }
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
      src('t-pulse').setData(fc([]));
      const value = run.result?.value ?? [];
      const usable = !['crash', 'timeout', 'type'].includes(verdict.kind);

      if (verdict.kind === 'crash' && test.level !== 'underpass') {
        const last = ev.length ? ev[ev.length - 2] : test.start;
        mark(ll(d.graph.nodes[last] ? last : test.start), div('crash-pulse'), endMarkers);
      }
      if (verdict.kind === 'timeout') for (const [n, c] of repeats(ev).slice(0, 12)) mark(ll(n), div('map-tag warn small', `${c}×`), endMarkers, 'bottom');
      if (!usable) return;

      if (test.level === 'reach') {
        const said = value[0] === 1;
        const label = verdict.ok ? (said ? 'Help can get in' : 'Cut off') : said ? 'Not true: every way in is blocked' : 'Not true: there is a way in';
        mark(ll(test.goal), div(`map-tag ${verdict.ok ? (said ? 'gold' : 'warn') : 'bad'}`, label), endMarkers, 'top');
        return;
      }

      if (test.level === 'underpass') {
        const pick = value[0];
        if (!test.candidates.includes(pick)) { if (d.graph.nodes[pick]) mark(ll(pick), div('x-mark', '✕'), endMarkers); return; }
        homeDots(test, pick);
        const freed = test.baseline - test.scores[pick];
        mark(ll(pick), div(`map-tag ${verdict.ok ? 'gold' : 'warn'}`, `Underpass on ${d.xname.get(pick)}: ${freed.toLocaleString()} fewer cut off`), endMarkers, 'bottom');
        return;
      }

      // level 2: draw the student's route in gold, growing from the start
      const p = value;
      dim(p.length > 1);
      if (p.length > 1) {
        const coords = pathCoords(p.filter((n) => d.graph.nodes[n]));
        const t0 = performance.now();
        const grow = (now: number) => {
          const k = Math.min(1, (now - t0) / 1100);
          src('t-route').setData(fc([line(coords.slice(0, Math.max(2, Math.ceil(coords.length * k))))]));
          if (k < 1) raf = requestAnimationFrame(grow);
        };
        raf = requestAnimationFrame(grow);
        const m = pathMeters(p, d);
        if (verdict.kind === 'pass' || verdict.kind === 'longer') mark(coords[Math.floor(coords.length / 2)], div('map-tag gold', `${miles(m)} mi · ${driveMin(m)} min drive`), endMarkers, 'bottom');
      } else if (verdict.ok) {
        mark(ll(test.goal), div('map-tag warn', 'Cut off: no way in'), endMarkers, 'top');
      }
      if (verdict.kind === 'endpoints') {
        const wrong = p[0] !== test.start ? p[0] : p[p.length - 1];
        if (d.graph.nodes[wrong]) mark(ll(wrong), div('x-mark', '✕'), endMarkers);
      }
      if (verdict.kind === 'gap' || verdict.kind === 'closed') {
        const blocked = new Set(test.blocked);
        for (let i = 1; i < p.length; i++) {
          const [a, b] = [p[i - 1], p[i]];
          if (blocked.has(b)) { mark(ll(b), div('map-tag bad flash', 'A train is stopped here'), endMarkers, 'bottom'); break; }
          if (!edgeOf.has(key(a, b)) && d.graph.nodes[a] && d.graph.nodes[b]) {
            src('t-bad').setData(fc([line([ll(a), ll(b)])]));
            mark([(ll(a)[0] + ll(b)[0]) / 2, (ll(a)[1] + ll(b)[1]) / 2], div('map-tag bad', 'No street here'), endMarkers);
            break;
          }
        }
      }
    },

    ghost(on) {
      clearGhost();
      if (!on || !test) return;
      if (test.level === 'route') src('t-ghost').setData(fc(test.expected.path.length > 1 ? [line(pathCoords(test.expected.path))] : []));
      if (test.level === 'underpass') {
        for (const c of test.candidates) if (test.scores[c] === test.best) mark(ll(c), div('map-tag gold small', `Best: ${d.xname.get(c)}`), ghostMarkers, 'top');
      }
    },

    destroy() {
      clearEnd(); clearGhost(); markers.forEach((m) => m.remove());
      layers.forEach((l) => map.getLayer(l.id) && map.removeLayer(l.id));
      ['t-rail', 't-edges', 't-nodes', ...dynamic].forEach((id) => map.getSource(id) && map.removeSource(id));
    },
  };
}
