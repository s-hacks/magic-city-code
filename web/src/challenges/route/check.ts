import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';

export type LatLon = [number, number];
export interface Graph { nodes: Record<string, LatLon>; edges: [number, number, number, [number, number][]?][] }
export interface Place { id: string; name: string; kind: 'school' | 'grocery'; node: number }
export interface Expected { path: number[]; meters: number | null }
export interface RouteTest {
  id: string; name: string; visible: boolean;
  start: number; goal: number; startName: string; goalName: string;
  closed: [number, number][]; // streets closed for this test (e.g. an unreachable store)
  expected: Expected;
}
export interface RouteData {
  graph: Graph;
  places: Place[];
  tests: RouteTest[];
  edgeLen: Map<string, number>; // "u-v" (both directions) -> meters
}

export const key = (a: number, b: number) => `${a}-${b}`;
export const miles = (m: number) => (m / 1609.34).toFixed(2);
export const walkMin = (m: number) => Math.max(1, Math.round(m / 80)); // ~4.8 km/h

export function pathMeters(path: number[], d: RouteData) {
  let m = 0;
  for (let i = 1; i < path.length; i++) m += d.edgeLen.get(key(path[i - 1], path[i])) ?? 0;
  return m;
}

/** Repeatedly expanded nodes (count > 1), worst first. */
export function repeats(events: number[]) {
  const c = new Map<number, number>();
  for (let i = 0; i < events.length; i += 3) if (events[i] === 2) c.set(events[i + 1], (c.get(events[i + 1]) ?? 0) + 1);
  return [...c].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
}

// The 7 checks, in order; stops at the first failure.
export function checkRoute(t: RouteTest, run: TestRun, d: RouteData): Verdict {
  const exp = t.expected;
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) {
    const r = repeats(run.events);
    return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: r.length ? `Some corners were explored again and again (up to ${r[0][1]}×). Do you mark corners as visited?` : 'Your code never finished. Is there a loop that never ends?' };
  }
  const res = run.result;
  if (!res || res.type !== 'list' || !res.value) return { ok: false, kind: 'type', title: 'Wrong return type', detail: `shortest_path must return a list of corner ids, but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  const p = res.value;
  if (!exp.path.length) {
    if (!p.length) return pass(t, 0, 'No route exists, and you returned []. Correct!');
  } else if (!p.length) return { ok: false, kind: 'empty', title: 'Returned an empty route', detail: 'You returned [] but a walking route exists.' };
  if (p[0] !== t.start) return { ok: false, kind: 'endpoints', title: 'Route starts in the wrong place', detail: `It should start at ${t.startName} (corner ${t.start}) but starts at corner ${p[0]}.` };
  if (p[p.length - 1] !== t.goal) return { ok: false, kind: 'endpoints', title: 'Route ends in the wrong place', detail: `It should end at ${t.goalName} (corner ${t.goal}) but ends at corner ${p[p.length - 1]}.` };

  const closed = new Set(t.closed.flatMap(([a, b]) => [key(a, b), key(b, a)]));
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1], p[i]];
    if (closed.has(key(a, b))) return { ok: false, kind: 'closed', title: 'Your route uses a closed street', detail: `The street between corners ${a} and ${b} is closed. Only use streets listed in graph[node].` };
    if (!d.edgeLen.has(key(a, b))) return { ok: false, kind: 'gap', title: 'No street here', detail: `Corners ${a} and ${b} are next to each other in your route, but no street connects them.` };
  }
  if (!exp.path.length) return { ok: false, kind: 'closed', title: 'This store can\'t be reached', detail: 'Every street to the goal is closed, so the answer is [].' };

  const m = pathMeters(p, d);
  if (m > exp.meters! + 0.5) return { ok: false, kind: 'longer', title: 'A shorter route exists', detail: `Your route is ${miles(m)} mi, a ${miles(exp.meters!)} mi route exists.` };
  return pass(t, m);
}

const pass = (t: RouteTest, m: number, detail?: string): Verdict => ({
  ok: true, kind: 'pass', title: 'Passed',
  detail: detail ?? (t.start === t.goal ? 'Already there: a one-corner route.' : `${miles(m)} mi · about ${walkMin(m)} min walk to ${t.goalName}`),
});
