// "Don't Get Trapped": three levels on the real streets and rail crossings around Harris Homes.
// Streets, crossings, fire stations and household counts are real. Where the trains stop is made up:
// no public record says which crossings are blocked when (see scripts/prep_trains.py).
import type { ReactNode } from 'react';
import type { Challenge } from '../types';
import harness from './harness.py?raw';
import { checkTrain, key, type Level, type TrainData, type TrainTest } from './check';
import { createTrainViz } from './viz';

let cache: Promise<{ data: TrainData; raw: string }> | null = null;
function load() {
  cache ??= fetch('/data/trains.json').then((r) => r.text()).then((text) => {
    const j = JSON.parse(text);
    const edgeLen = new Map<string, number>();
    for (const [u, v, m] of j.edges) { edgeLen.set(key(u, v), m); edgeLen.set(key(v, u), m); }
    const tag = (level: Level) => j[level].map((t: object) => ({ ...t, level }));
    const data: TrainData = {
      graph: { nodes: j.nodes, edges: j.edges }, crossings: j.crossings, homes: j.homes, harris: j.harris, rail: j.rail,
      reach: tag('reach'), route: tag('route'), underpass: tag('underpass'),
      edgeLen, xname: new Map(j.crossings.map((c: { node: number; name: string }) => [c.node, c.name])),
    };
    // Python only needs the streets and the homes.
    return { data, raw: JSON.stringify({ nodes: j.nodes, edges: j.edges.map((e: unknown[]) => e.slice(0, 3)), homes: j.homes }) };
  });
  return cache;
}

const Story = () => (
  <p>
    Freight trains waiting for Norris Yard stop across the streets of east Birmingham, sometimes for hours.{' '}
    <strong>Harris Homes</strong> has only two ways in, both over the tracks on Brussels Avenue. When trains sit on both,
    an ambulance cannot get in.
  </p>
);
const Honest = () => (
  <p className="tiny">
    Streets, rail crossings, fire stations and household counts are real (OpenStreetMap, Census). Where the trains stop is
    made up: nobody publishes which crossings are blocked when. Streets are treated as two-way.
  </p>
);
const graphInput = <li><code>graph[corner]</code> is a list of <code>(neighbor, meters)</code> pairs: the streets leaving that corner.</li>;
const blockedInput = <li><code>blocked</code>: a set of corners where a train is stopped. You cannot drive through them.</li>;

function level(o: {
  level: Level; id: string; title: string; difficulty: 'Easy' | 'Medium' | 'Hard'; tags: string[];
  starterCode: string; solution: string; summary: string; accepted: string; hint: string; ghostLabel: string | null;
  next?: { id: string; label: string }; legend: [string, string][]; body: (d: TrainData) => ReactNode;
}): Challenge<TrainData, TrainTest> {
  return {
    id: o.id, title: o.title, difficulty: o.difficulty, neighborhood: 'Harris Homes · Woodlawn', tags: o.tags,
    starterCode: o.starterCode, solution: o.solution, summary: o.summary, harness, load,
    tests: (d) => d[o.level],
    payload: (tests) => ({
      level: o.level,
      tests: tests.map((t) => (t.level === 'underpass'
        ? { id: t.id, station: t.station, mornings: t.scenarios.map((m) => m.blocked), crossings: t.candidates }
        : { id: t.id, start: t.start, goal: t.goal, blocked: t.blocked })),
    }),
    check: (t, run, d) => checkTrain(t, run, d),
    createViz: createTrainViz,
    ui: { toggle: null, legend: o.legend, accepted: o.accepted, hint: o.hint, ghostLabel: o.ghostLabel, next: o.next },
    Description: ({ data }) => <><Story />{o.body(data)}<Honest /></>,
  };
}

export const trappedReach = level({
  level: 'reach', id: 'trapped-1-can-help-get-in', title: "Don't Get Trapped 1: Can Help Get In?", difficulty: 'Easy',
  tags: ['Graphs', 'Search (BFS)', 'Sets'],
  summary: 'Freight trains stop across the only streets into Harris Homes. Write a search that tells a dispatcher whether an ambulance can still get in.',
  legend: [['blue', 'explored'], ['orange', 'stopped train'], ['gold', 'help can get in']],
  ghostLabel: null,
  hint: 'Press Run to try two mornings on Brussels Avenue and watch your code search the streets. Submit also runs hidden tests.',
  accepted: 'All tests passed. Your code can tell a dispatcher, in a blink, who is cut off right now.',
  next: { id: 'trapped-2-fastest-way-around', label: 'Level 2: Fastest Way Around' },
  starterCode: `def can_reach(graph, start, goal, blocked):
    """Can an ambulance drive from start to goal?

    graph[corner] -> [(neighbor, meters), ...]
    blocked: a set of corners where a train is stopped.
    Return True or False.
    """
    # Tip: keep a list of corners to visit, starting with start.
    # Remember the corners you have already seen, and skip blocked ones.
    return True
`,
  solution: `from collections import deque

def can_reach(graph, start, goal, blocked):
    seen = {start}
    to_visit = deque([start])

    while to_visit:
        corner = to_visit.popleft()
        if corner == goal:
            return True
        for neighbor, meters in graph[corner]:
            if neighbor in seen or neighbor in blocked:
                continue
            seen.add(neighbor)
            to_visit.append(neighbor)

    return False
`,
  body: (d) => (
    <>
      <p>
        Write <code>can_reach(graph, start, goal, blocked)</code>. It answers one question for the dispatcher: with these
        trains stopped, <strong>can the ambulance get from the fire station to the home at all?</strong> The map has{' '}
        {Object.keys(d.graph.nodes).length.toLocaleString()} street corners and {d.crossings.length} rail crossings.
      </p>
      <h4>Input</h4>
      <ul>{graphInput}<li><code>start</code>, <code>goal</code>: corner ids (ints).</li>{blockedInput}</ul>
      <h4>Return</h4>
      <ul><li><code>True</code> if there is any way to drive from start to goal, <code>False</code> if not.</li></ul>
      <h4>Example</h4>
      <pre>{`graph = {1: [(2, 100)], 2: [(1, 100), (3, 80)], 3: [(2, 80)]}
can_reach(graph, 1, 3, set())  # -> True
can_reach(graph, 1, 3, {2})    # -> False (a train is on corner 2)`}</pre>
      <p className="tiny">Time limit 3 s per test · hidden tests include a morning with no trains and other neighborhoods.</p>
    </>
  ),
});

export const trappedRoute = level({
  level: 'route', id: 'trapped-2-fastest-way-around', title: "Don't Get Trapped 2: Fastest Way Around", difficulty: 'Medium',
  tags: ['Graphs', 'Dijkstra', 'Heaps'],
  summary: 'A train is stopped on the usual way in. Find the shortest drive from the fire station that avoids every blocked crossing.',
  legend: [['blue', 'explored'], ['orange', 'stopped train'], ['gold', 'your route']],
  ghostLabel: 'best route',
  hint: 'Press Run to send an ambulance around a stopped train and watch your code search. Submit also runs hidden tests.',
  accepted: 'All tests passed. Every ambulance on this list takes the fastest way around the train.',
  next: { id: 'trapped-3-one-underpass', label: 'Level 3: One Underpass' },
  starterCode: `import heapq

def rescue_route(graph, start, goal, blocked):
    """Return the shortest drive from start to goal that avoids stopped trains.

    graph[corner] -> [(neighbor, meters), ...]
    blocked: a set of corners where a train is stopped.
    Return a list of corner ids: [start, ..., goal].
    Return [] if there is no way in.
    """
    # Tip: Dijkstra's algorithm with heapq.heappush / heapq.heappop,
    # skipping every neighbor that is in blocked.
    return [start]
`,
  solution: `import heapq

def rescue_route(graph, start, goal, blocked):
    best = {start: 0}
    came_from = {}
    heap = [(0, start)]
    done = set()

    while heap:
        dist, corner = heapq.heappop(heap)
        if corner in done:
            continue
        done.add(corner)
        if corner == goal:
            break
        for neighbor, meters in graph[corner]:
            if neighbor in blocked:
                continue
            new = dist + meters
            if new < best.get(neighbor, float("inf")):
                best[neighbor] = new
                came_from[neighbor] = corner
                heapq.heappush(heap, (new, neighbor))

    if goal not in done:
        return []
    route = [goal]
    while route[-1] != start:
        route.append(came_from[route[-1]])
    return route[::-1]
`,
  body: () => (
    <>
      <p>
        Knowing help <em>can</em> get in is not enough: every minute counts. Write{' '}
        <code>rescue_route(graph, start, goal, blocked)</code> to find the <strong>shortest drive</strong> from the fire
        station to the home that does not cross a stopped train.
      </p>
      <h4>Input</h4>
      <ul>{graphInput}<li><code>start</code>, <code>goal</code>: corner ids (ints).</li>{blockedInput}</ul>
      <h4>Return</h4>
      <ul>
        <li>A list of corner ids <code>[start, …, goal]</code> where each pair is joined by a street and none is blocked.</li>
        <li><code>[]</code> if every way in is blocked.</li>
      </ul>
      <h4>Example</h4>
      <pre>{`graph = {1: [(2, 100), (3, 400)],
         2: [(1, 100), (3, 150)],
         3: [(1, 400), (2, 150)]}
rescue_route(graph, 1, 3, set())  # -> [1, 2, 3]  (250 m)
rescue_route(graph, 1, 3, {2})    # -> [1, 3]     (400 m, around the train)`}</pre>
      <p className="tiny">Time limit 3 s per test · hidden tests include no trains, other homes, and homes that are cut off.</p>
    </>
  ),
});

export const trappedUnderpass = level({
  level: 'underpass', id: 'trapped-3-one-underpass', title: "Don't Get Trapped 3: One Underpass", difficulty: 'Hard',
  tags: ['Graphs', 'Nested loops', 'Comparing plans'],
  summary: 'The city can afford one underpass. Test every crossing against a week of stopped trains and pick the one that frees the most households.',
  legend: [['orange', 'stopped trains'], ['gold', 'homes your underpass frees']],
  ghostLabel: 'best crossing',
  hint: 'Press Run to test your pick on two sets of mornings. Red dots are homes that get cut off; your underpass turns the ones it frees gold.',
  accepted: 'All tests passed. Your code ranks crossings by how many households each underpass would free: evidence a city can use.',
  starterCode: `def best_underpass(graph, station, homes, mornings, crossings):
    """Pick the one crossing where an underpass helps the most households.

    graph[corner] -> [(neighbor, meters), ...]
    station: the fire station's corner.
    homes: {corner: households living there}
    mornings: a list of sets. Each set holds the crossings blocked on one morning.
    crossings: the crossings where the underpass could go.

    A home is cut off on a morning if the station cannot drive to it.
    An underpass at a crossing means that crossing is never blocked.
    Return the crossing that leaves the fewest households cut off,
    added up over all the mornings.
    """
    # Tip: write a helper that returns every corner the station can reach,
    # then try each crossing on each morning and keep the best total.
    return crossings[0]
`,
  solution: `from collections import deque

def reachable(graph, start, blocked):
    seen = {start}
    to_visit = deque([start])
    while to_visit:
        corner = to_visit.popleft()
        for neighbor, meters in graph[corner]:
            if neighbor not in seen and neighbor not in blocked:
                seen.add(neighbor)
                to_visit.append(neighbor)
    return seen

def cut_off(graph, station, homes, blocked):
    ok = reachable(graph, station, blocked)
    return sum(count for corner, count in homes.items() if corner not in ok)

def best_underpass(graph, station, homes, mornings, crossings):
    best = None
    best_total = None
    for crossing in crossings:
        total = 0
        for blocked in mornings:
            total += cut_off(graph, station, homes, blocked - {crossing})
        if best_total is None or total < best_total:
            best = crossing
            best_total = total
    return best
`,
  body: () => (
    <>
      <p>
        The city's real plan includes a vehicle underpass at Brussels Avenue, but building is years away and not yet
        funded. Suppose there is money for <strong>one underpass</strong>. Write{' '}
        <code>best_underpass(graph, station, homes, mornings, crossings)</code> to pick the crossing that leaves the{' '}
        <strong>fewest households cut off</strong>.
      </p>
      <h4>Input</h4>
      <ul>
        {graphInput}
        <li><code>station</code>: the fire station's corner.</li>
        <li><code>homes</code>: a dict, <code>{'{corner: households}'}</code>.</li>
        <li><code>mornings</code>: a list of sets. Each set is the crossings blocked on one morning.</li>
        <li><code>crossings</code>: a list of corners where the underpass could go.</li>
      </ul>
      <h4>Rules</h4>
      <ul>
        <li>A home is <strong>cut off</strong> on a morning if the station cannot drive to it.</li>
        <li>An underpass at a crossing means that crossing is never blocked.</li>
        <li>Add up the cut-off households over every morning. Fewest wins. A tie: return any of the best.</li>
      </ul>
      <h4>Return</h4>
      <ul><li>One corner id from <code>crossings</code>.</li></ul>
      <p className="tiny">Time limit 5 s per test · no replay on this level: your code searches the map many times. Household counts are estimates.</p>
    </>
  ),
});
