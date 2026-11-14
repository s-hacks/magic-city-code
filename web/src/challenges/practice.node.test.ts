// Runs the Stray-Dog Van, Water Bill Check and Open Bed challenges end to end in REAL Pyodide:
// the same harness and data files the browser uses, then the same TypeScript checkers.
// It proves each reference solution passes every test (visible and hidden), the starter code
// does not, and common wrong answers are caught. Slow on the first load (a few seconds each).
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';
import { bedsCoachInfo, billsCoachInfo, vanCoachInfo } from '@mcc/shared';
import base from './common/base.py?raw';
import vanPy from './van/harness.py?raw';
import billsPy from './bills/harness.py?raw';
import bedsPy from './beds/harness.py?raw';
import { checkVan, type VanData } from './van/check';
import { checkBills, type BillsData } from './bills/check';
import { checkBeds, type BedsData } from './beds/check';
import type { TestRun } from '../py/runner';
import type { BaseTest, Verdict } from './types';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/data');
const read = (f: string) => readFileSync(resolve(DATA, f), 'utf8');
const indexURL = dirname(createRequire(import.meta.url).resolve('pyodide/package.json')) + '/';

/** A fresh Python per challenge (harness globals would clash), returning run(code, tests). */
async function harness(specific: string, raw: string) {
  const py = await loadPyodide({ indexURL });
  py.globals.set('DATA_JSON', raw);
  py.runPython(`${base}\n${specific}`);
  const fn = py.globals.get('__run');
  return (code: string, ids: string[]): TestRun[] => JSON.parse(fn(code, JSON.stringify({ tests: ids.map((id) => ({ id })) })));
}

function grade<T extends BaseTest>(tests: T[], runs: TestRun[], check: (t: T, r: TestRun) => Verdict) {
  return tests.map((t, i) => ({ id: t.id, visible: t.visible, ...check(t, runs[i]) }));
}

describe('Stray-Dog Van Route', () => {
  const raw = read('van_route.json');
  const graph = JSON.parse(read('graph.json'));
  const d: VanData = { nodes: graph.nodes, ...JSON.parse(raw) };
  const ids = d.tests.map((t) => t.id);
  let run: Awaited<ReturnType<typeof harness>>;
  const check = (code: string) => grade(d.tests, run(code, ids), (t, r) => checkVan(t, r, d));

  it('loads', async () => { run = await harness(vanPy, raw); }, 60_000);

  it('the reference solution passes every test', () => {
    const v = check(vanCoachInfo.solution);
    expect(v.filter((x) => !x.ok)).toEqual([]);
  });

  it('the starter (reports in number order) is too long on the sample cases', () => {
    const v = check(vanCoachInfo.starterCode);
    expect(v.filter((x) => x.visible).every((x) => !x.ok && x.kind === 'longer')).toBe(true);
  });

  it('nearest neighbor alone passes the samples but not every hidden test', () => {
    const nn = `def plan_route(dist):
    route, left = [0], set(range(1, len(dist)))
    while left:
        nxt = min(left, key=lambda p: dist[route[-1]][p])
        route.append(nxt); left.remove(nxt)
    return route + [0]
`;
    const v = check(nn);
    expect(v.filter((x) => x.visible).every((x) => x.ok)).toBe(true);
    expect(v.some((x) => !x.visible && x.kind === 'longer')).toBe(true);
  });

  it('catches a skipped report, a wrong type and a crash', () => {
    expect(check('def plan_route(dist):\n    return [0, 1, 0]\n')[0].kind).toBe('missing');
    expect(check('def plan_route(dist):\n    return "0,1,0"\n')[0].kind).toBe('type');
    const crash = check('def plan_route(dist):\n    return dist[99][0]\n')[0];
    expect(crash.kind).toBe('crash');
    expect(crash.line).toBe(2);
  });

  it('stops a loop that never ends', () => {
    const [r] = run('def plan_route(dist):\n    while True:\n        pass\n', ['t1']);
    expect(r.timedOut).toBe(true);
  }, 20_000);
});

describe('Water Bill Check', () => {
  const raw = read('water_bills.json');
  const d: BillsData = JSON.parse(raw);
  const ids = d.tests.map((t) => t.id);
  let run: Awaited<ReturnType<typeof harness>>;
  const check = (code: string) => grade(d.tests, run(code, ids), checkBills);

  it('loads', async () => { run = await harness(billsPy, raw); }, 60_000);

  it('the reference solution passes every test, including all accounts citywide', () => {
    expect(check(billsCoachInfo.solution).filter((x) => !x.ok)).toEqual([]);
  });

  it('the starter misses the estimated bills', () => {
    expect(check(billsCoachInfo.starterCode)[0].kind).toBe('missing');
  });

  it('catches a streak counted across a missing month', () => {
    const buggy = `def flag_estimated(bills):
    out = []
    for acct, months in bills.items():
        streak, prev = 0, None
        for m in months:
            if m is None:
                continue
            streak = streak + 1 if m == prev else 1
            prev = m
            if streak >= 3:
                out.append(acct)
                break
    return out
`;
    const v = check(buggy);
    expect(v.find((x) => x.id === 'h2')?.ok).toBe(false);
  });

  it('catches "same amount 3 times anywhere" instead of "in a row"', () => {
    const v = check('def flag_estimated(bills):\n    return [a for a, m in bills.items() if any(m.count(x) >= 3 for x in m if x is not None)]\n');
    expect(v[0].ok).toBe(false);
    expect(v[0].kind).toBe('wrong');
  });

  it('accepts a set as the answer', () => {
    const asSet = billsCoachInfo.solution.replace('return flagged', 'return set(flagged)');
    expect(check(asSet).every((x) => x.ok)).toBe(true);
  });
});

describe('Open Bed', () => {
  const raw = read('open_bed.json');
  const d: BedsData = JSON.parse(raw);
  const ids = d.tests.map((t) => t.id);
  let run: Awaited<ReturnType<typeof harness>>;
  const check = (code: string) => grade(d.tests, run(code, ids), checkBeds);

  it('loads', async () => { run = await harness(bedsPy, raw); }, 60_000);

  it('the reference solution passes every test', () => {
    expect(check(bedsCoachInfo.solution).filter((x) => !x.ok)).toEqual([]);
  });

  it('the starter (everyone on the waitlist) fails', () => {
    expect(check(bedsCoachInfo.starterCode)[0].ok).toBe(false);
  });

  it('catches serving people in list order instead of by priority', () => {
    const noPriority = bedsCoachInfo.solution.replace('order = sorted(people, key=lambda p: (-p["priority"], p["arrived"]))', 'order = people');
    expect(noPriority).not.toBe(bedsCoachInfo.solution);
    const v = check(noPriority);
    expect(v.some((x) => !x.ok && x.kind === 'wrong')).toBe(true);
  });

  it('catches ignoring the pet rule', () => {
    const noPets = bedsCoachInfo.solution.replace('and (s["pets"] or not person["pet"])', '');
    expect(noPets).not.toBe(bedsCoachInfo.solution);
    expect(check(noPets).some((x) => !x.ok)).toBe(true);
  });

  it('catches a person left out of the answer', () => {
    const v = check('def assign_beds(shelters, people):\n    return {}\n');
    expect(v[0].kind).toBe('missing');
  });
});
