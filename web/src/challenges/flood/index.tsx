// Flood Cut-Off: how far is every street corner in Downtown and Woodlawn from the closest open
// storm shelter, when railroad underpasses flood? Real streets and underpasses; schools stand in
// as the shelters for this challenge.
import { floodCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import harness from './harness.py?raw';
import { checkFlood, type FloodData, type FloodTest } from './check';
import { createFloodViz } from './viz';

const { starterCode, solution } = floodCoachInfo;

export const floodChallenge: Challenge<FloodData, FloodTest> = {
  id: 'flood-cutoff',
  title: 'Flood Cut-Off',
  difficulty: 'Hard',
  neighborhood: 'Downtown · Woodlawn',
  tags: ['Graphs', 'Dijkstra', 'Multi-source'],
  starterCode,
  solution,
  harness,
  legend: [['ramp', 'walk time: near → 20+ min'], ['orange', 'flooded'], ['red', 'cut off']],
  ghostLabel: 'correct times',
  loading: 'Loading Birmingham streets…',
  intro: 'and watch your search flood outward from every shelter',
  accepted: 'Emergency planners can now see, corner by corner, who is too far from shelter when the underpasses flood.',

  async load() {
    const [raw, flood] = await Promise.all([
      fetch('/data/graph.json').then((r) => r.text()),
      fetch('/data/flood_reach.json').then((r) => r.json()),
    ]);
    return { raw, data: { graph: JSON.parse(raw), ...flood } };
  },
  tests: (d) => d.tests,
  payload: (tests) => ({ tests: tests.map((t) => ({ id: t.id, shelters: t.shelters.map((s) => s.node), closed: t.closed })) }),
  check: (t, run, d) => checkFlood(t, run, d),
  createViz: createFloodViz,

  Description: ({ data }) => (
    <>
      <p>
        Birmingham's railroad underpasses flood in heavy rain, and about <strong>a third of the city's 27,000 storm drains</strong> need repair.
        When the water comes up, families need to know how far they are from shelter, and which blocks are cut off completely.
      </p>
      <p>
        Write <code>walk_times(graph, shelters)</code> to find how far <strong>every one of the {Object.keys(data.graph.nodes).length.toLocaleString()} street
        corners</strong> in Downtown and Woodlawn is from the <strong>closest</strong> open shelter.
      </p>
      <h4>Input</h4>
      <ul>
        <li><code>graph[corner]</code>: list of <code>(neighbor, meters)</code> pairs. Flooded streets are already removed.</li>
        <li><code>shelters</code>: list of corner ids where a shelter is open.</li>
      </ul>
      <h4>Return</h4>
      <ul>
        <li><code>{'{corner: meters to the closest shelter}'}</code> for every corner that can reach one.</li>
        <li>Leave out corners that are cut off.</li>
      </ul>
      <h4>Example</h4>
      <pre>{`graph = {1: [(2, 100)], 2: [(1, 100), (3, 50)], 3: [(2, 50)], 4: []}
walk_times(graph, [1, 3])  # -> {1: 0, 3: 0, 2: 50}   (4 is cut off)`}</pre>
      <p className="tiny">Time limit 3 s per test · hidden tests: one shelter in a flood, two shelters on one corner, no shelters, a storm that cuts corners off. Streets and underpasses are real; schools stand in as shelters.</p>
    </>
  ),
};
