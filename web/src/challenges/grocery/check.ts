// Grocery Gap: data types, the coverage math and the checker. The math matches the Python
// side: an area is served when its center is within `radius` meters of a store.
import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';
import { meters } from '../leaks/check';

export interface Area { id: string; lat: number; lon: number; households: number; no_car: number; neighborhood: string | null }
export interface Place { id: string; name: string; lat: number; lon: number; kind?: string }
export interface GroceryTest {
  id: string; name: string; visible: boolean;
  k: number; areas: string[]; sites: string[];
  best: { score: number; picks: string[] };
}
export interface GroceryData {
  radius: number; minShare: number;
  areas: Area[]; stores: Place[]; sites: Place[];
  tests: GroceryTest[];
  polygons: Record<string, [number, number][][]>; // block group id -> polygon rings (from areas.json)
}

/** Areas in this test that no store reaches today. */
export function unserved(t: GroceryTest, d: GroceryData) {
  const ids = new Set(t.areas);
  return d.areas.filter((a) => ids.has(a.id) && !d.stores.some((s) => meters(a, s) <= d.radius));
}

/** Which unserved areas the picks reach, and how many households without a car live there. */
export function reach(picks: string[], t: GroceryTest, d: GroceryData) {
  const sites = picks.map((id) => d.sites.find((s) => s.id === id)).filter(Boolean) as Place[];
  const covered = unserved(t, d).filter((a) => sites.some((s) => meters(a, s) <= d.radius));
  return { covered, families: covered.reduce((n, a) => n + a.no_car, 0) };
}

export function checkGrocery(t: GroceryTest, run: TestRun, d: GroceryData): Verdict {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: 'Your code never finished. Trying every combination of sites takes too long for 5 stores; pick one site at a time instead.' };
  const res = run.result;
  if (!res || res.type !== 'list' || !Array.isArray(res.value)) {
    return { ok: false, kind: 'type', title: 'Wrong return type', detail: `pick_sites must return a list of site ids, like ["site_w123", "site_n456"], but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  }
  const picks = res.value as string[];
  if (picks.length !== t.k) return { ok: false, kind: 'wrong', title: `Pick exactly ${t.k} site${t.k === 1 ? '' : 's'}`, detail: `The budget pays for ${t.k} new store${t.k === 1 ? '' : 's'} in this test, but you returned ${picks.length}.` };
  const allowed = new Set(t.sites);
  const bad = picks.find((p) => !allowed.has(p));
  if (bad) return { ok: false, kind: 'wrong', title: 'That site isn\'t on the list', detail: `"${bad}" isn't one of the sites you were given for this test.` };
  const dup = picks.find((p, i) => picks.indexOf(p) !== i);
  if (dup) return { ok: false, kind: 'wrong', title: 'The same site twice', detail: `You picked ${d.sites.find((s) => s.id === dup)?.name ?? dup} twice. Two stores in one building don't reach anyone new.` };

  const { families, covered } = reach(picks, t, d);
  const best = t.best.score;
  const need = Math.ceil(best * d.minShare);
  if (families < need) {
    return { ok: false, kind: 'longer', title: 'More families could be reached', detail: `Your ${t.k} store${t.k === 1 ? '' : 's'} reach ${families.toLocaleString()} households without a car; ${best.toLocaleString()} is possible. Get to ${Math.round(d.minShare * 100)}% (${need.toLocaleString()}). Do your stores reach the same families twice?` };
  }
  return { ok: true, kind: 'pass', title: 'Passed', detail: t.k ? `${families.toLocaleString()} households without a car in ${covered.length} block groups get a grocery store within a mile (${Math.round((families / Math.max(1, best)) * 100)}% of the best possible).` : 'No stores this year, so nothing to pick.' };
}
