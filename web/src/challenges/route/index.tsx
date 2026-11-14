// Route to Fresh Food: registers the challenge (title, starter code, solution, hidden tests) so it shows up in the Practice list.
import { routeCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import harness from './harness.py?raw';
import { checkRoute, closedFor, key, type RouteData, type RouteTest } from './check';
import { createRouteViz } from './viz';

const { starterCode, solution } = routeCoachInfo;

export const routeChallenge: Challenge<RouteData, RouteTest> = {
  id: 'route-to-fresh-food',
  title: 'Route to Fresh Food',
  difficulty: 'Medium',
  neighborhood: 'Downtown · Woodlawn',
  tags: ['Graphs', 'Dijkstra', 'Heaps'],
  flood: true,
  starterCode,
  solution,
  harness,

  async load() {
    const [graphRaw, tests] = await Promise.all([
      fetch('/data/graph.json').then((r) => r.text()),
      fetch('/data/route_tests.json').then((r) => r.json()),
    ]);
    const graph = JSON.parse(graphRaw);
    const edgeLen = new Map<string, number>();
    for (const [u, v, m] of graph.edges) { edgeLen.set(key(u, v), m); edgeLen.set(key(v, u), m); }
    return { raw: graphRaw, data: { graph, edgeLen, ...tests } };
  },
  tests: (d) => d.tests,
  payload: (tests, d, o) => ({ stopOnFail: false, tests: tests.map((t) => ({ id: t.id, start: t.start, goal: t.goal, closed: closedFor(t, d, o) })) }),
  check: checkRoute,
  createViz: createRouteViz,

  Description: ({ data }) => {
    const nodes = Object.keys(data.graph.nodes).length;
    return (
      <>
        <p>
          Downtown Birmingham and Woodlawn have <strong>{data.places.filter((p) => p.kind === 'grocery').length} grocery stores</strong> for
          thousands of families. Most kids here don't have a car in the family, so the walk is what matters.
        </p>
        <p>
          Write <code>shortest_path(graph, start, goal)</code> to find the <strong>shortest walking route</strong> from a school to a grocery
          store on real Birmingham streets ({nodes.toLocaleString()} street corners).
        </p>
        <h4>Input</h4>
        <ul>
          <li><code>graph[corner]</code> is a list of <code>(neighbor, meters)</code> pairs: the streets leaving that corner.</li>
          <li><code>start</code>, <code>goal</code>: corner ids (ints).</li>
        </ul>
        <h4>Return</h4>
        <ul>
          <li>A list of corner ids <code>[start, …, goal]</code> where each pair is joined by a street.</li>
          <li><code>[]</code> if the goal can't be reached.</li>
        </ul>
        <h4>Example</h4>
        <pre>{`graph = {1: [(2, 100), (3, 400)],
         2: [(1, 100), (3, 150)],
         3: [(1, 400), (2, 150)]}
shortest_path(graph, 1, 3)  # -> [1, 2, 3]  (250 m)`}</pre>
        <h4>Helpers</h4>
        <ul>
          <li><code>city.coords(corner)</code> → <code>(lat, lon)</code></li>
          <li><code>city.distance(a, b)</code> → straight-line meters (great for A*)</li>
        </ul>
        <h4>Flood mode</h4>
        <p>Birmingham's railroad underpasses flood in heavy rain. Turn on <strong>Flood mode</strong> to close them; your code should route around.</p>
        <p className="tiny">Time limit 3 s per test · hidden tests include flooding, start = goal, and a store you can't reach.</p>
      </>
    );
  },
};
