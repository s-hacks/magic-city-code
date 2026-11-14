// Code challenges: the parts both the browser and the server need. The browser builds the
// challenge page from these; the server's coach uses them as context and keeps the solution
// only for its leak guard (the solution is never sent to Claude or shown to students).

import { bedsCoachInfo, billsCoachInfo, vanCoachInfo } from "./practiceChallenges";
import { floodCoachInfo, groceryCoachInfo, leaksCoachInfo } from "./demoChallenges";
import { trappedCoachInfo } from "./trappedChallenge";

export interface ChallengeCoachInfo {
  id: string;
  title: string;
  /** The task in plain words, as the page describes it. */
  task: string;
  starterCode: string;
  solution: string;
  /** Teacher hints, one per step: nudge, idea, worked example on a different problem. */
  hints: [string, string, string];
  /** What the hidden tests cover, for the "that passed, now Submit" reply. Default: Route to Fresh Food's. */
  hiddenTests?: string;
}

export const routeCoachInfo: ChallengeCoachInfo = {
  id: "route-to-fresh-food",
  title: "Route to Fresh Food",
  task: [
    "Write shortest_path(graph, start, goal) to find the shortest walking route from a school to a grocery store on real Birmingham streets (downtown and Woodlawn).",
    "graph[corner] is a list of (neighbor, meters) pairs: the streets leaving that corner. start and goal are corner ids (ints).",
    "Return a list of corner ids [start, ..., goal] where each pair is joined by a street, or [] if the goal can't be reached.",
    "Helpers: city.coords(corner) -> (lat, lon); city.distance(a, b) -> straight-line meters (good for A*).",
    "Flood mode closes railroad underpasses: closed streets are simply missing from graph, so the route must go around.",
    "Time limit 3 s per test. Hidden tests include flooding, start == goal, and a store that can't be reached.",
    "The checks, in order: crash, timeout, wrong return type, empty route when one exists, wrong start or end, a step with no street, a flooded street, a longer route than the best one.",
  ].join("\n"),
  starterCode: `import heapq

def shortest_path(graph, start, goal):
    """Return the shortest walking route from start to goal.

    graph[corner] -> [(neighbor, meters), ...]
    Return a list of corner ids: [start, ..., goal].
    Return [] if the goal can't be reached.
    """
    # Tip: Dijkstra's algorithm with heapq.heappush / heapq.heappop
    return [start]
`,
  solution: `import heapq

def shortest_path(graph, start, goal):
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
  hints: [
    "Look at what your function returns right now. Does that list ever reach the goal corner? What would you need to keep track of while you walk outward from start?",
    "Dijkstra's idea: always expand the closest corner you haven't finished yet. A heap (heapq) hands you that corner fast. Keep a dictionary of the best distance found so far, and another that remembers which corner you came from, so you can rebuild the route at the end.",
    "Same idea, different problem: to find the cheapest bus trip, put (cost, stop) on a heap, pop the cheapest stop, skip it if you've already finished it, and push each next stop with cost + fare. When you pop the destination, follow 'previous stop' links backwards. Try that pattern with corners and meters.",
  ],
};

export const challengeCoachInfo: Record<string, ChallengeCoachInfo> = Object.fromEntries(
  [routeCoachInfo, vanCoachInfo, billsCoachInfo, bedsCoachInfo, leaksCoachInfo, groceryCoachInfo, floodCoachInfo, trappedCoachInfo].map((c) => [c.id, c]),
);
