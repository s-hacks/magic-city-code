// Three practice challenges built on real Birmingham problems from the research report:
// stray dogs (the #1 complaint to 311), estimated water bills (a 2026 billing breakdown at
// Central Alabama Water), and full shelters (about 400 people sleep outside on a given night).
// Each has a task, starter code, a working reference solution and three teacher hints.
// The solution never goes to Claude or students; the coach's leak guard uses it.
import type { ChallengeCoachInfo } from "./challenges";

export const vanCoachInfo: ChallengeCoachInfo = {
  id: "stray-dog-van",
  title: "Stray-Dog Van Route",
  hiddenTests: "no reports, one report, two reports at the same corner, and busy days with 10 to 12 reports",
  task: [
    "Write plan_route(dist) to plan one animal-control van's route through today's stray-dog reports on real Birmingham streets (Downtown and Woodlawn).",
    "dist[a][b] is the street distance in meters between place a and place b. Place 0 is the van depot; places 1, 2, ... are the reports.",
    "Return the visiting order as a list [0, ..., 0]: start and end at the depot and visit every report exactly once.",
    "The route must be within 5% of the shortest possible route. Visiting the reports in number order is usually much longer.",
    "Time limit 3 s per test. Hidden tests include no reports, one report, two reports at the same corner, and 10 to 12 reports.",
    "The checks, in order: crash, timeout, wrong return type, not starting/ending at the depot, a report missed or visited twice, a route more than 5% longer than the best.",
  ].join("\n"),
  starterCode: `def plan_route(dist):
    """Plan today's animal-control van route.

    dist[a][b] -> street meters between place a and place b.
    Place 0 is the van depot. Places 1, 2, ... are stray-dog reports.
    Return the visiting order [0, ..., 0], every report exactly once.
    """
    n = len(dist)
    # Right now the van visits reports in the order they came in.
    # Can you find a shorter route?
    return [0] + list(range(1, n)) + [0]
`,
  solution: `def route_length(dist, route):
    return sum(dist[a][b] for a, b in zip(route, route[1:]))


def plan_route(dist):
    n = len(dist)

    # 1. Nearest neighbor: always drive to the closest report not visited yet.
    route = [0]
    left = set(range(1, n))
    while left:
        here = route[-1]
        nxt = min(left, key=lambda p: dist[here][p])
        route.append(nxt)
        left.remove(nxt)
    route.append(0)

    # 2. 2-opt: if flipping a stretch of the route makes it shorter, keep the flip.
    better = True
    while better:
        better = False
        for i in range(1, len(route) - 2):
            for j in range(i + 1, len(route) - 1):
                a, b = route[i - 1], route[i]
                c, d = route[j], route[j + 1]
                if dist[a][c] + dist[b][d] < dist[a][b] + dist[c][d] - 1e-9:
                    route[i:j + 1] = reversed(route[i:j + 1])
                    better = True
    return route
`,
  hints: [
    "Run it and look at the map: where does the van drive back and forth across town? If you were the driver, which report would you go to next from the depot?",
    "A good first idea is 'nearest neighbor': from wherever the van is, drive to the closest report it hasn't visited, until none are left, then go home. That passes the sample cases. For the hidden busy days, look for two legs of the route that cross each other: un-crossing them (reversing the stretch between them) always makes the route shorter. That fix is called 2-opt.",
    "Same idea, different problem: a school bus picks up kids at 5 stops. Start at the school, pick the closest stop not yet visited, repeat, then return. Then try every pair of positions i < j in the stop list: if reversing stops i..j makes the trip shorter, keep it, and repeat until no reversal helps.",
  ],
};

export const billsCoachInfo: ChallengeCoachInfo = {
  id: "water-bill-check",
  title: "Water Bill Check",
  hiddenTests: "a streak of only 2, a streak broken by a missing month, a streak at the end of the year, and the whole city",
  task: [
    "Write flag_estimated(bills) to find water bills that look estimated instead of read from the meter.",
    "bills[account] is a list of 12 monthly amounts in dollars (floats), oldest first. A month is None when no bill was sent.",
    "Return a list of the account ids whose bill was the exact same amount 3 or more months in a row. A None month breaks a streak. Order doesn't matter.",
    "Time limit 3 s per test. Hidden tests include a streak of only 2, a streak broken by a missing month, a streak in the last 3 months, no accounts, and the whole city (about 1,800 accounts).",
    "The checks, in order: crash, timeout, wrong return type, accounts flagged that shouldn't be, accounts missed.",
  ].join("\n"),
  starterCode: `def flag_estimated(bills):
    """Find water bills that look estimated, not read from the meter.

    bills[account] -> 12 monthly amounts in dollars, oldest first.
    A month is None when no bill was sent.
    Return a list of the accounts whose bill was the exact same
    amount 3 or more months in a row.
    """
    flagged = []
    for account, months in bills.items():
        # Tip: walk through the months and keep count of the current streak.
        pass
    return flagged
`,
  solution: `def flag_estimated(bills):
    flagged = []
    for account, months in bills.items():
        streak = 0
        previous = None
        for amount in months:
            if amount is not None and amount == previous:
                streak += 1
            elif amount is not None:
                streak = 1
            else:
                streak = 0
            previous = amount
            if streak >= 3:
                flagged.append(account)
                break
    return flagged
`,
  hints: [
    "Pick one account from the first test and read its 12 bills out loud. Where does the same number repeat? What would you need to remember from the month before to notice it?",
    "Keep two things while you walk through the months: the previous amount and how long the current streak is. Same as last month: the streak grows by 1. Different: it starts over at 1. A None month resets it to 0. Once the streak reaches 3, flag the account and stop looking at it.",
    "Same idea, different problem: find the first time a basketball player made 3 shots in a row. shots = [1, 0, 1, 1, 1, 0]. Keep run = 0; for each shot, if it's a make, run += 1, else run = 0; when run == 3, you've found it. Your bills work the same way, except 'a make' means 'same amount as last month'.",
  ],
};

export const bedsCoachInfo: ChallengeCoachInfo = {
  id: "open-bed",
  title: "Open Bed",
  hiddenTests: "every bed already taken, a priority tie, 60 people, and nobody needing a bed",
  task: [
    "Write assign_beds(shelters, people) to give out tonight's shelter beds fairly. People and shelters are made up; shelters sit at real community buildings in Downtown Birmingham.",
    "shelters: list of dicts with id, name, beds (a dict: men, women, family -> open beds), pets (True/False), lat, lon.",
    "people: list of dicts with id, needs ('men', 'women' or 'family'), pet (True/False), priority (1-10, higher = more urgent), arrived (1, 2, 3...), lat, lon.",
    "Rules: help people in order of priority, highest first; same priority, whoever arrived first. Each person gets the closest shelter (city.distance(person, shelter)) that still has an open bed of the kind they need and allows pets if they have one. If none fits, they go on the waitlist: None.",
    "Return a dict {person id: shelter id or None} with every person in it.",
    "Time limit 3 s per test. Hidden tests include every bed already taken, a priority tie, 60 people, and nobody needing a bed.",
    "The checks, in order: crash, timeout, wrong return type, a person left out, a person given the wrong shelter.",
  ].join("\n"),
  starterCode: `import city


def assign_beds(shelters, people):
    """Give out tonight's shelter beds.

    shelters: [{"id", "name", "beds": {"men": 3, "women": 2, "family": 1},
                "pets": True/False, "lat", "lon"}, ...]
    people:   [{"id", "needs": "men" | "women" | "family", "pet": True/False,
                "priority": 1-10, "arrived": 1, 2, 3..., "lat", "lon"}, ...]

    Rules:
    1. Highest priority first. Same priority: whoever arrived first.
    2. Each person gets the CLOSEST shelter that still has a bed of the
       kind they need (and allows pets, if they have a pet).
       city.distance(person, shelter) gives meters.
    3. If nothing fits: None (the waitlist).

    Return {person id: shelter id or None} for every person.
    """
    result = {}
    for person in people:
        result[person["id"]] = None
    return result
`,
  solution: `import city


def assign_beds(shelters, people):
    open_beds = {s["id"]: dict(s["beds"]) for s in shelters}
    order = sorted(people, key=lambda p: (-p["priority"], p["arrived"]))
    result = {}
    for person in order:
        fits = [s for s in shelters
                if open_beds[s["id"]].get(person["needs"], 0) > 0
                and (s["pets"] or not person["pet"])]
        if not fits:
            result[person["id"]] = None
            continue
        best = min(fits, key=lambda s: city.distance(person, s))
        open_beds[best["id"]][person["needs"]] -= 1
        result[person["id"]] = best["id"]
    return result
`,
  hints: [
    "Who should get a bed first tonight? Look at the order your loop visits people in, and compare it with rule 1.",
    "Three pieces: (1) sort people by priority, highest first, breaking ties by arrival (sorted with a key that returns a tuple). (2) Keep your own dictionary of open beds per shelter, and subtract one each time you give a bed, so a shelter can fill up. (3) For each person, keep only the shelters that fit (bed type and pets), then pick the one with the smallest city.distance.",
    "Same idea, different problem: seating students for lunch. Sort students by grade, highest first (key=lambda s: (-s['grade'], s['name'])). Keep seats_left = {'table1': 4, 'table2': 2}. For each student, list the tables with seats_left > 0, choose the nearest with min(tables, key=...), and do seats_left[table] -= 1.",
  ],
};
