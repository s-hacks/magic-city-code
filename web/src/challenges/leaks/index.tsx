// Stop the Leaks: schedule water-main repair crews so the least water is lost. Central Alabama
// Water loses about 53% of its water revenue to leaks and unbilled use. Leaks are sample data
// placed in real Census block groups.
import { leaksCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import base from '../common/base.py?raw';
import specific from './harness.py?raw';
import { checkLeaks, gal, type LeakData, type LeakTest } from './check';
import { createLeaksViz } from './viz';

const { starterCode, solution } = leaksCoachInfo;

export const leaksChallenge: Challenge<LeakData, LeakTest> = {
  id: 'stop-the-leaks',
  title: 'Stop the Leaks',
  difficulty: 'Hard',
  neighborhood: 'Citywide',
  tags: ['Greedy', 'Scheduling', 'Simulation'],
  starterCode,
  solution,
  harness: `${base}\n${specific}`,
  legend: [['cyan', 'leak, pouring'], ['orange', 'being fixed'], ['green', 'fixed'], ['gold', 'crew route']],
  ghostLabel: 'best plan',
  loading: 'Loading today\'s leaks…',
  intro: 'and watch the crews race the water counter',
  accepted: 'Your crews stopped the most water they could. Every gallon saved is money off everyone\'s bill.',

  async load() {
    const raw = await fetch('/data/leak_crews.json').then((r) => r.text());
    return { raw, data: JSON.parse(raw) };
  },
  tests: (d) => d.tests,
  payload: (tests) => ({ tests: tests.map((t) => ({ id: t.id })) }),
  check: (t, run, d) => checkLeaks(t, run, d),
  createViz: createLeaksViz,

  Description: ({ data }) => {
    const t2 = data.tests[1];
    return (
      <>
        <p>
          Birmingham's water utility, now Central Alabama Water, loses about <strong>53% of its water revenue</strong>: tens of millions of
          gallons a day leak out or go unbilled, and the 2026 repair budget was cut by more than half. Every hour a main break waits is water
          everyone pays for.
        </p>
        <p>
          Write <code>plan_crews(leaks, crews, depot)</code> to plan the repair crews' day so the <strong>least water is lost</strong>.
        </p>
        <h4>Input</h4>
        <ul>
          <li><code>leaks</code>: <code>{'{"id", "lat", "lon", "gallons_per_hour", "repair_hours"}'}</code></li>
          <li><code>crews</code>: how many crews are working. <code>depot</code>: where they all start.</li>
          <li><code>city.drive_hours(a, b)</code> → hours to drive from <code>a</code> to <code>b</code>.</li>
        </ul>
        <h4>How water is lost</h4>
        <p>Each leak pours <code>gallons_per_hour</code> until its crew <em>finishes</em> the repair. A crew drives to a leak, repairs it, then drives to its next one.</p>
        <h4>Return</h4>
        <ul>
          <li>One list of leak ids per crew, in the order that crew fixes them: <code>[["L03", "L01"], ["L02"]]</code>.</li>
          <li>Within <strong>{(data.slack * 100).toFixed(1)}%</strong> of the best plan known.</li>
        </ul>
        <p>Sample case 2 ({t2.leaks.length} leaks, {t2.crews} crews): fixing them in the order they were reported loses far more than the {gal(t2.best.gallons)} the best plan loses.</p>
        <p className="tiny">Time limit 3 s per test · hidden tests: no leaks, one leak and three crews, a far main break vs. a nearby leak, a hard freeze with 18 leaks. Leaks are sample data placed in real block groups.</p>
      </>
    );
  },
};
