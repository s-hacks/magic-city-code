// Open Bed on the map: shelters with their open beds, and one dot per person. After a run the
// student's answer plays out in priority order: a gold line to the shelter, or red for the waitlist.
import type { Map as MLMap } from 'maplibre-gl';
import type { Verdict, Viz } from '../types';
import { colors, div, fit, layers, line, markerSet, point, type LngLat } from '../common/viz';
import { serveOrder, type BedsData, type BedsTest, type Person } from './check';

const PER_PERSON = 6; // replay frames per person
const BIRMINGHAM: LngLat = [-86.8064, 33.5160];

export function createBedsViz(map: MLMap, _d: BedsData): Viz<BedsTest> {
  const C = colors();
  const L = layers(map, ['o-lines', 'o-ghost', 'o-people'], [
    { id: 'o-ghost', type: 'line', source: 'o-ghost', paint: { 'line-color': C.text, 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [1.5, 1.5] } },
    { id: 'o-lines', type: 'line', source: 'o-lines', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['match', ['get', 's'], 2, C.orange, C.gold], 'line-width': 2.5, 'line-opacity': 0.85 } },
    { id: 'o-glow', type: 'circle', source: 'o-people', filter: ['>', ['get', 's'], 0], paint: { 'circle-radius': 10, 'circle-blur': 0.9, 'circle-opacity': 0.55, 'circle-color': ['match', ['get', 's'], 1, C.gold, 2, C.orange, C.red] } },
    { id: 'o-people', type: 'circle', source: 'o-people', paint: {
      'circle-radius': ['case', ['==', ['get', 'family'], 1], 6, 4.5],
      'circle-color': ['match', ['get', 's'], 0, C.muted, 1, C.gold, 2, C.orange, C.red],
      'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['==', ['get', 'pet'], 1], 1.5, 0],
    } },
  ]);
  const pins = markerSet(map), tags = markerSet(map);
  const at = (x: { lat: number; lon: number }): LngLat => [x.lon, x.lat];

  let test: BedsTest | null = null, verdict: Verdict | null = null, answer: Record<string, string | null> = {}, order: Person[] = [];
  let bedEls = new Map<string, HTMLElement>();

  const bedText = (beds: Record<string, number>, pets: boolean) =>
    `${beds.men} men · ${beds.women} women · ${beds.family} family${pets ? ' · pets ok' : ''}`;

  function draw(k: number) {
    if (!test) return;
    const served = Math.min(order.length, Math.floor(k / PER_PERSON));
    const left = Object.fromEntries(test.shelters.map((s) => [s.id, { ...s.beds }]));
    const state = new Map<string, number>();
    const lines = [];
    for (const p of order.slice(0, served)) {
      const gave = answer[p.id];
      const right = gave === test.expected[p.id];
      state.set(p.id, gave ? (right ? 1 : 2) : right ? 3 : 2);
      const s = test.shelters.find((x) => x.id === gave);
      if (s) {
        lines.push(line([at(p), at(s)], { s: right ? 1 : 2 }));
        if (left[s.id][p.needs] > 0) left[s.id][p.needs] -= 1;
      }
    }
    L.set('o-lines', lines);
    L.set('o-people', test.people.map((p) => point(at(p), { s: state.get(p.id) ?? 0, family: p.needs === 'family' ? 1 : 0, pet: p.pet ? 1 : 0 })));
    for (const s of test.shelters) {
      const el = bedEls.get(s.id);
      if (el) el.textContent = bedText(left[s.id], s.pets);
    }
  }

  return {
    show(t, run, v) {
      test = t; verdict = v; pins.clear(); tags.clear(); L.set('o-ghost', []);
      const val = run?.result?.value;
      answer = val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, string | null>) : {};
      order = serveOrder(t.people).filter((p) => p.id in answer);
      bedEls = new Map();
      for (const s of t.shelters) {
        const el = div('shelter-pin');
        const beds = div('beds', bedText(s.beds, s.pets));
        bedEls.set(s.id, beds);
        el.append(div('name', s.name), beds, div('roof'));
        pins.add(at(s), el, 'bottom');
      }
      draw(0);
      const pts = [...t.shelters.map(at), ...t.people.map(at)];
      if (pts.length) fit(map, pts, 15);
      else map.flyTo({ center: BIRMINGHAM, zoom: 13.5, duration: 900 });
      return order.length ? order.length * PER_PERSON : 0;
    },
    seek(k) { draw(k); return 0; },
    finish() {
      if (!test || !verdict) return;
      draw(order.length * PER_PERSON);
      tags.clear();
      if (!verdict.ok && verdict.kind === 'wrong') {
        const p = serveOrder(test.people).find((x) => x.id in answer && answer[x.id] !== test!.expected[x.id]);
        if (p) tags.add(at(p), div('x-mark', '✕'));
      }
    },
    ghost(on) {
      if (!test || !on) { L.set('o-ghost', []); return; }
      L.set('o-ghost', test.people.flatMap((p) => {
        const s = test!.shelters.find((x) => x.id === test!.expected[p.id]);
        return s ? [line([at(p), at(s)])] : [];
      }));
    },
    destroy() { pins.clear(); tags.clear(); L.destroy(); },
  };
}
