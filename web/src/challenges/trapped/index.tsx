// Don't Get Trapped 1: Can Help Get In? Freight trains waiting for Norris Yard stop across east
// Birmingham's streets. With these trains stopped, can the ambulance get from the fire station to
// the home at all? Real streets, rail crossings, fire stations and household counts; where the
// trains stop is made up. Data: public/data/trapped.json (scripts/prep_trapped.py).
import { trappedCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import harness from './harness.py?raw';
import { checkTrapped, type TrappedData, type TrappedTest } from './check';
import { createTrappedViz } from './viz';

const { starterCode, solution } = trappedCoachInfo;

export const trappedChallenge: Challenge<TrappedData, TrappedTest> = {
  id: 'dont-get-trapped-1',
  title: 'Don’t Get Trapped 1: Can Help Get In?',
  difficulty: 'Easy',
  neighborhood: 'Oak Ridge Park · East Birmingham',
  tags: ['Graphs', 'Search (BFS)', 'Sets'],
  starterCode,
  solution,
  harness,
  legend: [['blue', 'corners your search reached'], ['train', 'train stopped'], ['gold', 'the way in'], ['red', 'trapped']],
  ghostLabel: 'the real answer',
  loading: 'Loading east Birmingham streets and rail crossings…',
  intro: 'and watch your search spread out from the fire station, street by street',
  accepted: 'The dispatcher can now tell, in a blink, when a stopped train has trapped a neighborhood.',

  async load() {
    const raw = await fetch('/data/trapped.json').then((r) => r.text());
    return { raw, data: JSON.parse(raw) as TrappedData };
  },
  tests: (d) => d.tests,
  payload: (tests) => ({ tests: tests.map((t) => ({ id: t.id, start: t.start, goal: t.goal, blocked: t.blocked })) }),
  check: (t, run, d) => checkTrapped(t, run, d),
  createViz: createTrappedViz,

  Description: ({ data }) => (
    <>
      <p>
        Freight trains waiting for Norris Yard stop across the streets of east Birmingham, sometimes for hours.
        <strong> Harris Homes</strong> has only two ways in, both over the tracks on <strong>Brussels Avenue</strong>.
        When trains sit on both, an ambulance cannot get in.
      </p>
      <p>
        Write <code>can_reach(graph, start, goal, blocked)</code>. It answers one question for the dispatcher: with these
        trains stopped, can the ambulance get from the fire station to the home at all? The map has{' '}
        <strong>{Object.keys(data.graph.nodes).length.toLocaleString()} street corners</strong> and{' '}
        <strong>{data.crossings.length} rail crossings</strong>.
      </p>
      <h4>Input</h4>
      <ul>
        <li><code>graph[corner]</code> is a list of <code>(neighbor, meters)</code> pairs: the streets leaving that corner.</li>
        <li><code>start</code>, <code>goal</code>: corner ids (ints).</li>
        <li><code>blocked</code>: a set of corners where a train is stopped. You cannot drive through them.</li>
      </ul>
      <h4>Return</h4>
      <ul>
        <li><code>True</code> if there is any way to drive from <code>start</code> to <code>goal</code>, <code>False</code> if not.</li>
      </ul>
      <h4>Example</h4>
      <pre>{`graph = {1: [(2, 100)], 2: [(1, 100), (3, 80)], 3: [(2, 80)]}
can_reach(graph, 1, 3, set())  # -> True
can_reach(graph, 1, 3, {2})    # -> False (a train is on corner 2)`}</pre>
      <p className="tiny">Time limit 3 s per test · hidden tests include a morning with no trains and other neighborhoods.</p>
      <p className="tiny">
        Streets, rail crossings, fire stations and household counts are real (OpenStreetMap, Census). Where the trains stop is
        made up: nobody publishes which crossings are blocked when. Streets are treated as two-way.
      </p>
    </>
  ),
};
