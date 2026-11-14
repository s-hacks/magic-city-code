// Water Bill Check on the map: one dot per account in its real Census block group. After a run the
// student's flags light up one by one (gold = right, orange = looked fine), then missed ones turn red.
import type { Map as MLMap } from 'maplibre-gl';
import type { Verdict, Viz } from '../types';
import { colors, div, fit, layers, markerSet, point, type LngLat } from '../common/viz';
import type { BillsData, BillsTest } from './check';

const STEPS = 150;
const BIRMINGHAM: LngLat = [-86.8104, 33.5186];

export function createBillsViz(map: MLMap, d: BillsData): Viz<BillsTest> {
  const C = colors();
  const L = layers(map, ['b-dots', 'b-ring'], [
    { id: 'b-glow', type: 'circle', source: 'b-dots', filter: ['>', ['get', 's'], 0], paint: { 'circle-radius': 11, 'circle-blur': 0.9, 'circle-opacity': 0.6, 'circle-color': ['match', ['get', 's'], 1, C.gold, 2, C.orange, C.red] } },
    { id: 'b-dots', type: 'circle', source: 'b-dots', paint: {
      'circle-radius': ['match', ['get', 's'], 0, 2.6, 4.5],
      'circle-color': ['match', ['get', 's'], 0, C.muted, 1, C.gold, 2, C.orange, C.red],
      'circle-opacity': ['match', ['get', 's'], 0, 0.55, 1],
    } },
    { id: 'b-ring', type: 'circle', source: 'b-ring', paint: { 'circle-radius': 7, 'circle-color': 'transparent', 'circle-stroke-color': C.text, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.8 } },
  ]);
  const tags = markerSet(map);
  const pos = (id: string): LngLat => [d.accounts[id].lon, d.accounts[id].lat];

  let test: BillsTest | null = null, verdict: Verdict | null = null, flags: string[] = [];
  const want = () => new Set(test?.expected ?? []);

  function draw(k: number, end: boolean) {
    if (!test?.geo) return;
    const w = want();
    const shown = new Set(flags.slice(0, Math.ceil((k / STEPS) * flags.length)));
    L.set('b-dots', Object.keys(test.bills).filter((a) => d.accounts[a]).map((a) => point(pos(a), {
      s: shown.has(a) ? (w.has(a) ? 1 : 2) : end && w.has(a) ? 3 : 0,
    })));
  }

  return {
    show(t, run, v) {
      test = t; verdict = v; tags.clear(); L.set('b-ring', []);
      const val = run?.result?.value;
      flags = Array.isArray(val) ? (val as string[]).filter((a) => a in t.bills) : [];
      if (!t.geo) {
        L.set('b-dots', []);
        map.flyTo({ center: BIRMINGHAM, zoom: 11.6, pitch: 30, bearing: 0, duration: 900 });
        return 0;
      }
      draw(0, false);
      fit(map, Object.keys(t.bills).filter((a) => d.accounts[a]).map(pos), 14);
      return run && !run.error && !run.timedOut ? STEPS : 0;
    },
    seek(k) { draw(k, false); return 0; },
    finish() {
      if (!test || !verdict) return;
      draw(STEPS, true);
      tags.clear();
      if (!test.geo) return;
      const w = want();
      const right = flags.filter((a) => w.has(a)).length;
      const missed = test.expected.filter((a) => !flags.includes(a)).length;
      const ids = Object.keys(test.bills).filter((a) => d.accounts[a]);
      const c = ids.reduce<LngLat>((s, a) => [s[0] + pos(a)[0] / ids.length, s[1] + pos(a)[1] / ids.length], [0, 0]);
      tags.add(c, div(`map-tag ${verdict.ok ? 'gold' : 'warn'}`, `${right} flagged${missed ? ` · ${missed} missed` : ''}${flags.length - right ? ` · ${flags.length - right} wrong` : ''}`), 'bottom');
    },
    ghost(on) {
      L.set('b-ring', on && test?.geo ? test.expected.filter((a) => d.accounts[a]).map((a) => point(pos(a))) : []);
    },
    destroy() { tags.clear(); L.destroy(); },
  };
}
