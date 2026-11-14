// Flood Cut-Off: data types, the answer key (multi-source Dijkstra in TypeScript, so no huge
// answer file ships) and the checker. The checks run in order and stop at the first failure.
import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';

export type LatLon = [number, number];
export interface FloodTest {
  id: string; name: string; visible: boolean;
  shelters: { node: number; name: string }[];
  closed: [number, number][];
}
export interface FloodData {
  graph: { nodes: Record<string, LatLon>; edges: [number, number, number, [number, number][]?][] };
  walkLimit: number; // meters: about a 20-minute walk
  tests: FloodTest[];
}

const key = (a: number, b: number) => `${a}-${b}`;
const answers = new Map<string, Map<number, number>>();

/** Meters from every reachable corner to the closest shelter. Cached per test. */
export function expected(t: FloodTest, d: FloodData): Map<number, number> {
  const cached = answers.get(t.id);
  if (cached) return cached;
  const closed = new Set(t.closed.flatMap(([a, b]) => [key(a, b), key(b, a)]));
  const adj = new Map<number, [number, number][]>();
  for (const [u, v, w] of d.graph.edges) {
    if (closed.has(key(u, v))) continue;
    (adj.get(u) ?? adj.set(u, []).get(u)!).push([v, w]);
    (adj.get(v) ?? adj.set(v, []).get(v)!).push([u, w]);
  }
  const dist = new Map<number, number>();
  const heap: [number, number][] = t.shelters.map((s) => [0, s.node]);
  const up = (i: number) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) return;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  };
  while (heap.length) {
    const [dd, u] = heap[0];
    const last = heap.pop()!;
    if (heap.length) { heap[0] = last; down(0); }
    if (dist.has(u)) continue;
    dist.set(u, dd);
    for (const [v, w] of adj.get(u) ?? []) if (!dist.has(v)) { heap.push([dd + w, v]); up(heap.length - 1); }
  }
  answers.set(t.id, dist);
  return dist;
}

const min = (m: number) => `${Math.max(1, Math.round(m / 80))} min`; // ~4.8 km/h

export function checkFlood(t: FloodTest, run: TestRun, d: FloodData): Verdict {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: 'Your code never finished. Do you skip corners you already have a time for? Running a separate search from every shelter can also be too slow.' };
  const res = run.result;
  if (!res || res.type !== 'dict' || !res.value || typeof res.value !== 'object') {
    return { ok: false, kind: 'type', title: 'Wrong return type', detail: `walk_times must return a dict {corner: meters}, like {512: 0, 513: 84.2}, but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  }
  const got = res.value as Record<string, number>;
  const exp = expected(t, d);
  const total = Object.keys(d.graph.nodes).length;

  const missing = [...exp.keys()].filter((n) => !(String(n) in got));
  if (missing.length) {
    const n = missing.sort((a, b) => exp.get(a)! - exp.get(b)!)[0];
    return { ok: false, kind: 'missing', title: `${missing.length.toLocaleString()} reachable corner${missing.length > 1 ? 's are' : ' is'} missing`, detail: `Corner ${n} is ${Math.round(exp.get(n)!).toLocaleString()} m (${min(exp.get(n)!)}) from a shelter, but it isn't in your answer. Every corner that can reach a shelter needs a time.` };
  }
  const extra = Object.keys(got).map(Number).filter((n) => !exp.has(n));
  if (extra.length) return { ok: false, kind: 'closed', title: 'A cut-off corner got a time', detail: `Corner ${extra[0]} can't reach any shelter (flooded streets block every way out), but your answer gives it ${Math.round(got[String(extra[0])])} m. Leave cut-off corners out.` };

  let worst: [number, number, number] | null = null;
  for (const [n, m] of exp) {
    const g = got[String(n)];
    if (Math.abs(g - m) > 1 && (!worst || Math.abs(g - m) > Math.abs(worst[1] - worst[2]))) worst = [n, g, m];
  }
  if (worst) {
    const [n, g, m] = worst;
    return g > m
      ? { ok: false, kind: 'longer', title: 'Some walks are longer than they need to be', detail: `You say corner ${n} is ${Math.round(g).toLocaleString()} m from a shelter, but there's a ${Math.round(m).toLocaleString()} m walk. Is every shelter a starting point, and do you always pop the closest corner first?` }
      : { ok: false, kind: 'gap', title: 'A walk is shorter than any real route', detail: `You say corner ${n} is ${Math.round(g).toLocaleString()} m from a shelter, but the shortest real walk is ${Math.round(m).toLocaleString()} m. Only use streets listed in graph[corner].` };
  }
  if (!exp.size) return { ok: true, kind: 'pass', title: 'Passed', detail: 'No shelters are open, so no corner can reach one: {} is right.' };
  const near = [...exp.values()].filter((m) => m <= d.walkLimit).length;
  const cut = total - exp.size;
  return { ok: true, kind: 'pass', title: 'Passed', detail: `${Math.round((near / total) * 100)}% of ${total.toLocaleString()} corners are within a 20-minute walk of a shelter${cut ? `; ${cut} corner${cut > 1 ? 's are' : ' is'} cut off completely` : ''}.` };
}
