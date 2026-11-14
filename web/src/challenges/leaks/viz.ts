// Stop the Leaks on the map: leaks pour (blue, sized by gallons per hour) until a crew reaches
// them. The replay is the crews' day on a clock: trucks drive leak to leak, fixed leaks turn green,
// and a counter adds up the water lost, next to the best plan known.
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap } from 'maplibre-gl';
import type { Verdict, Viz } from '../types';
import { colors, div, fit, layers, line, markerSet, point, type LngLat } from '../common/viz';
import { gal, simulate, type Job, type LeakData, type LeakTest, type Spot } from './check';

const STEPS = 300; // about 5 seconds of replay
const CREW_COLORS = ['--accent', '--cyan', '--violet'];

export function createLeaksViz(map: MLMap, d: LeakData): Viz<LeakTest> {
  const C = colors();
  const crewColor = (i: number) => getComputedStyle(document.documentElement).getPropertyValue(CREW_COLORS[i % CREW_COLORS.length]).trim();
  const L = layers(map, ['k-leaks', 'k-trails', 'k-ghost'], [
    { id: 'k-ghost', type: 'line', source: 'k-ghost', paint: { 'line-color': C.text, 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [1.5, 1.5] } },
    { id: 'k-trails', type: 'line', source: 'k-trails', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 3, 'line-opacity': 0.85 } },
    { id: 'k-pour', type: 'circle', source: 'k-leaks', filter: ['==', ['get', 'fixed'], 0], paint: { 'circle-radius': ['*', ['get', 'r'], 1.9], 'circle-color': C.blue, 'circle-blur': 0.85, 'circle-opacity': 0.55 } },
    { id: 'k-leaks', type: 'circle', source: 'k-leaks', paint: {
      'circle-radius': ['case', ['==', ['get', 'fixed'], 1], 5, ['get', 'r']],
      'circle-color': ['case', ['==', ['get', 'fixed'], 1], C.green, ['==', ['get', 'work'], 1], C.orange, C.cyan],
      'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.95,
    } },
  ]);
  const pins = markerSet(map), tags = markerSet(map);
  const at = (s: Spot): LngLat => [s.lon, s.lat];
  const lerp = (a: Spot, b: Spot, f: number): LngLat => [a.lon + (b.lon - a.lon) * f, a.lat + (b.lat - a.lat) * f];
  const radius = (gph: number) => Math.min(30, 3 + Math.sqrt(gph / 40));

  // the counter, in the map's corner
  const box = div('leak-counter glass');
  const lost = div('lc-num', '0 gal'), clock = div('lc-sub', ''), bar = div('lc-bar');
  const fill = div('lc-fill');
  bar.append(fill);
  box.append(div('lc-label', 'Water lost'), lost, bar, clock);
  map.getContainer().append(box);

  let test: LeakTest | null = null, verdict: Verdict | null = null;
  let jobs: Job[] = [], hours = 0, total = 0, trucks: maplibregl.Marker[] = [];
  let truckEls: HTMLElement[] = [];

  function drawAt(time: number) {
    if (!test) return;
    const fixedAt = new Map(jobs.map((j) => [j.leak.id, j]));
    L.set('k-leaks', test.leaks.map((l) => {
      const j = fixedAt.get(l.id);
      return point(at(l), { r: radius(l.gallons_per_hour), fixed: j && time >= j.done ? 1 : 0, work: j && time >= j.arrive && time < j.done ? 1 : 0 });
    }));
    const trails = [];
    let water = 0;
    for (const l of test.leaks) water += l.gallons_per_hour * Math.min(time, fixedAt.get(l.id)?.done ?? time);
    for (let c = 0; c < test.crews; c++) {
      const mine = jobs.filter((j) => j.crew === c);
      let pos: LngLat = at(d.depot);
      for (const j of mine) {
        if (time <= j.start) break;
        const f = Math.min(1, (time - j.start) / Math.max(1e-9, j.arrive - j.start));
        const end = f < 1 ? lerp(j.from, j.leak, f) : at(j.leak);
        trails.push(line([at(j.from), end], { c: crewColor(c) }));
        pos = end;
      }
      trucks[c]?.setLngLat(pos);
      truckEls[c]?.classList.toggle('busy', mine.some((j) => time >= j.arrive && time < j.done));
    }
    L.set('k-trails', trails);
    lost.textContent = gal(water);
    const h = Math.floor(time), m = Math.round((time - h) * 60);
    clock.textContent = `Hour ${h}:${String(m).padStart(2, '0')} · best plan known: ${gal(test.best.gallons)}`;
    fill.style.width = `${Math.min(100, (water / Math.max(1, total, test.best.gallons)) * 100)}%`;
  }

  return {
    show(t, run, v) {
      test = t; verdict = v;
      pins.clear(); tags.clear(); L.set('k-ghost', []); L.set('k-trails', []);
      trucks.forEach((m) => m.remove()); trucks = []; truckEls = [];
      const depot = div('stop-pin depot', 'Crew yard');
      pins.add(at(d.depot), depot);
      const val = run?.result?.value;
      const plan = Array.isArray(val) && v && !['type', 'wrong', 'crash', 'timeout'].includes(v.kind) ? (val as string[][]) : null;
      const sim = plan ? simulate(plan, t, d) : null;
      jobs = sim?.jobs ?? []; hours = sim?.hours ?? 0; total = sim?.gallons ?? 0;
      for (let c = 0; c < t.crews; c++) {
        const el = div('truck', `Crew ${c + 1}`);
        el.style.setProperty('--crew', crewColor(c));
        truckEls.push(el);
        trucks.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(at(d.depot)).addTo(map));
      }
      box.style.display = t.leaks.length ? '' : 'none';
      drawAt(0);
      fit(map, [at(d.depot), ...t.leaks.map(at)], 14);
      return jobs.length ? STEPS : 0;
    },
    seek(k) { drawAt((k / STEPS) * hours); return 0; },
    finish() {
      if (!test || !verdict) return;
      drawAt(hours);
      if (jobs.length) clock.textContent = `Done at hour ${hours.toFixed(1)} · best plan known: ${gal(test.best.gallons)}`;
      box.classList.toggle('ok', verdict.ok);
      box.classList.toggle('bad', !verdict.ok);
    },
    ghost(on) {
      if (!test || !on) { L.set('k-ghost', []); return; }
      const byId = new Map(test.leaks.map((l) => [l.id, l]));
      L.set('k-ghost', test.best.plan.map((ids) => line([at(d.depot), ...ids.map((id) => at(byId.get(id)!))])));
    },
    destroy() { pins.clear(); tags.clear(); trucks.forEach((m) => m.remove()); box.remove(); L.destroy(); },
  };
}
