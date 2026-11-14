"""Build the data + tests for three bigger, map-heavy challenges. Standard library only, no network.

Run from web/:
    python3 scripts/prep_demo_challenges.py

Writes:
    public/data/flood_reach.json  Flood Cut-Off: storm shelters (real schools on the street graph) and the
                                  tests. Expected distances are computed in the browser (Dijkstra in JS).
    public/data/grocery_gap.json  Grocery Gap: real Census block groups, real grocery stores, real candidate
                                  sites, and the best possible coverage for each test (exact search).
    public/data/leak_crews.json   Stop the Leaks: sample water-main leaks placed in real block groups, and the
                                  best schedule found by a long local search for each test.

Leaks are made up; streets, block groups, stores and building locations are real. Fixed seeds.
"""

import heapq
import itertools
import json
import math
import random
from pathlib import Path

from prep_challenges import haversine

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
MILE = 1609.34


# ----------------------------------------------------------------------------------------------
# 1. Flood Cut-Off
# ----------------------------------------------------------------------------------------------

def build_flood(rng):
    g = json.loads((DATA / "graph.json").read_text())
    rt = json.loads((DATA / "route_tests.json").read_text())
    coords = {int(k): v for k, v in g["nodes"].items()}
    schools = [p for p in rt["places"] if p["kind"] == "school"]

    # spread out: farthest-point picks
    picked = [schools[0]]
    while len(picked) < 5:
        picked.append(max(schools, key=lambda s: min(haversine(coords[s["node"]], coords[q["node"]]) for q in picked)))

    adj = {n: [] for n in coords}
    for u, v, w, *_ in g["edges"]:
        adj[u].append((v, w))
        adj[v].append((u, w))

    def reach(sources, closed):
        cl = {(a, b) for a, b in closed} | {(b, a) for a, b in closed}
        dist, heap = {}, [(0.0, s) for s in sources]
        while heap:
            d, u = heapq.heappop(heap)
            if u in dist:
                continue
            dist[u] = d
            for v, w in adj[u]:
                if (u, v) not in cl and v not in dist:
                    heapq.heappush(heap, (d + w, v))
        return dist

    flood = rt["flood"]["closed"]
    # A heavier storm: the 3 real underpasses plus the street segments right next to them.
    near = set()
    for a, b in flood:
        for n in (a, b):
            for v, _ in adj[n]:
                near.add(tuple(sorted((n, v))))
    storm = sorted({tuple(sorted(e)) for e in flood} | near)

    S = [s["node"] for s in picked]
    specs = [
        ("t1", "Dry day: 5 storm shelters", True, picked, []),
        ("t2", "Heavy rain: 3 railroad underpasses flooded", True, picked, flood),
        ("h1", "Only one shelter open", False, picked[:1], flood),
        ("h2", "Two shelters at the same corner", False, [picked[1], picked[1], picked[3]], []),
        ("h3", "No shelters open", False, [], []),
        ("h4", "Storm: underpasses and the streets beside them", False, picked[:3], storm),
    ]
    tests = []
    for tid, name, visible, shelters, closed in specs:
        d = reach([s["node"] for s in shelters], closed)
        far = sum(1 for x in d.values() if x > 1600)
        print(f"  {tid}: {len(shelters)} shelters, {len(closed):2d} closed, {len(d):5d} reachable, {len(coords) - len(d):5d} cut off, {far:5d} over 20 min")
        tests.append({"id": tid, "name": name, "visible": visible, "shelters": [{"node": s["node"], "name": s["name"]} for s in shelters], "closed": [list(e) for e in closed]})
    (DATA / "flood_reach.json").write_text(json.dumps({"walkLimit": 1600, "tests": tests}, separators=(",", ":")))
    print("wrote flood_reach.json")
    return S


# ----------------------------------------------------------------------------------------------
# 2. Grocery Gap
# ----------------------------------------------------------------------------------------------

def coverage_sets(areas, stores, sites):
    """For each candidate site, which areas (not already near a store) it would bring within a mile."""
    unmet = [i for i, a in enumerate(areas) if not any(haversine((a["lat"], a["lon"]), (s["lat"], s["lon"])) <= MILE for s in stores)]
    cov = {s["id"]: frozenset(i for i in unmet if haversine((areas[i]["lat"], areas[i]["lon"]), (s["lat"], s["lon"])) <= MILE) for s in sites}
    return unmet, cov


def score(areas, cov, picks):
    covered = set().union(*(cov[p] for p in picks)) if picks else set()
    return sum(areas[i]["no_car"] for i in covered)


def best_pick(areas, cov, sites, k):
    ids = [s["id"] for s in sites]
    best = (-1, [])
    for combo in itertools.combinations(ids, k):
        sc = score(areas, cov, combo)
        if sc > best[0]:
            best = (sc, list(combo))
    return best


def greedy(areas, cov, sites, k):
    picks = []
    for _ in range(k):
        cand = [s["id"] for s in sites if s["id"] not in picks]
        if not cand:
            break
        picks.append(max(cand, key=lambda c: (score(areas, cov, picks + [c]), c)))
    return picks


def top_individual(areas, cov, sites, k):
    return sorted((s["id"] for s in sites), key=lambda c: -score(areas, cov, [c]))[:k]


def build_grocery(rng):
    raw_areas = json.loads((DATA / "areas.json").read_text())
    stores = json.loads((DATA / "stores.json").read_text())
    sites = json.loads((DATA / "sites.json").read_text())
    former = json.loads((DATA / "former_stores.json").read_text())

    areas = [{"id": a["id"], "lat": a["center"][1], "lon": a["center"][0], "households": a["households"], "no_car": a["households_no_car"], "neighborhood": a["neighborhood"]} for a in raw_areas if a["households"] > 0]
    stores_s = [{"id": s["id"], "name": s["name"], "lat": s["lat"], "lon": s["lon"]} for s in stores]

    # candidates: the empty Save-A-Lot, every library and community center, and the churches
    # that would help the most (so nearby candidates overlap, which is the point)
    pool = [{"id": f["id"], "name": f"Empty {f['name']} building", "kind": "former_store", "lat": f["lat"], "lon": f["lon"]} for f in former]
    pool += [{"id": s["id"], "name": s["name"], "kind": s["kind"], "lat": s["lat"], "lon": s["lon"]} for s in sites if s["kind"] in ("library", "community_center")]
    _, cov_all = coverage_sets(areas, stores_s, [{"id": s["id"], "lat": s["lat"], "lon": s["lon"]} for s in sites if s["kind"] == "church"])
    churches = sorted((s for s in sites if s["kind"] == "church"), key=lambda s: -score(areas, cov_all, [s["id"]]))[:14]
    pool += [{"id": s["id"], "name": s["name"], "kind": s["kind"], "lat": s["lat"], "lon": s["lon"]} for s in churches]
    unmet, cov = coverage_sets(areas, stores_s, pool)
    pool = [s for s in pool if cov[s["id"]]]  # drop sites that would help nobody
    print(f"  {len(areas)} block groups, {len(unmet)} more than a mile from a store, {len(pool)} candidate sites")

    west = [a for a in areas if a["lon"] < -86.845]
    west_sites = [s for s in pool if s["lon"] < -86.845]
    specs = [
        ("t1", "One new store, citywide", True, areas, pool, 1),
        ("t2", "Three new stores, citywide", True, areas, pool, 3),
        ("h1", "No money for a store this year", False, areas, pool, 0),
        ("h2", "West side only: two stores", False, west, west_sites, 2),
        ("h3", "Five new stores, citywide", False, areas, pool, 5),
    ]
    tests = []
    for tid, name, visible, ar, si, k in specs:
        _, c = coverage_sets(ar, stores_s, si)
        bscore, bpicks = best_pick(ar, c, si, k)
        g = score(ar, c, greedy(ar, c, si, k))
        ti = score(ar, c, top_individual(ar, c, si, k))
        print(f"  {tid}: k={k} sites={len(si):2d} best {bscore:5d}  greedy {g / bscore * 100 if bscore else 100:5.1f}%  top-k-alone {ti / bscore * 100 if bscore else 100:5.1f}%")
        tests.append({"id": tid, "name": name, "visible": visible, "k": k, "areas": [a["id"] for a in ar], "sites": [s["id"] for s in si], "best": {"score": bscore, "picks": bpicks}})
    out = {"radius": MILE, "areas": areas, "stores": stores_s, "sites": pool, "tests": tests}
    (DATA / "grocery_gap.json").write_text(json.dumps(dict(out, minShare=0.95), separators=(",", ":")))
    print("wrote grocery_gap.json")


# ----------------------------------------------------------------------------------------------
# 3. Stop the Leaks
# ----------------------------------------------------------------------------------------------

SPEED = 25_000  # meters per hour, city driving
DETOUR = 1.3  # streets are longer than a straight line


def drive_hours(a, b):
    return haversine((a["lat"], a["lon"]), (b["lat"], b["lon"])) * DETOUR / SPEED


def total_loss(leaks, depot, plan):
    """Gallons lost before each leak is fixed: rate x (hours until the repair is done)."""
    by = {l["id"]: l for l in leaks}
    lost = 0.0
    for route in plan:
        t, here = 0.0, depot
        for lid in route:
            leak = by[lid]
            t += drive_hours(here, leak) + leak["repair_hours"]
            lost += leak["gallons_per_hour"] * t
            here = leak
    return lost


def dispatch(leaks, crews, depot, key):
    """Greedy: whenever a crew is free, send it to the waiting leak with the best key."""
    free = [(0.0, i, depot) for i in range(crews)]
    plan = [[] for _ in range(crews)]
    left = list(leaks)
    while left:
        free.sort(key=lambda f: (f[0], f[1]))
        t, i, here = free.pop(0)
        leak = max(left, key=lambda l: key(l, here))
        left.remove(leak)
        plan[i].append(leak["id"])
        free.append((t + drive_hours(here, leak) + leak["repair_hours"], i, leak))
    return plan


def ratio_key(l, here):
    return l["gallons_per_hour"] / (drive_hours(here, l) + l["repair_hours"])


def improve(leaks, depot, plan, rng, rounds=4000):
    """Local search: move one leak to any position on any crew, keep it if less water is lost."""
    best, best_loss = [r[:] for r in plan], total_loss(leaks, depot, plan)
    better = True
    while better:
        better = False
        for ci, r in enumerate(best):
            for pi in range(len(r)):
                lid = r[pi]
                for cj in range(len(best)):
                    for pj in range(len(best[cj]) + (0 if ci == cj else 1)):
                        cand = [x[:] for x in best]
                        cand[ci].pop(pi)
                        cand[cj].insert(pj, lid)
                        loss = total_loss(leaks, depot, cand)
                        if loss < best_loss - 1e-6:
                            best, best_loss, better = cand, loss, True
                            break
                    if better:
                        break
                if better:
                    break
            if better:
                break
    return best, best_loss


def best_schedule(leaks, crews, depot, rng):
    starts = [dispatch(leaks, crews, depot, ratio_key), dispatch(leaks, crews, depot, lambda l, h: l["gallons_per_hour"])]
    for _ in range(25):
        ids = [l["id"] for l in leaks]
        rng.shuffle(ids)
        starts.append([ids[i::crews] for i in range(crews)])
    best = (math.inf, None)
    for s in starts:
        p, loss = improve(leaks, depot, s, rng)
        if loss < best[0]:
            best = (loss, p)
    return best


def build_leaks(rng):
    raw = [a for a in json.loads((DATA / "areas.json").read_text()) if a["households"] > 0]
    depot = {"id": "yard", "name": "Crew yard", "lat": 33.5186, "lon": -86.8104}

    n_leak = 0

    def leak(main_break=False, area=None):
        nonlocal n_leak
        n_leak += 1
        a = area or rng.choice(raw)
        if main_break:
            rate, hours = rng.randint(15, 30) * 1000, round(rng.uniform(6, 9), 1)
        else:
            rate, hours = rng.choice([150, 250, 400, 600, 900, 1500, 2500, 4000]), round(rng.uniform(1, 5), 1)
        return {"id": f"L{n_leak:02d}", "lat": round(a["center"][1] + rng.uniform(-0.003, 0.003), 5), "lon": round(a["center"][0] + rng.uniform(-0.003, 0.003), 5), "gallons_per_hour": rate, "repair_hours": hours}

    def batch(k, breaks=0):
        nonlocal n_leak
        n_leak = 0
        ls = [leak() for _ in range(k - breaks)] + [leak(True) for _ in range(breaks)]
        rng.shuffle(ls)
        for i, l in enumerate(ls):  # number them in report order
            l["id"] = f"L{i + 1:02d}"
        return ls

    far = max(raw, key=lambda a: haversine((a["center"][1], a["center"][0]), (depot["lat"], depot["lon"])))
    near = min(raw, key=lambda a: haversine((a["center"][1], a["center"][0]), (depot["lat"], depot["lon"])))
    n_leak = 0
    tradeoff = [dict(leak(True, far), id="L01"), dict(leak(False, near), id="L02", gallons_per_hour=4000, repair_hours=1.0)] + [dict(l, id=f"L{i + 3:02d}") for i, l in enumerate(batch(4))]

    specs = [
        ("t1", "Monday: 6 leaks, 1 crew", True, batch(6, 1), 1),
        ("t2", "After a freeze: 12 leaks, 2 crews", True, batch(12, 2), 2),
        ("h1", "No leaks reported", False, [], 2),
        ("h2", "One leak, three crews", False, batch(1), 3),
        ("h3", "Far main break vs. a nearby leak", False, tradeoff, 1),
        ("h4", "Hard freeze: 18 leaks, 3 crews", False, batch(18, 3), 3),
    ]
    tests = []
    for tid, name, visible, ls, crews in specs:
        loss, plan = best_schedule(ls, crews, depot, rng) if ls else (0.0, [[] for _ in range(crews)])
        naive = total_loss(ls, depot, [[l["id"] for l in ls][i::crews] for i in range(crews)])
        biggest = total_loss(ls, depot, dispatch(ls, crews, depot, lambda l, h: l["gallons_per_hour"]))
        ratio = total_loss(ls, depot, dispatch(ls, crews, depot, ratio_key))
        pct = lambda x: f"{(x / loss - 1) * 100 if loss else 0:6.1f}%"
        print(f"  {tid}: {len(ls):2d} leaks {crews} crews  best {loss / 1e6:6.2f}M gal  report-order +{pct(naive)}  biggest-first +{pct(biggest)}  ratio +{pct(ratio)}")
        tests.append({"id": tid, "name": name, "visible": visible, "crews": crews, "leaks": ls, "best": {"gallons": round(loss), "plan": plan}})
    out = {"depot": depot, "speed": SPEED, "detour": DETOUR, "slack": 0.025, "tests": tests}
    return out


if __name__ == "__main__":
    print("flood cut-off…")
    build_flood(random.Random(7))
    print("grocery gap…")
    build_grocery(random.Random(64))
    print("stop the leaks…")
    leaks = build_leaks(random.Random(53))
    (DATA / "leak_crews.json").write_text(json.dumps(leaks, separators=(",", ":")))
    print("wrote leak_crews.json ")
