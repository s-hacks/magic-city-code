"""Build the data + test cases for three code challenges. Standard library only, no network.

Run from web/:
    python3 scripts/prep_challenges.py

Reads (already in public/data/):  graph.json (real Downtown + Woodlawn streets), areas.json (Census block groups),
                                  sites.json (real community centers / churches / libraries from OpenStreetMap)
Writes:
    public/data/van_route.json   Stray-dog van route: depot + sample stray reports on real street corners,
                                 street distances, the street path for every pair, and the best possible tour.
    public/data/water_bills.json Water bill check: sample bill histories placed in real block groups,
                                 with the answer for every test.
    public/data/open_bed.json    Open Bed: sample shelters at real community-building locations and
                                 sample people, with the answer for every test.

Everything "sample" here is made up (no real reports, bills or people). The streets, block groups
and building locations are real. A fixed random seed keeps the files the same on every run.
"""

import heapq
import itertools
import json
import math
import random
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"


def haversine(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


# ----------------------------------------------------------------------------------------------
# 1. Stray-dog van route
# ----------------------------------------------------------------------------------------------

def dijkstra(adj, src):
    dist, prev, heap = {src: 0.0}, {}, [(0.0, src)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v], prev[v] = nd, u
                heapq.heappush(heap, (nd, v))
    return dist, prev


def path_to(prev, src, dst):
    p = [dst]
    while p[-1] != src:
        p.append(prev[p[-1]])
    return p[::-1]


def best_tour(D):
    """Exact shortest round trip from place 0 (Held-Karp). Fine for up to ~13 places."""
    n = len(D)
    if n <= 2:
        return list(range(n)) + [0], (2 * D[0][1] if n == 2 else 0)
    full = 1 << (n - 1)
    cost = {(1 << (k - 1), k): (D[0][k], 0) for k in range(1, n)}
    for size in range(2, n):
        for subset in itertools.combinations(range(1, n), size):
            bits = sum(1 << (k - 1) for k in subset)
            for k in subset:
                prev_bits = bits & ~(1 << (k - 1))
                cost[(bits, k)] = min((cost[(prev_bits, m)][0] + D[m][k], m) for m in subset if m != k)
    bits = full - 1
    length, last = min((cost[(bits, k)][0] + D[k][0], k) for k in range(1, n))
    order = []
    while last:
        order.append(last)
        bits, last = bits & ~(1 << (last - 1)), cost[(bits, last)][1]
    return [0] + order[::-1] + [0], length


def tour_len(D, t):
    return sum(D[a][b] for a, b in zip(t, t[1:]))


def nearest_neighbor(D):
    n, t, left = len(D), [0], set(range(1, len(D)))
    while left:
        nxt = min(left, key=lambda k: D[t[-1]][k])
        t.append(nxt)
        left.remove(nxt)
    return t + [0]


def two_opt(D, t):
    t, better = t[:], True
    while better:
        better = False
        for i in range(1, len(t) - 2):
            for j in range(i + 1, len(t) - 1):
                if D[t[i - 1]][t[j]] + D[t[i]][t[j + 1]] < D[t[i - 1]][t[i]] + D[t[j]][t[j + 1]] - 1e-9:
                    t[i : j + 1] = t[i : j + 1][::-1]
                    better = True
    return t


def build_van(rng):
    g = json.loads((DATA / "graph.json").read_text())
    coords = {int(k): v for k, v in g["nodes"].items()}
    adj = {n: [] for n in coords}
    for u, v, w, *_ in g["edges"]:
        adj[u].append((v, w))
        adj[v].append((u, w))

    # Real corners, but only "real" street corners (3+ streets meet) so stops sit on intersections.
    corners = [n for n, a in adj.items() if len(a) >= 3]
    center = (33.5265, -86.7840)  # between Downtown and Woodlawn
    depot = min(corners, key=lambda n: haversine(coords[n], center))

    def stops_near(k, around, radius):
        pool = [n for n in corners if haversine(coords[n], around) < radius and n != depot]
        return rng.sample(pool, k)

    woodlawn, downtown = (33.5420, -86.7490), (33.5170, -86.8080)
    specs = [
        ("t1", "Monday: 6 reports in Woodlawn", True, stops_near(6, woodlawn, 1600)),
        ("t2", "Tuesday: 8 reports, Downtown and Woodlawn", True, stops_near(4, woodlawn, 1500) + stops_near(4, downtown, 1300)),
        ("h1", "Quiet day: no reports yet", False, []),
        ("h2", "One report", False, stops_near(1, woodlawn, 1500)),
        ("h3", "Two reports at the same corner", False, (lambda s: [s[0], s[0], s[1], s[2]])(stops_near(3, downtown, 1200))),
        ("h4", "Busy Friday: 10 reports across the map", False, stops_near(5, woodlawn, 2200) + stops_near(5, downtown, 1800)),
        ("h5", "After a storm: 12 reports", False, stops_near(12, (33.5300, -86.7800), 2600)),
    ]

    STREETS = ["dog seen near the corner", "dog without a collar", "two dogs together", "dog by the school", "dog in the road", "loose puppy"]
    tests, pair_paths = [], {}
    sp_cache = {}
    for tid, name, visible, stop_nodes in specs:
        places = [depot] + stop_nodes
        for p in places:
            if p not in sp_cache:
                sp_cache[p] = dijkstra(adj, p)
        D = [[0.0 if a == b else round(sp_cache[a][0][b], 1) for b in places] for a in places]
        order, length = best_tour(D)
        nn = tour_len(D, nearest_neighbor(D))
        opt2 = tour_len(D, two_opt(D, nearest_neighbor(D)))
        print(f"  {tid}: {len(stop_nodes):2d} stops  best {length:7.0f} m   nearest-neighbor +{(nn / length - 1) * 100 if length else 0:4.1f}%   +2-opt +{(opt2 / length - 1) * 100 if length else 0:4.1f}%")
        for a, b in itertools.combinations(sorted(set(places)), 2):
            if f"{a}-{b}" not in pair_paths:
                pair_paths[f"{a}-{b}"] = path_to(sp_cache[a][1], a, b)
        tests.append({
            "id": tid, "name": name, "visible": visible,
            "places": [{"node": n, "label": "Van depot" if i == 0 else f"Report {i}", "note": "" if i == 0 else rng.choice(STREETS), "reports": 1 if i == 0 else rng.choice([1, 1, 1, 2, 3])} for i, n in enumerate(places)],
            "dist": D, "best": {"order": order, "meters": round(length, 1)},
            "nearestNeighbor": round(nn, 1),
        })
    out = {"depot": depot, "slack": 0.05, "paths": pair_paths, "tests": tests}
    (DATA / "van_route.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote van_route.json ({len(pair_paths)} street paths)")


# ----------------------------------------------------------------------------------------------
# 2. Water bills
# ----------------------------------------------------------------------------------------------

ROUND = [99.99, 179.99, 81.0, 120.0, 64.99, 150.0, 75.0]


def flagged(bills):
    """Reference answer: same amount 3+ months in a row (a missing month breaks the run)."""
    out = []
    for acct, months in bills.items():
        run, last = 0, None
        for m in months:
            run = run + 1 if (m is not None and m == last) else (1 if m is not None else 0)
            last = m
            if run >= 3:
                out.append(acct)
                break
    return sorted(out)


def build_bills(rng):
    areas = [a for a in json.loads((DATA / "areas.json").read_text()) if a["households"] > 0]

    def real_bills():
        base = rng.uniform(38, 120)
        return [round(base * rng.uniform(0.82, 1.22) + (12 if 5 <= i <= 7 else 0), 2) for i in range(12)]

    def estimated(months, start, length, amount):
        months[start : start + length] = [amount] * length
        return months

    accounts, n = {}, 0
    total_hh = sum(a["households"] for a in areas)
    for a in areas:
        k = max(1, round(1800 * a["households"] / total_hh))
        for _ in range(k):
            n += 1
            aid = f"A{n:04d}"
            months = real_bills()
            r = rng.random()
            if r < 0.08:  # estimated: same round-number bill 3-6 months running
                length = rng.randint(3, 6)
                months = estimated(months, rng.randint(0, 12 - length), length, rng.choice(ROUND))
            elif r < 0.12:  # decoy: the same bill only twice in a row
                s = rng.randint(0, 10)
                months = estimated(months, s, 2, rng.choice(ROUND))
            elif r < 0.14:  # decoy: same amount 3 times, but not in a row
                amt = rng.choice(ROUND)
                for i in rng.sample(range(0, 12, 2), 3):
                    months[i] = amt
            elif r < 0.16:  # a month with no bill
                months[rng.randint(0, 11)] = None
            lon, lat = a["center"]
            accounts[aid] = {"area": a["id"], "lat": round(lat + rng.uniform(-0.004, 0.004), 5), "lon": round(lon + rng.uniform(-0.004, 0.004), 5), "bills": months}

    def subset(ids):
        return {i: accounts[i]["bills"] for i in ids}

    east_lake = [i for i, x in accounts.items() if 33.538 < x["lat"] < 33.581 and -86.757 < x["lon"] < -86.717]
    small = {
        "B1": [52.1, 49.8, 61.3, 99.99, 99.99, 99.99, 99.99, 58.2, 50.0, 47.3, 51.9, 55.0],
        "B2": [64.5, 63.0, 70.25, 72.1, 88.0, 91.4, 95.2, 77.0, 66.3, 61.2, 60.0, 62.8],
        "B3": [120.0, 120.0, 118.4, 121.9, 119.3, 120.0, 117.0, 122.5, 116.0, 120.0, 115.7, 121.0],
        "B4": [44.0, 47.2, 45.9, 179.99, 179.99, 51.0, 49.4, 179.99, 179.99, 179.99, 48.8, 50.1],
        "B5": [81.0, 81.0, 81.0, 70.2, 66.0, 74.9, 79.3, 69.9, 72.0, 75.5, 71.1, 68.4],
    }
    edge_cases = {
        "exactly-two": {"E1": [50.0, 75.0, 75.0, 60.0, 61.0, 62.0, 63.0, 64.0, 65.0, 66.0, 67.0, 68.0]},
        "gap": {"E2": [99.99, 99.99, None, 99.99, 99.99, 70.0, 71.0, 72.0, 73.0, 74.0, 75.0, 76.0],
                "E3": [None, None, None, 55.0, 56.0, 57.0, 58.0, 59.0, 60.0, 61.0, 62.0, 63.0]},
        "end-of-year": {"E4": [40.0, 41.0, 42.0, 43.0, 44.0, 45.0, 46.0, 47.0, 48.0, 64.99, 64.99, 64.99]},
    }
    specs = [
        ("t1", "Five neighbors' bills", True, small, None),
        ("t2", f"East Lake: {len(east_lake)} accounts", True, subset(east_lake), east_lake),
        ("h1", "Same bill only 2 months in a row", False, edge_cases["exactly-two"], None),
        ("h2", "A month with no bill breaks the streak", False, edge_cases["gap"], None),
        ("h3", "Streak in the last 3 months", False, edge_cases["end-of-year"], None),
        ("h4", "No accounts at all", False, {}, None),
        ("h5", f"Whole city: {len(accounts):,} accounts", False, subset(list(accounts)), list(accounts)),
    ]
    tests = []
    for tid, name, visible, bills, geo in specs:
        exp = flagged(bills)
        tests.append({"id": tid, "name": name, "visible": visible, "bills": bills, "geo": geo is not None, "expected": exp})
        print(f"  {tid}: {len(bills):5d} accounts, {len(exp):4d} flagged")
    out = {"accounts": {i: {"lat": x["lat"], "lon": x["lon"]} for i, x in accounts.items()}, "tests": tests}
    (DATA / "water_bills.json").write_text(json.dumps(out, separators=(",", ":")))
    print("wrote water_bills.json")


# ----------------------------------------------------------------------------------------------
# 3. Open Bed
# ----------------------------------------------------------------------------------------------

def assign(shelters, people):
    """Reference answer. Highest priority first (ties: who arrived first). Each person gets the
    closest shelter with an open bed of their kind that allows their pet; otherwise None."""
    beds = {s["id"]: dict(s["beds"]) for s in shelters}
    out = {}
    for p in sorted(people, key=lambda p: (-p["priority"], p["arrived"])):
        options = [s for s in shelters if beds[s["id"]].get(p["needs"], 0) > 0 and (s["pets"] or not p["pet"])]
        if not options:
            out[p["id"]] = None
            continue
        best = min(options, key=lambda s: (haversine((p["lat"], p["lon"]), (s["lat"], s["lon"])), s["id"]))
        beds[best["id"]][p["needs"]] -= 1
        out[p["id"]] = best["id"]
    return out


def build_beds(rng):
    sites = json.loads((DATA / "sites.json").read_text())
    downtown = (33.5160, -86.8060)
    near = sorted([s for s in sites if s["kind"] in ("community_center", "church", "library")], key=lambda s: haversine((s["lat"], s["lon"]), downtown))
    picked = []
    for s in near:  # spread shelters out: at least 500 m apart
        if all(haversine((s["lat"], s["lon"]), (q["lat"], q["lon"])) > 500 for q in picked):
            picked.append(s)
        if len(picked) == 6:
            break
    letters = "ABCDEF"
    shelters = []
    for i, s in enumerate(picked):
        shelters.append({
            "id": f"S{letters[i]}", "name": f"Shelter {letters[i]}",
            "lat": round(s["lat"], 5), "lon": round(s["lon"], 5),
            "beds": {"men": rng.randint(2, 6), "women": rng.randint(1, 4), "family": rng.randint(0, 2)},
            "pets": i in (1, 4),
        })

    def person(i, around=downtown, spread=0.02):
        return {
            "id": f"P{i:02d}",
            "needs": rng.choices(["men", "women", "family"], weights=[5, 3, 2])[0],
            "pet": rng.random() < 0.18,
            "priority": rng.randint(1, 10),
            "arrived": i,
            "lat": round(around[0] + rng.uniform(-spread, spread), 5),
            "lon": round(around[1] + rng.uniform(-spread * 1.2, spread * 1.2), 5),
        }

    tiny_shelters = [
        {"id": "SA", "name": "Shelter A", "lat": 33.5180, "lon": -86.8100, "beds": {"men": 1, "women": 1, "family": 0}, "pets": False},
        {"id": "SB", "name": "Shelter B", "lat": 33.5120, "lon": -86.8000, "beds": {"men": 1, "women": 0, "family": 1}, "pets": True},
    ]
    tiny_people = [
        {"id": "P01", "needs": "men", "pet": False, "priority": 4, "arrived": 1, "lat": 33.5175, "lon": -86.8090},
        {"id": "P02", "needs": "men", "pet": False, "priority": 9, "arrived": 2, "lat": 33.5170, "lon": -86.8085},
        {"id": "P03", "needs": "women", "pet": True, "priority": 7, "arrived": 3, "lat": 33.5185, "lon": -86.8105},
        {"id": "P04", "needs": "family", "pet": False, "priority": 6, "arrived": 4, "lat": 33.5130, "lon": -86.8010},
        {"id": "P05", "needs": "men", "pet": False, "priority": 2, "arrived": 5, "lat": 33.5110, "lon": -86.7990},
    ]
    full = [dict(s, beds={"men": 0, "women": 0, "family": 0}) for s in shelters[:3]]
    tie_people = [dict(person(1), needs="men", pet=False, priority=5, arrived=2, id="P01"),
                  dict(person(2), needs="men", pet=False, priority=5, arrived=1, id="P02")]
    one_bed = [dict(shelters[0], beds={"men": 1, "women": 0, "family": 0}, pets=False)]

    specs = [
        ("t1", "Small night: 5 people, 2 shelters", True, tiny_shelters, tiny_people),
        ("t2", "Cold night downtown: 30 people", True, shelters, [person(i) for i in range(1, 31)]),
        ("h1", "Every bed is already taken", False, full, [person(i) for i in range(1, 6)]),
        ("h2", "Same priority: whoever arrived first", False, one_bed, tie_people),
        ("h3", "Freezing night: 60 people", False, shelters, [person(i, spread=0.03) for i in range(1, 61)]),
        ("h4", "Nobody needs a bed tonight", False, shelters, []),
    ]
    tests = []
    for tid, name, visible, sh, ppl in specs:
        exp = assign(sh, ppl)
        housed = sum(1 for v in exp.values() if v)
        tests.append({"id": tid, "name": name, "visible": visible, "shelters": sh, "people": ppl, "expected": exp})
        print(f"  {tid}: {len(ppl):3d} people, {housed:3d} housed")
    (DATA / "open_bed.json").write_text(json.dumps({"tests": tests}, separators=(",", ":")))
    print("wrote open_bed.json")


if __name__ == "__main__":
    print("van route…")
    build_van(random.Random(205))
    print("water bills…")
    build_bills(random.Random(35))
    print("open bed…")
    build_beds(random.Random(400))
