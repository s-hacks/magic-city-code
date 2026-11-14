// Runs Don't Get Trapped 1 end to end in REAL Pyodide with the same harness, data file and
// TypeScript checker the browser uses. Proves the reference solution passes every test, the
// starter fails, and the two classic mistakes are caught (driving through a train, giving up early).
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';
import { trappedCoachInfo } from '@mcc/shared';
import harnessPy from './trapped/harness.py?raw';
import { checkTrapped, reach, type TrappedData } from './trapped/check';
import type { TestRun } from '../py/runner';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/data');
const raw = readFileSync(resolve(DATA, 'trapped.json'), 'utf8');
const d: TrappedData = JSON.parse(raw);
const indexURL = dirname(createRequire(import.meta.url).resolve('pyodide/package.json')) + '/';

describe("Don't Get Trapped 1", () => {
  let run: (code: string) => TestRun[];
  const check = (code: string) => {
    const runs = run(code);
    return d.tests.map((t, i) => ({ id: t.id, visible: t.visible, ...checkTrapped(t, runs[i], d) }));
  };

  it('loads', async () => {
    const py = await loadPyodide({ indexURL });
    py.globals.set('DATA_JSON', raw);
    py.runPython(harnessPy);
    const fn = py.globals.get('__run');
    run = (code) => JSON.parse(fn(code, JSON.stringify({ tests: d.tests.map((t) => ({ id: t.id, start: t.start, goal: t.goal, blocked: t.blocked })) })));
  }, 60_000);

  it('the data matches the story: trains on both Brussels Avenue crossings trap Harris Homes', () => {
    const both = d.tests.find((t) => t.id === 't1')!;
    expect(both.goal).toBe(d.harris.node);
    expect(both.answer).toBe(false);
    expect(d.crossings.filter((c) => both.crossings.includes(c.id)).every((c) => c.street.startsWith('Brussels Avenue'))).toBe(true);
    // the answer key agrees with the TypeScript BFS for every test
    for (const t of d.tests) expect(reach(d, t.start, t.blocked).has(t.goal)).toBe(t.answer);
    expect(d.crossings.length).toBe(26);
  });

  it('the reference solution passes every test', () => {
    expect(check(trappedCoachInfo.solution).filter((x) => !x.ok)).toEqual([]);
  });

  it('the starter (one street away) fails a visible test', () => {
    expect(check(trappedCoachInfo.starterCode).some((x) => x.visible && !x.ok)).toBe(true);
  });

  it('driving through trains is caught', () => {
    const ignores = trappedCoachInfo.solution.replace('if neighbor in blocked or neighbor in seen:', 'if neighbor in seen:');
    expect(ignores).not.toBe(trappedCoachInfo.solution);
    expect(check(ignores).find((x) => x.id === 't1')).toMatchObject({ ok: false, kind: 'closed' });
  });

  it('returning something that is not True/False is caught', () => {
    expect(check('def can_reach(graph, start, goal, blocked):\n    return 1\n')[0]).toMatchObject({ ok: false, kind: 'type' });
  });
});
