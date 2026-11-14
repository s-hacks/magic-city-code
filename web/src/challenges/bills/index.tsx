// Water Bill Check: find bills that look estimated (the same amount 3+ months in a row) so
// households know to ask for a real meter read. Bills are sample data placed in real block groups.
import { billsCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import base from '../common/base.py?raw';
import specific from './harness.py?raw';
import { checkBills, type BillsData, type BillsTest } from './check';
import { createBillsViz } from './viz';

const { starterCode, solution } = billsCoachInfo;

export const billsChallenge: Challenge<BillsData, BillsTest> = {
  id: 'water-bill-check',
  title: 'Water Bill Check',
  difficulty: 'Easy',
  neighborhood: 'East Lake · citywide',
  tags: ['Arrays', 'Loops', 'Streaks'],
  starterCode,
  solution,
  harness: `${base}\n${specific}`,
  legend: [['grey', 'account'], ['gold', 'flagged, correct'], ['orange', 'flagged, looks fine'], ['red', 'missed']],
  ghostLabel: 'answer key',
  loading: 'Loading bills…',
  intro: 'and watch the flags light up across the neighborhood',
  accepted: 'Every household with an estimated bill can now ask for a real meter read.',

  async load() {
    const raw = await fetch('/data/water_bills.json').then((r) => r.text());
    return { raw, data: JSON.parse(raw) };
  },
  tests: (d) => d.tests,
  payload: (tests) => ({ tests: tests.map((t) => ({ id: t.id })) }),
  check: (t, run) => checkBills(t, run),
  createViz: createBillsViz,

  Description: ({ data }) => (
    <>
      <p>
        In fall 2026 Central Alabama Water's billing broke down: calls hit <strong>4,000 a day</strong>, and residents posted
        the same round-number bill (like $99.99 or $179.99) month after month. A bill that never changes probably wasn't read from the meter.
      </p>
      <p>Write <code>flag_estimated(bills)</code> to find those accounts, so the households know to ask for a real meter read.</p>
      <h4>Input</h4>
      <ul>
        <li><code>bills[account]</code>: 12 monthly amounts in dollars, oldest first.</li>
        <li>A month is <code>None</code> when no bill was sent.</li>
      </ul>
      <h4>Return</h4>
      <ul>
        <li>A list of account ids whose bill was the <strong>exact same amount 3 or more months in a row</strong>. Order doesn't matter.</li>
        <li>A <code>None</code> month breaks a streak.</li>
      </ul>
      <h4>Example</h4>
      <pre>{`bills = {"B1": [52.1, 99.99, 99.99, 99.99, 58.2, ...],
         "B2": [64.5, 63.0, 70.25, 72.1, 88.0, ...]}
flag_estimated(bills)  # -> ["B1"]`}</pre>
      <p className="tiny">
        Time limit 3 s per test · hidden tests: a streak of only 2, a missing month, a streak at the end of the year, no accounts, and all{' '}
        {Object.keys(data.accounts).length.toLocaleString()} accounts citywide. Bills are made up (no real account data), placed in real Census block groups.
      </p>
    </>
  ),
};
