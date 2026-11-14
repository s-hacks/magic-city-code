// Runs Stop the Leaks, Grocery Gap and Flood Cut-Off end to end in REAL Pyodide with the same
// harnesses, data files and TypeScript checkers the browser uses. Proves each reference solution
// passes every test, the starter fails, and the "obvious but wrong" approach is caught.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';
import { floodCoachInfo, groceryCoachInfo, leaksCoachInfo } from '@mcc/shared';
import base from './common/base.py?raw';
import leaksPy from './leaks/harness.py?raw';
import groceryPy from './grocery/harness.py?raw';
import floodPy from './flood/harness.py?raw';
import { checkLeaks, type LeakData } from './leaks/check';
import { checkGrocery, type GroceryData } from './grocery/check';
import { checkFlood, type FloodData } from './flood/check';
import type { TestRun } from '../py/runner';
import type { BaseTest, Verdict } from './types';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/data');
const read = (f: string) => readFileSync(resolve(DATA, f), 'utf8');
const indexURL = dirname(createRequire(import.meta.url).resolve('pyodide/package.json')) + '/';

async function harness(source: string, raw: string) {
  const py = await loadPyodide({ indexURL });
  py.globals.set('DATA_JSON', raw);
  py.runPython(source);
  const fn = py.globals.get('__run');
  return (code: string, tests: object[]): TestRun[] => JSON.parse(fn(code, JSON.stringify({ tests })));
}
const grade = <T extends BaseTest>(tests: T[], runs: TestRun[], check: (t: T, r: TestRun) => Verdict) =>
  tests.map((t, i) => ({ id: t.id, visible: t.visible, ...check(t, runs[i]) }));

describe('Stop the Leaks', () => {
  const raw = read('leak_crews.json');
  const d: LeakData = JSON.parse(raw);
  let run: Awaited<ReturnType<typeof harness>>;
  const check = (code: string) => grade(d.tests, run(code, d.tests.map((t) => ({ id: t.id }))), (t, r) => checkLeaks(t, r, d));

  it('loads', async () => { run = await harness(`${base}\n${leaksPy}`, raw); }, 60_000);

  it('the reference solution passes every test', () => {
    expect(check(leaksCoachInfo.solution).filter((x) => !x.ok)).toEqual([]);
  });

  it('the starter (report order) loses far too much water', () => {
    expect(check(leaksCoachInfo.starterCode).filter((x) => x.visible).every((x) => x.kind === 'longer')).toBe(true);
  });

  it('"biggest leak first" is caught', () => {
    const biggest = leaksCoachInfo.solution.replace(
      'return leak["gallons_per_hour"] / (city.drive_hours(here, leak) + leak["repair_hours"])',
      'return leak["gallons_per_hour"]',
    );
    expect(biggest).not.toBe(leaksCoachInfo.solution);
    expect(check(biggest).some((x) => !x.ok && x.kind === 'longer')).toBe(true);
  });

  it('catches a missing leak and the wrong number of crews', () => {
    expect(check('def plan_crews(leaks, crews, depot):\n    return [[] for _ in range(crews)]\n')[0].kind).toBe('missing');
    expect(check('def plan_crews(leaks, crews, depot):\n    return [[l["id"] for l in leaks]] * (crews + 1)\n')[0].kind).toBe('wrong');
  });
});

describe('Grocery Gap', () => {
  const raw = read('grocery_gap.json');
  const d = JSON.parse(raw) as GroceryData;
  let run: Awaited<ReturnType<typeof harness>>;
  const check = (code: string) => grade(d.tests, run(code, d.tests.map((t) => ({ id: t.id }))), (t, r) => checkGrocery(t, r, d));

  it('loads', async () => { run = await harness(`${base}\n${groceryPy}`, raw); }, 60_000);

  it('the reference solution passes every test', () => {
    expect(check(groceryCoachInfo.solution).filter((x) => !x.ok)).toEqual([]);
  });

  it('the starter (first k sites) fails', () => {
    expect(check(groceryCoachInfo.starterCode).some((x) => x.visible && !x.ok)).toBe(true);
  });

  it('picking the k best sites on their own fails: they reach the same families', () => {
    const alone = `import city

def pick_sites(areas, stores, sites, k):
    waiting = [a for a in areas if not any(city.distance(a, s) <= 1609 for s in stores)]
    score = lambda site: sum(a["no_car"] for a in waiting if city.distance(a, site) <= 1609)
    return [s["id"] for s in sorted(sites, key=score, reverse=True)[:k]]
`;
    const v = check(alone);
    expect(v.find((x) => x.id === 't1')?.ok).toBe(true);
    expect(v.find((x) => x.id === 't2')?.kind).toBe('longer');
  });

  it('catches a repeated site and the wrong count', () => {
    expect(check('def pick_sites(areas, stores, sites, k):\n    return [sites[0]["id"]] * k\n')[1].kind).toBe('wrong');
    expect(check('def pick_sites(areas, stores, sites, k):\n    return []\n')[0].kind).toBe('wrong');
  });
});

describe('Flood Cut-Off', () => {
  const raw = read('graph.json');
  const d: FloodData = { graph: JSON.parse(raw), ...JSON.parse(read('flood_reach.json')) };
  const payload = d.tests.map((t) => ({ id: t.id, shelters: t.shelters.map((s) => s.node), closed: t.closed }));
  let run: Awaited<ReturnType<typeof harness>>;
  const check = (code: string) => grade(d.tests, run(code, payload), (t, r) => checkFlood(t, r, d));

  it('loads', async () => { run = await harness(floodPy, raw); }, 60_000);

  it('the reference solution passes every test, and records the search for the replay', () => {
    const runs = run(floodCoachInfo.solution, payload);
    const v = grade(d.tests, runs, (t, r) => checkFlood(t, r, d));
    expect(v.filter((x) => !x.ok)).toEqual([]);
    expect(runs[0].events.length).toBeGreaterThan(10_000);
    expect(Math.max(...runs.map((r) => r.ms))).toBeLessThan(3000);
  });

  it('the starter (only the shelters themselves) is missing corners', () => {
    expect(check(floodCoachInfo.starterCode)[0].kind).toBe('missing');
  });

  it('catches counting street hops instead of meters (BFS)', () => {
    const bfs = `from collections import deque

def walk_times(graph, shelters):
    best = {s: 0 for s in shelters}
    q = deque(shelters)
    while q:
        c = q.popleft()
        for n, m in graph[c]:
            if n not in best:
                best[n] = best[c] + m
                q.append(n)
    return best
`;
    expect(check(bfs)[0].kind).toBe('longer');
  });

  it('catches searching from only the first shelter', () => {
    const one = floodCoachInfo.solution.replace('for s in shelters:', 'for s in shelters[:1]:');
    expect(one).not.toBe(floodCoachInfo.solution);
    expect(check(one)[0].kind).toBe('longer');
  });
});
