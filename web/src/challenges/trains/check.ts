// Data shapes and the checkers for the three "Don't Get Trapped" levels.
import type { TestRun } from '../../py/runner';
import type { BaseTest, Verdict } from '../types';

export type LatLon = [number, number];
export type LngLat = [number, number];
export interface Train { at: number; name: string; blocked: number[]; track: [LngLat, LngLat][] }
export interface Morning { trains: Train[]; blocked: number[] }
export interface Expected { path: number[]; meters: number | null }

interface TripTest extends BaseTest { start: number; goal: number; startName: string; goalName: string; blocked: number[]; trains: Train[] }
export interface ReachTest extends TripTest { level: 'reach'; expected: boolean }
export interface RouteTest extends TripTest { level: 'route'; expected: Expected; clearMeters: number | null }
export interface UnderpassTest extends BaseTest {
  level: 'underpass'; station: number; stationName: string;
  scenarios: Morning[]; candidates: number[]; baseline: number; best: number;
  scores: Record<string, number>; // crossing -> households still trapped with an underpass there
}
export type TrainTest = ReachTest | RouteTest | UnderpassTest;
export type Level = TrainTest['level'];

export interface TrainData {
  graph: { nodes: Record<string, LatLon>; edges: [number, number, number, LngLat[]?][] };
  crossings: { node: number; name: string }[];
  homes: Record<string, number>;
  harris: number;
  rail: [LngLat, LngLat][];
  reach: ReachTest[]; route: RouteTest[]; underpass: UnderpassTest[];
  edgeLen: Map<string, number>; // "u-v" (both directions) -> meters
  xname: Map<number, string>; // crossing corner -> street name
}

export const key = (a: number, b: number) => `${a}-${b}`;
export const miles = (m: number) => (m / 1609.34).toFixed(2);
export const driveMin = (m: number) => Math.max(1, Math.round(m / 804)); // about 30 mph
const hh = (n: number) => `${n.toLocaleString()} household${n === 1 ? '' : 's'}`;

export function pathMeters(path: number[], d: TrainData) {
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

const fnName: Record<Level, string> = { reach: 'can_reach', route: 'rescue_route', underpass: 'best_underpass' };

/** Crash, timeout and wrong return type are the same for every level. Returns null when the result is usable. */
function common(t: TrainTest, run: TestRun, want: 'bool' | 'list' | 'int', wantWords: string): Verdict | null {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) {
    const r = repeats(run.events);
    return { ok: false, kind: 'timeout', title: `Time limit exceeded (${t.level === 'underpass' ? 5 : 3} s)`, detail: r.length ? `Some corners were explored again and again (up to ${r[0][1]}×). Do you remember the corners you have already seen?` : 'Your code never finished. Is there a loop that never ends?' };
  }
  const res = run.result;
  if (!res || res.type !== want || !res.value) return { ok: false, kind: 'type', title: 'Wrong return type', detail: `${fnName[t.level]} must return ${wantWords}, but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  return null;
}

function checkReach(t: ReachTest, run: TestRun): Verdict {
  const bad = common(t, run, 'bool', 'True or False');
  if (bad) return bad;
  const said = run.result!.value![0] === 1;
  if (said === t.expected) return { ok: true, kind: 'pass', title: 'Passed', detail: t.expected ? `Help can still reach ${t.goalName}.` : `${t.goalName} is cut off until a train moves. You returned False. Correct!` };
  return said
    ? { ok: false, kind: 'wrong', title: 'Help cannot get in', detail: `You returned True, but trains block every way to ${t.goalName}. Do you skip the corners in blocked?` }
    : { ok: false, kind: 'wrong', title: 'There is still a way in', detail: `You returned False, but ${t.startName} can still drive to ${t.goalName}. Does your search keep going until there is nothing left to explore?` };
}

function checkRoute(t: RouteTest, run: TestRun, d: TrainData): Verdict {
  const bad = common(t, run, 'list', 'a list of corner ids');
  if (bad) return bad;
  const p = run.result!.value!;
  const exp = t.expected;
  if (!exp.path.length && !p.length) return { ok: true, kind: 'pass', title: 'Passed', detail: `No way in: ${t.goalName} is cut off, and you returned []. Correct!` };
  if (!p.length) return { ok: false, kind: 'empty', title: 'Returned an empty route', detail: 'You returned [] but there is still a way around the train.' };
  if (p[0] !== t.start) return { ok: false, kind: 'endpoints', title: 'Route starts in the wrong place', detail: `It should start at ${t.startName} (corner ${t.start}) but starts at corner ${p[0]}.` };
  if (p[p.length - 1] !== t.goal) return { ok: false, kind: 'endpoints', title: 'Route ends in the wrong place', detail: `It should end at ${t.goalName} (corner ${t.goal}) but ends at corner ${p[p.length - 1]}.` };
  const blocked = new Set(t.blocked);
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1], p[i]];
    if (blocked.has(b)) return { ok: false, kind: 'closed', title: 'Your route drives through a stopped train', detail: `A train is stopped on the ${d.xname.get(b) ?? 'rail'} crossing (corner ${b}). Skip every corner in blocked.` };
    if (!d.edgeLen.has(key(a, b))) return { ok: false, kind: 'gap', title: 'No street here', detail: `Corners ${a} and ${b} are next to each other in your route, but no street connects them.` };
  }
  if (!exp.path.length) return { ok: false, kind: 'closed', title: 'There is no way in', detail: 'Every way in is blocked, so the answer is [].' };
  const m = pathMeters(p, d);
  if (m > exp.meters! + 0.5) return { ok: false, kind: 'longer', title: 'A shorter route exists', detail: `Your route is ${miles(m)} mi, but a ${miles(exp.meters!)} mi route exists.` };
  const extra = t.clearMeters ? driveMin(m) - driveMin(t.clearMeters) : 0;
  return { ok: true, kind: 'pass', title: 'Passed', detail: `${miles(m)} mi · about ${driveMin(m)} min drive to ${t.goalName}${extra > 0 ? ` · the train adds about ${extra} min` : m > (t.clearMeters ?? 0) + 0.5 ? ' · the train makes it longer' : ''}` };
}

function checkUnderpass(t: UnderpassTest, run: TestRun, d: TrainData): Verdict {
  const bad = common(t, run, 'int', 'one crossing (a corner id)');
  if (bad) return bad;
  const pick = run.result!.value![0];
  const n = t.scenarios.length;
  if (!t.candidates.includes(pick)) return { ok: false, kind: 'wrong', title: 'That is not one of the crossings', detail: `You returned corner ${pick}. Return one of the corners in crossings.` };
  const score = t.scores[pick];
  const name = d.xname.get(pick) ?? `corner ${pick}`;
  if (score > t.best) return { ok: false, kind: 'wrong', title: 'A better crossing exists', detail: `With an underpass on ${name}, ${hh(score)} are still cut off over ${n} mornings (${hh(t.baseline)} today). Another crossing leaves only ${t.best.toLocaleString()}.` };
  return { ok: true, kind: 'pass', title: 'Passed', detail: `An underpass on ${name} cuts trapped households from ${t.baseline.toLocaleString()} to ${t.best.toLocaleString()} over ${n} mornings (estimate).` };
}

export function checkTrain(t: TrainTest, run: TestRun, d: TrainData): Verdict {
  return t.level === 'reach' ? checkReach(t, run) : t.level === 'route' ? checkRoute(t, run, d) : checkUnderpass(t, run, d);
}
