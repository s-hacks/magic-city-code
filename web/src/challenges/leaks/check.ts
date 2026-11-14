// Stop the Leaks: data types, the water-loss simulation and the checker.
// The simulation matches the Python harness exactly: straight-line meters x detour / speed.
import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';

export interface Spot { lat: number; lon: number }
export interface Leak extends Spot { id: string; gallons_per_hour: number; repair_hours: number }
export interface LeakTest {
  id: string; name: string; visible: boolean;
  crews: number; leaks: Leak[];
  best: { gallons: number; plan: string[][] };
}
export interface LeakData {
  depot: Spot & { id: string; name: string };
  speed: number; detour: number; slack: number;
  tests: LeakTest[];
}

export function meters(a: Spot, b: Spot) {
  const r = Math.PI / 180, p1 = a.lat * r, p2 = b.lat * r;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** One crew's day: where it is when, and when each leak is fixed. */
export interface Job { leak: Leak; crew: number; start: number; arrive: number; done: number; from: Spot }

export function simulate(plan: string[][], t: LeakTest, d: LeakData) {
  const byId = new Map(t.leaks.map((l) => [l.id, l]));
  const jobs: Job[] = [];
  let gallons = 0;
  plan.forEach((ids, crew) => {
    let clock = 0, here: Spot = d.depot;
    for (const id of ids) {
      const leak = byId.get(id);
      if (!leak) continue;
      const start = clock;
      const arrive = clock + (meters(here, leak) * d.detour) / d.speed;
      clock = arrive + leak.repair_hours;
      gallons += leak.gallons_per_hour * clock;
      jobs.push({ leak, crew, start, arrive, done: clock, from: here });
      here = leak;
    }
  });
  return { gallons, jobs, hours: Math.max(0, ...jobs.map((j) => j.done)) };
}

export const gal = (g: number) => (g >= 1e6 ? `${(g / 1e6).toFixed(2)}M` : Math.round(g).toLocaleString()) + ' gal';

export function checkLeaks(t: LeakTest, run: TestRun, d: LeakData): Verdict {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: 'Your code never finished. Is there a loop that never ends, or a search that tries every possible order?' };
  const res = run.result;
  if (!res || res.type !== 'list' || !Array.isArray(res.value)) {
    return { ok: false, kind: 'type', title: 'Wrong return type', detail: `plan_crews must return one list of leak ids per crew, like [["L03", "L01"], ["L02"]], but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  }
  const plan = res.value as string[][];
  if (plan.length !== t.crews) return { ok: false, kind: 'wrong', title: `Expected ${t.crews} crew list${t.crews > 1 ? 's' : ''}`, detail: `${t.crews} crew${t.crews > 1 ? 's are' : ' is'} working today, so return ${t.crews} list${t.crews > 1 ? 's' : ''} (an empty list for a crew with nothing to do). You returned ${plan.length}.` };
  const ids = new Set(t.leaks.map((l) => l.id));
  const seen = new Map<string, number>();
  for (const id of plan.flat()) {
    if (!ids.has(id)) return { ok: false, kind: 'wrong', title: 'Unknown leak', detail: `"${id}" isn't one of today's leaks (${[...ids].slice(0, 4).join(', ')}${ids.size > 4 ? ', …' : ''}).` };
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const twice = [...seen].find(([, c]) => c > 1);
  if (twice) return { ok: false, kind: 'wrong', title: 'A leak is fixed twice', detail: `${twice[0]} appears ${twice[1]} times. Each leak needs exactly one crew.` };
  const missed = [...ids].filter((id) => !seen.has(id));
  if (missed.length) return { ok: false, kind: 'missing', title: `${missed.length} leak${missed.length > 1 ? 's were' : ' was'} never fixed`, detail: `${missed.slice(0, 5).join(', ')} ${missed.length > 1 ? 'are' : 'is'} still pouring water. Every leak must be in one crew's list.` };

  const { gallons } = simulate(plan, t, d);
  const best = t.best.gallons;
  const over = best ? gallons / best - 1 : 0;
  if (over > d.slack + 1e-9) {
    return { ok: false, kind: 'longer', title: 'Too much water lost', detail: `Your plan loses ${gal(gallons)} before every leak is fixed. The best plan known loses ${gal(best)} (${Math.round(over * 100)}% less). Get within ${(d.slack * 100).toFixed(1)}%.` };
  }
  return { ok: true, kind: 'pass', title: 'Passed', detail: t.leaks.length ? `${gal(gallons)} lost before every leak was fixed${over > 0.0005 ? `, ${(over * 100).toFixed(1)}% more than the best plan known` : ', as good as the best plan known'}.` : 'No leaks today. Every crew stays at the yard.' };
}
