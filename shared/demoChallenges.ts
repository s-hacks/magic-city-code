// Three bigger, map-heavy challenges for the demo, each built on a top problem from the research
// report: a water system losing over half its water (Stop the Leaks), food deserts citywide
// (Grocery Gap), and streets that flood at railroad underpasses (Flood Cut-Off).
// Each has a task, starter code, a working reference solution and three teacher hints.
// The solution never goes to Claude or students; the coach's leak guard uses it.
import type { ChallengeCoachInfo } from "./challenges";

export const leaksCoachInfo: ChallengeCoachInfo = {
  id: "stop-the-leaks",
  title: "Stop the Leaks",
  hiddenTests: "no leaks, one leak with three crews, a far main break against a nearby leak, and a hard freeze with 18 leaks and 3 crews",
  task: [
    "Write plan_crews(leaks, crews, depot) to plan the water-main repair crews' day so the least water is lost.",
    "leaks: list of dicts with id, lat, lon, gallons_per_hour, repair_hours. crews: how many crews. depot: dict with lat, lon where every crew starts.",
    "city.drive_hours(a, b) gives the hours to drive between two things with lat and lon.",
    "Each leak pours out gallons_per_hour until its crew finishes repairing it. A crew drives to a leak, repairs it, then drives to its next one.",
    "Return one list of leak ids per crew (crews lists in total), each leak exactly once. Score: total gallons lost. It must be within 2.5% of the best schedule known.",
    "Time limit 3 s per test. The checks, in order: crash, timeout, wrong return type, wrong number of crew lists, a leak missing or fixed twice, too much water lost.",
  ].join("\n"),
  starterCode: `import city


def plan_crews(leaks, crews, depot):
    """Plan the repair crews' day.

    leaks: [{"id", "lat", "lon", "gallons_per_hour", "repair_hours"}, ...]
    crews: how many crews are working
    depot: {"id", "name", "lat", "lon"}, where every crew starts
    city.drive_hours(a, b) -> hours to drive from a to b

    Water pours out of every leak until its crew finishes the repair.
    Return one list of leak ids per crew, in the order that crew
    fixes them, so the least water is lost in total.
    """
    plans = [[] for _ in range(crews)]
    # Right now: deal the leaks out in the order they were reported.
    for i, leak in enumerate(leaks):
        plans[i % crews].append(leak["id"])
    return plans
`,
  solution: `import city


def plan_crews(leaks, crews, depot):
    plans = [[] for _ in range(crews)]
    free_at = [0.0] * crews   # the hour each crew finishes its current job
    where = [depot] * crews   # where each crew is
    waiting = list(leaks)

    while waiting:
        # The crew that's free first takes the next job.
        c = min(range(crews), key=lambda i: free_at[i])
        here = where[c]

        # Best job: the most gallons stopped per hour of work (drive + repair).
        def value(leak):
            return leak["gallons_per_hour"] / (city.drive_hours(here, leak) + leak["repair_hours"])

        job = max(waiting, key=value)
        waiting.remove(job)
        plans[c].append(job["id"])
        free_at[c] += city.drive_hours(here, job) + job["repair_hours"]
        where[c] = job

    return plans
`,
  hints: [
    "Press Run and watch the counter: which leaks keep pouring while a crew is busy with a small one across town? If you were dispatching, which job would you send a free crew to?",
    "Think about it as a dispatcher: whenever a crew is free (the crew that finishes first), pick its next leak. 'Biggest leak first' is close but ignores time: a huge break 40 minutes away can be worse than a big leak next door. Score each waiting leak by gallons_per_hour divided by (drive hours + repair hours) from where that crew is now, and take the best.",
    "Same idea, different problem: you have homework from 3 classes, each with points and hours. To get the most points earliest, do the one with the most points per hour first: max(tasks, key=lambda t: t['points'] / t['hours']). With two people sharing the list, whoever finishes first takes the next best task.",
  ],
};

export const groceryCoachInfo: ChallengeCoachInfo = {
  id: "grocery-gap",
  title: "Grocery Gap",
  hiddenTests: "no stores this year, a west-side-only budget, and five new stores citywide",
  task: [
    "Write pick_sites(areas, stores, sites, k) to choose k sites for new grocery stores across all of Birmingham.",
    "areas: real Census block groups as dicts with id, lat, lon, households, no_car (households with no car), neighborhood. stores: grocery stores open today (id, name, lat, lon). sites: places a store could go (id, name, kind, lat, lon).",
    "A block group is served if its center is within RADIUS (1,609 m, one mile) of a store. city.distance(a, b) gives meters.",
    "Goal: the most no_car households in block groups that are NOT served today but WOULD be served by one of your new stores. Return a list of k different site ids.",
    "It must reach at least 95% of the best possible. Picking the k sites that look best on their own fails, because nearby sites reach the same families.",
    "Time limit 3 s per test. The checks, in order: crash, timeout, wrong return type, wrong number of sites, an unknown or repeated site, not enough families reached.",
  ].join("\n"),
  starterCode: `import city

RADIUS = 1609  # one mile, in meters


def pick_sites(areas, stores, sites, k):
    """Choose k sites for new grocery stores.

    areas:  [{"id", "lat", "lon", "households", "no_car", "neighborhood"}, ...]
    stores: [{"id", "name", "lat", "lon"}, ...]   open today
    sites:  [{"id", "name", "kind", "lat", "lon"}, ...]   where a store could go
    city.distance(a, b) -> meters

    An area is served if its center is within RADIUS of a store.
    Reach the most no_car households in areas that aren't served
    today but would be served by one of your new stores.
    Return a list of k site ids.
    """
    # Right now: the first k sites in the list. Can you do better?
    return [site["id"] for site in sites[:k]]
`,
  solution: `import city

RADIUS = 1609  # one mile, in meters


def near(a, b):
    return city.distance(a, b) <= RADIUS


def pick_sites(areas, stores, sites, k):
    # Only areas with no store within a mile today count.
    waiting = [a for a in areas if not any(near(a, s) for s in stores)]
    picks = []

    for _ in range(k):
        # Greedy: the site that reaches the most NEW families right now.
        best, best_gain = None, -1
        for site in sites:
            if site["id"] in picks:
                continue
            gain = sum(a["no_car"] for a in waiting if near(a, site))
            if gain > best_gain:
                best, best_gain = site, gain
        picks.append(best["id"])
        # Those families are served now; don't count them twice.
        waiting = [a for a in waiting if not near(a, best)]

    return picks
`,
  hints: [
    "Run sample case 2 and look at where your three stores land. Do their circles overlap? A family that two stores can reach only counts once.",
    "First find the areas that have no store within a mile today. Then pick one site at a time: for each site, add up no_car for the waiting areas within RADIUS of it, and take the site with the biggest total. Before picking the next site, remove the areas that site now serves, so the next pick goes where the families still are.",
    "Same idea, different problem: picking 2 ice-cream trucks for a park. Truck spot A reaches kids at swings and slide, spot B reaches swings and slide too, spot C reaches the field. Picking A then B wastes B. Pick A, cross off swings and slide, then the best spot for the kids who are left is C.",
  ],
};

export const floodCoachInfo: ChallengeCoachInfo = {
  id: "flood-cutoff",
  title: "Flood Cut-Off",
  hiddenTests: "one shelter in a flood, two shelters on the same corner, no shelters, and a storm that cuts some corners off completely",
  task: [
    "Write walk_times(graph, shelters) to find how far every street corner in Downtown and Woodlawn is from the closest open storm shelter, on real Birmingham streets.",
    "graph[corner] is a list of (neighbor, meters) pairs. Flooded streets (railroad underpasses) are already removed from graph. shelters is a list of corner ids.",
    "Return a dict {corner: meters to the closest shelter} for every corner someone could walk from. Leave out corners that can't reach any shelter.",
    "Time limit 3 s per test. Hidden tests include one shelter in a flood, two shelters at the same corner, no shelters, and a storm that cuts corners off.",
    "The checks, in order: crash, timeout, wrong return type, a reachable corner missing, a cut-off corner given a time, a distance that is too long, a distance that is too short.",
  ].join("\n"),
  starterCode: `import heapq


def walk_times(graph, shelters):
    """How far is every street corner from the closest open shelter?

    graph[corner] -> [(neighbor, meters), ...]  (flooded streets removed)
    shelters -> list of corner ids where a shelter is open
    Return {corner: meters to the closest shelter} for every corner
    that can reach one. Leave out corners that are cut off.
    """
    times = {}
    for s in shelters:
        times[s] = 0
    # Tip: Dijkstra, but start with EVERY shelter already in the heap.
    return times
`,
  solution: `import heapq


def walk_times(graph, shelters):
    best = {}
    heap = []
    for s in shelters:
        heapq.heappush(heap, (0, s))

    while heap:
        dist, corner = heapq.heappop(heap)
        if corner in best:
            continue
        best[corner] = dist
        for neighbor, meters in graph[corner]:
            if neighbor not in best:
                heapq.heappush(heap, (dist + meters, neighbor))

    return best
`,
  hints: [
    "Run it and look at the map: only the shelters themselves have a time. What would you need to do to spread out from a shelter, street by street?",
    "This is Dijkstra's algorithm with one twist: instead of starting from one corner, put every shelter in the heap at distance 0. Pop the closest corner, skip it if you already have its time, record it, and push each neighbor with dist + meters. Corners you never reach are cut off, so they just don't appear.",
    "Same idea, different problem: a fire spreads from several campfires at once. Put every campfire in a heap at time 0. Each time you pop the earliest-burning spot, record its time and push its neighbors with time + how long the fire takes to reach them. Each spot's recorded time is when the closest fire got there.",
  ],
};
