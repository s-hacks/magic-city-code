// Grocery Gap: choose sites for new grocery stores across all of Birmingham so the most
// households without a car get a store within a mile. Real block groups, stores and sites.
import { groceryCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import base from '../common/base.py?raw';
import specific from './harness.py?raw';
import { checkGrocery, unserved, type GroceryData, type GroceryTest } from './check';
import { createGroceryViz } from './viz';

const { starterCode, solution } = groceryCoachInfo;

export const groceryChallenge: Challenge<GroceryData, GroceryTest> = {
  id: 'grocery-gap',
  title: 'Grocery Gap',
  difficulty: 'Hard',
  neighborhood: 'Citywide',
  tags: ['Greedy', 'Sets', 'Optimization'],
  starterCode,
  solution,
  harness: `${base}\n${specific}`,
  legend: [['red', 'no store within a mile'], ['gold', 'reached by your stores'], ['green', 'already served'], ['violet', 'possible site']],
  ghostLabel: 'best sites',
  loading: 'Loading Birmingham block groups and stores…',
  intro: 'and watch your new stores light up the city',
  accepted: 'Your stores reach the families who need them most. That is the case the city council needs before it spends grocery incentives.',

  async load() {
    const [raw, areas] = await Promise.all([
      fetch('/data/grocery_gap.json').then((r) => r.text()),
      fetch('/data/areas.json').then((r) => r.json()),
    ]);
    const polygons = Object.fromEntries((areas as { id: string; polygon: [number, number][][] }[]).map((a) => [a.id, a.polygon]));
    return { raw, data: { ...JSON.parse(raw), polygons } };
  },
  tests: (d) => d.tests,
  payload: (tests) => ({ tests: tests.map((t) => ({ id: t.id })) }),
  check: (t, run, d) => checkGrocery(t, run, d),
  createViz: createGroceryViz,

  Description: ({ data }) => {
    const t = data.tests[0];
    const gap = unserved(t, data);
    return (
      <>
        <p>
          About <strong>70% of Birmingham residents</strong> live in a USDA food desert. The West End Save-A-Lot has sat empty since 2023, and the
          city keeps paying incentives for stores that close. Right now <strong>{gap.length} of {t.areas.length}</strong> block groups have no grocery
          store within a mile, home to {gap.reduce((n, a) => n + a.no_car, 0).toLocaleString()} households without a car.
        </p>
        <p>Write <code>pick_sites(areas, stores, sites, k)</code> to choose where <code>k</code> new stores should go.</p>
        <h4>Input</h4>
        <ul>
          <li><code>areas</code>: real Census block groups, <code>{'{"id", "lat", "lon", "households", "no_car", "neighborhood"}'}</code></li>
          <li><code>stores</code>: the {data.stores.length} grocery stores open today. <code>sites</code>: {data.sites.length} places a store could go (libraries, community centers, churches, the empty Save-A-Lot).</li>
          <li>An area is <strong>served</strong> if its center is within <code>RADIUS</code> (1 mile) of a store. <code>city.distance(a, b)</code> gives meters.</li>
        </ul>
        <h4>Return</h4>
        <ul>
          <li>A list of <code>k</code> different site ids that reach the most <code>no_car</code> households in areas that aren't served today.</li>
          <li>At least <strong>{Math.round(data.minShare * 100)}%</strong> of the best possible.</li>
        </ul>
        <p className="tiny">Time limit 3 s per test · hidden tests: no stores this year, a west-side-only budget, five new stores. Block groups, stores and sites are real (Census, OpenStreetMap).</p>
      </>
    );
  },
};
