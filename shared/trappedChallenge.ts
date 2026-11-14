// "Don't Get Trapped 1: Can Help Get In?": freight trains waiting for Norris Yard stop across
// east Birmingham's streets. With these trains stopped, can an ambulance get from the fire station
// to the home at all? Breadth-first search on real streets, with blocked rail-crossing corners.
// The solution never goes to Claude or students; the coach's leak guard uses it.
import type { ChallengeCoachInfo } from "./challenges";

export const trappedCoachInfo: ChallengeCoachInfo = {
  id: "dont-get-trapped-1",
  title: "Don't Get Trapped 1: Can Help Get In?",
  hiddenTests: "a morning with no trains, trains on every crossing but one, a pocket of another neighborhood cut off by three trains, and a call from the fire station's own corner",
  task: [
    "Write can_reach(graph, start, goal, blocked) for the dispatcher: with these trains stopped, can the ambulance get from the fire station to the home at all?",
    "The map is real east Birmingham streets (Oak Ridge Park, East Birmingham, Kingston) with their real rail crossings. Harris Homes has only two ways in, both over the tracks on Brussels Avenue.",
    "graph[corner] is a list of (neighbor, meters) pairs: the streets leaving that corner. Streets are two-way. start and goal are corner ids (ints).",
    "blocked is a set of corners where a train is stopped. You cannot drive through them.",
    "Return True if there is any way to drive from start to goal, False if not.",
    "Example: graph = {1: [(2, 100)], 2: [(1, 100), (3, 80)], 3: [(2, 80)]}; can_reach(graph, 1, 3, set()) -> True; can_reach(graph, 1, 3, {2}) -> False.",
    "Time limit 3 s per test. The checks, in order: crash, timeout, not True/False, wrong answer.",
  ].join("\n"),
  starterCode: `from collections import deque


def can_reach(graph, start, goal, blocked):
    """Can an ambulance drive from start to goal?

    graph[corner] -> [(neighbor, meters), ...]   the streets leaving a corner
    blocked: a set of corners where a train is stopped (you can't drive through)
    Return True if there is any way from start to goal, else False.
    """
    # Right now: only looks at the streets right next to start.
    for neighbor, meters in graph[start]:
        if neighbor == goal:
            return True
    return start == goal
`,
  solution: `from collections import deque


def can_reach(graph, start, goal, blocked):
    if start == goal:
        return True

    seen = {start}          # corners we have already put in line
    line = deque([start])   # corners waiting to be explored, oldest first

    while line:
        corner = line.popleft()
        for neighbor, meters in graph[corner]:
            if neighbor in blocked or neighbor in seen:
                continue    # a train is there, or we've been there
            if neighbor == goal:
                return True
            seen.add(neighbor)
            line.append(neighbor)

    return False            # explored every corner we could reach: no way in
`,
  hints: [
    "Your code only looks one street away from the fire station. Harris Homes is many streets away. How could you keep going from the corners you just reached, and the corners after those?",
    "Breadth-first search: keep a line (a deque) of corners to explore, and a set of corners you've already seen. Take the oldest corner off the line, look at each neighbor, and add the ones that aren't blocked and aren't seen yet. If you ever reach goal, the answer is True. If the line runs empty first, it's False.",
    "Same idea, different problem: to see if a rumor can spread from Ana to Ben at school, start a line with Ana and a seen set {Ana}. Pop the first person, and for each friend who isn't absent and isn't seen yet, mark them seen and add them to the line. If Ben ever shows up, yes. If the line empties, no. Swap people for corners and absent for blocked.",
  ],
};
