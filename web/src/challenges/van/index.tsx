// Stray-Dog Van Route: plan one animal-control van's trip through today's stray-dog reports
// on real Downtown and Woodlawn streets. Stray dogs are the #1 complaint to Birmingham's 311.
import { vanCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import base from '../common/base.py?raw';
import specific from './harness.py?raw';
import { checkVan, type VanData, type VanTest } from './check';
import { createVanViz } from './viz';
import { km } from '../common/viz';

const { starterCode, solution } = vanCoachInfo;

export const vanChallenge: Challenge<VanData, VanTest> = {
  id: 'stray-dog-van',
  title: 'Stray-Dog Van Route',
  difficulty: 'Hard',
  neighborhood: 'Downtown · Woodlawn',
  tags: ['Graphs', 'Greedy', 'Heuristics'],
  starterCode,
  solution,
  harness: `${base}\n${specific}`,
  legend: [['violet', 'van depot'], ['orange', 'stray-dog report'], ['gold', 'your route']],
  ghostLabel: 'best route',
  loading: 'Loading Birmingham streets and today\'s reports…',
  intro: 'and watch the van drive your route',
  accepted: 'Every dog on today\'s list gets picked up, and the van saves miles doing it.',

  async load() {
    const [graph, raw] = await Promise.all([
      fetch('/data/graph.json').then((r) => r.json()),
      fetch('/data/van_route.json').then((r) => r.text()),
    ]);
    const van = JSON.parse(raw);
    return { raw, data: { nodes: graph.nodes, ...van } };
  },
  tests: (d) => d.tests,
  payload: (tests) => ({ tests: tests.map((t) => ({ id: t.id })) }),
  check: (t, run, d) => checkVan(t, run, d),
  createViz: createVanViz,

  Description: ({ data }) => {
    const t1 = data.tests[0];
    return (
      <>
        <p>
          Stray dogs are the <strong>#1 complaint</strong> Birmingham residents send to 311: over 20,000 animal-control calls from 2023 to 2025.
          Every morning one van has to pick up the dogs reported overnight, and every extra mile is time a dog spends loose near a school.
        </p>
        <p>
          Write <code>plan_route(dist)</code> to plan the van's trip on <strong>real Birmingham streets</strong>. Start at the depot, visit every
          report once, and come back.
        </p>
        <h4>Input</h4>
        <ul>
          <li><code>dist[a][b]</code>: street distance in meters from place <code>a</code> to place <code>b</code>.</li>
          <li>Place <code>0</code> is the van depot. Places <code>1, 2, …</code> are today's reports.</li>
        </ul>
        <h4>Return</h4>
        <ul>
          <li>The visiting order: <code>[0, …, 0]</code>, every report exactly once.</li>
          <li>It must be within <strong>{Math.round(data.slack * 100)}%</strong> of the shortest possible route.</li>
        </ul>
        <h4>Example</h4>
        <pre>{`dist = [[0, 300, 900],
        [300, 0, 700],
        [900, 700, 0]]
plan_route(dist)  # -> [0, 1, 2, 0]  (300 + 700 + 900 m)`}</pre>
        <p>
          Sample case 1 has {t1.places.length - 1} reports; visiting them in number order drives {km(routeLen(t1))}, but {km(t1.best.meters)} is possible.
        </p>
        <p className="tiny">Time limit 3 s per test · hidden tests: no reports, one report, two dogs at the same corner, busy days with 10–12 reports. Reports are sample data; the streets are real.</p>
      </>
    );
  },
};

function routeLen(t: VanTest) {
  const r = [...t.places.keys(), 0];
  return r.slice(1).reduce((m, p, i) => m + t.dist[r[i]][p], 0);
}
