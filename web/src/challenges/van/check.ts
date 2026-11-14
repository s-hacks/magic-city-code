// Stray-Dog Van Route: data types and the checker. The checks run in order and stop at the first failure.
import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';
import { km } from '../common/viz';

export type LatLon = [number, number];
export interface VanPlace { node: number; label: string; note: string; reports: number }
export interface VanTest {
  id: string; name: string; visible: boolean;
  places: VanPlace[]; // place 0 is the depot
  dist: number[][];
  best: { order: number[]; meters: number };
  nearestNeighbor: number;
}
export interface VanData {
  nodes: Record<string, LatLon>; // real street corners (graph.json)
  depot: number;
  slack: number; // allowed extra length over the best route, e.g. 0.05
  paths: Record<string, number[]>; // "a-b" (a < b) -> corners along the streets
  tests: VanTest[];
}

export const routeMeters = (route: number[], t: VanTest) => route.slice(1).reduce((m, p, i) => m + (t.dist[route[i]]?.[p] ?? 0), 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function checkVan(t: VanTest, run: TestRun, d: VanData): Verdict {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: 'Your code never finished. Is there a loop that never ends, or a search that tries every possible order?' };
  const res = run.result;
  if (!res || res.type !== 'list' || !Array.isArray(res.value)) {
    return { ok: false, kind: 'type', title: 'Wrong return type', detail: `plan_route must return a list of place numbers like [0, 2, 1, 0], but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  }
  const r = res.value as number[];
  const n = t.places.length - 1;
  if (n === 0 && (r.length === 1 || r.length === 2) && r.every((p) => p === 0)) return { ok: true, kind: 'pass', title: 'Passed', detail: 'No reports today: the van stays at the depot.' };
  if (r[0] !== 0 || r[r.length - 1] !== 0 || r.length < 2) {
    return { ok: false, kind: 'endpoints', title: 'The van must start and end at the depot', detail: `Your route is [${r.slice(0, 8).join(', ')}${r.length > 8 ? ', …' : ''}]. It should begin and end with 0, the depot.` };
  }
  const seen = new Map<number, number>();
  for (const p of r.slice(1, -1)) {
    if (p < 1 || p > n) return { ok: false, kind: 'wrong', title: 'That place doesn\'t exist', detail: `Today there are reports 1 to ${n}, but your route goes to ${p}${p === 0 ? ' (the depot) in the middle of the route' : ''}.` };
    seen.set(p, (seen.get(p) ?? 0) + 1);
  }
  const twice = [...seen].find(([, c]) => c > 1);
  if (twice) return { ok: false, kind: 'wrong', title: 'A report is visited twice', detail: `Report ${twice[0]} appears ${twice[1]} times. Visit each report exactly once.` };
  const missed = Array.from({ length: n }, (_, i) => i + 1).filter((p) => !seen.has(p));
  if (missed.length) return { ok: false, kind: 'missing', title: `The van skipped ${missed.length === 1 ? 'a report' : `${missed.length} reports`}`, detail: `Report${missed.length > 1 ? 's' : ''} ${missed.join(', ')} never got a visit. A dog is still out there.` };

  const m = routeMeters(r, t);
  const best = t.best.meters;
  const over = best ? m / best - 1 : 0;
  if (over > d.slack + 1e-9) {
    return { ok: false, kind: 'longer', title: 'A shorter route exists', detail: `Your route is ${km(m)}, ${pct(over)} longer than the best one (${km(best)}). Get within ${pct(d.slack)}.` };
  }
  return { ok: true, kind: 'pass', title: 'Passed', detail: `${km(m)} for ${n} report${n === 1 ? '' : 's'}${over > 0.0005 ? `, ${(over * 100).toFixed(1)}% longer than the best possible route` : ', as short as possible'}.` };
}
