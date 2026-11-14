// Don't Get Trapped 1: data types, the answer key (a BFS in TypeScript, so the map can show
// which corners the ambulance could reach) and the checker. Checks run in order and stop at
// the first failure: crash, timeout, not True/False, wrong answer.
import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';

export type LatLon = [number, number];
export interface Crossing { id: string; street: string; nodes: number[]; at: LatLon }
export interface TrappedTest {
  id: string; name: string; visible: boolean;
  start: number; startName: string;
  goal: number; goalName: string;
  blocked: number[]; crossings: string[];
  answer: boolean;
  households: number | null;
  story: string;
}
export interface TrappedData {
  graph: { nodes: Record<string, LatLon>; edges: [number, number, number, [number, number][]?][] };
  crossings: Crossing[];
  stations: { node: number; name: string }[];
  harris: { node: number; name: string; households: number | null };
  tests: TrappedTest[];
}

let adjCache: { d: TrappedData; adj: Map<number, number[]> } | null = null;
export function adjacency(d: TrappedData): Map<number, number[]> {
  if (adjCache?.d === d) return adjCache.adj;
  const adj = new Map<number, number[]>();
  for (const [u, v] of d.graph.edges) {
    (adj.get(u) ?? adj.set(u, []).get(u)!).push(v);
    (adj.get(v) ?? adj.set(v, []).get(v)!).push(u);
  }
  adjCache = { d, adj };
  return adj;
}

/** Every corner reachable from `from` without driving through a blocked corner, with BFS parents. */
export function reach(d: TrappedData, from: number, blocked: Iterable<number>): Map<number, number> {
  const stop = new Set(blocked);
  const parent = new Map<number, number>();
  if (stop.has(from)) return parent;
  parent.set(from, -1);
  const queue = [from];
  const adj = adjacency(d);
  for (let i = 0; i < queue.length; i++) {
    for (const v of adj.get(queue[i]) ?? []) {
      if (!parent.has(v) && !stop.has(v)) { parent.set(v, queue[i]); queue.push(v); }
    }
  }
  return parent;
}

/** The corners behind the trains: what the goal can still reach when the start can't get to it. */
export function pocket(d: TrappedData, t: TrappedTest): Set<number> {
  return new Set(reach(d, t.goal, t.blocked).keys());
}

const trainList = (t: TrappedTest, d: TrappedData) => {
  const names = t.crossings.map((id) => d.crossings.find((c) => c.id === id)?.street ?? id);
  return names.length === 0 ? 'no trains' : names.length <= 3 ? `trains on ${names.join(' and ')}` : `trains on ${names.length} crossings`;
};

export function checkTrapped(t: TrappedTest, run: TestRun, d: TrappedData): Verdict {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: 'Your search never finished. Do you remember which corners you have already seen, so you never put the same corner in line twice?' };
  const res = run.result;
  if (!res || res.type !== 'bool') {
    return { ok: false, kind: 'type', title: 'Return True or False', detail: `The dispatcher needs a yes or no, but can_reach returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  }
  const got = res.value as unknown as boolean;
  const looked = new Set<number>();
  for (let i = 0; i < run.events.length; i += 3) looked.add(run.events[i + 1]);
  const touchedTrain = t.blocked.some((n) => looked.has(n));

  if (got !== t.answer) {
    if (t.answer) {
      return {
        ok: false, kind: 'wrong', title: 'You said no, but the ambulance can get in',
        detail: looked.size <= 5
          ? `With ${trainList(t, d)}, there is a way from ${t.startName} to ${t.goalName}, but your search stopped after looking at ${looked.size} corner${looked.size === 1 ? '' : 's'}. Keep exploring from the corners you reach.`
          : `With ${trainList(t, d)}, there is a way from ${t.startName} to ${t.goalName}. Your search looked at ${looked.size.toLocaleString()} corners and gave up. Do you skip only the blocked corners, and keep going until there's nothing left to explore?`,
      };
    }
    return {
      ok: false, kind: 'closed', title: 'You said yes, but every way in has a train on it',
      detail: touchedTrain
        ? `With ${trainList(t, d)}, no road reaches ${t.goalName}. Your search went through a corner where a train is stopped. Skip any corner in blocked.`
        : `With ${trainList(t, d)}, no road reaches ${t.goalName}. Only answer True when your search actually reaches the goal.`,
    };
  }
  if (!t.answer) {
    const hh = t.households;
    return { ok: true, kind: 'pass', title: 'Passed', detail: `Right: with ${trainList(t, d)}, no road reaches ${t.goalName}.${hh ? ` About ${hh.toLocaleString()} households live in the Census block group around it.` : ''}` };
  }
  return { ok: true, kind: 'pass', title: 'Passed', detail: t.start === t.goal ? 'Right: the start is the goal, so help is already there.' : `Right: with ${trainList(t, d)}, the ambulance can get from ${t.startName} to ${t.goalName}.` };
}
