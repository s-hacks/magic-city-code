"""Build the data + tests for "Don't Get Trapped 1: Can Help Get In?". Standard library only.

Run from web/:
    python3 scripts/prep_trapped.py

Reads:
    ../data/.cache/overpass_trapped.json   OpenStreetMap: streets, rail level crossings, fire stations and the
                                           Harris Homes outline in east Birmingham (downloaded once if missing)
    ../data/.cache/neighborhoods.geojson   the city's official neighborhoods (for place names)
    public/data/areas.json                 Census ACS block groups (households)
Writes:
    public/data/trapped.json
        graph      {nodes: {id: [lat, lon]}, edges: [[u, v, meters, [[lon, lat], ...]]]}  (streets are two-way)
        crossings  [{id, street, nodes: [corner ids], at: [lat, lon]}]  one per place a street crosses the tracks;
                   a crossing over two or three parallel tracks has one corner per track
        stations   [{node, name}]   real fire stations, on their nearest corner
        tests      [{id, name, visible, start, goal, startName, goalName, blocked, crossings, answer, households, story}]

Streets, crossings, fire stations and household counts are real. Where trains stop is made up: nobody
publishes which crossings are blocked when. The answer for every test is worked out here with a BFS.
"""

import collections
import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
DATA = WEB / "public" / "data"
CACHE = WEB.parent / "data" / ".cache"
RAW = CACHE / "overpass_trapped.json"

# East Birmingham: Oak Ridge Park (Harris Homes), East Birmingham, Kingston, Inglenook's south edge,
# Woodlawn's east side and the tracks running out to Norris Yard.
S, W, N, E = 33.522, -86.775, 33.562, -86.705
ROADS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service"
HARRIS = (33.5392176, -86.7334163)  # Harris Homes (OpenStreetMap)


def download():
    s, w, n, e = 33.505, -86.785, 33.575, -86.690  # a little bigger than the map, so edges are whole
    q = f"""[out:json][timeout:120];
way[highway~"^({ROADS})$"]({s},{w},{n},{e})->.roads;
.roads out body;
node(w.roads);
out skel qt;
node[railway=level_crossing]({s},{w},{n},{e});
out body;
nwr[amenity=fire_station]({s - 0.03},{w - 0.03},{n + 0.03},{e + 0.03});
out center tags;
nwr[name~"Harris Homes"]({s},{w},{n},{e});
out center tags geom;
"""
    for url in ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": "magic-city-code-data-prep/1.0"})
            RAW.write_bytes(urllib.request.urlopen(req, timeout=180).read())
            return
        except Exception as ex:  # try the next mirror
            print("overpass failed:", url, ex)
    raise SystemExit("Could not download OpenStreetMap data.")


def hav(a, b):
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def in_poly(pt, ring):
    x, y = pt
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [p[0] for p in geom["coordinates"]]
    return []


def build():
    CACHE.mkdir(parents=True, exist_ok=True)
    if not RAW.exists():
        download()
    els = json.loads(RAW.read_text())["elements"]
    coords = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node" and "lat" in e}
    inb = lambda n: n in coords and S <= coords[n][0] <= N and W <= coords[n][1] <= E
    xing = {e["id"] for e in els if e["type"] == "node" and e.get("tags", {}).get("railway") == "level_crossing"}

    # Public streets an ambulance can drive. Service roads are left out (driveways, lots, alleys):
    # the real ways in are what matter here. Streets are two-way for this challenge.
    ways = [e for e in els if e["type"] == "way" and e.get("tags", {}).get("highway") and e["tags"]["highway"] != "service"
            and e["tags"].get("access") not in ("private", "no")]
    segs = []
    for w in ways:
        cur = []
        for n in w["nodes"] + [None]:
            if n is not None and inb(n):
                cur.append(n)
            else:
                if len(cur) >= 2:
                    segs.append((w, cur))
                cur = []
    use = collections.Counter()
    for _, ns in segs:
        for i, n in enumerate(ns):
            use[n] += 2 if i in (0, len(ns) - 1) else 1
    kept = {n for n, c in use.items() if c >= 2} | {n for _, ns in segs for n in ns if n in xing}

    edges = {}  # (u, v) sorted -> (meters, geometry between)
    street = {}
    for w, ns in segs:
        prev, m, geo = ns[0], 0.0, []
        for a, b in zip(ns, ns[1:]):
            m += hav(coords[a], coords[b])
            if b in kept:
                if b != prev:
                    k = (prev, b) if prev < b else (b, prev)
                    mid = geo if prev < b else geo[::-1]
                    if k not in edges or m < edges[k][0]:
                        edges[k] = (m, mid)
                prev, m, geo = b, 0.0, []
            else:
                geo.append(b)
        for n in ns:
            if n in xing:
                street[n] = w["tags"].get("name", "an unnamed street")

    adj = collections.defaultdict(set)
    for u, v in edges:
        adj[u].add(v)
        adj[v].add(u)
    # keep the biggest connected piece
    seen, best = set(), []
    for s in list(adj):
        if s in seen:
            continue
        comp, q = [s], [s]
        seen.add(s)
        while q:
            for v in adj[q.pop()]:
                if v not in seen:
                    seen.add(v)
                    q.append(v)
                    comp.append(v)
        if len(comp) > len(best):
            best = comp
    big = set(best)

    # small ids, in a stable order (north to south, west to east)
    order = sorted(big, key=lambda n: (-coords[n][0], coords[n][1]))
    nid = {n: i for i, n in enumerate(order)}
    r5 = lambda x: round(x, 5)
    nodes = {nid[n]: [r5(coords[n][0]), r5(coords[n][1])] for n in order}
    out_edges = []
    graph = collections.defaultdict(list)
    for (u, v), (m, geo) in sorted(edges.items(), key=lambda kv: (nid.get(kv[0][0], -1), nid.get(kv[0][1], -1))):
        if u in big and v in big:
            a, b = nid[u], nid[v]
            out_edges.append([a, b, round(m, 1), [[r5(coords[g][1]), r5(coords[g][0])] for g in geo]])
            graph[a].append(b)
            graph[b].append(a)

    # crossings: the track nodes of one street crossing, grouped (parallel tracks sit a few meters apart)
    groups = []
    for x in sorted(n for n in xing if n in big):
        for g in groups:
            if street[g[0]] == street[x] and min(hav(coords[x], coords[y]) for y in g) < 60:
                g.append(x)
                break
        else:
            groups.append([x])
    groups.sort(key=lambda g: (street[g[0]], -coords[g[0]][0]))
    crossings = []
    seen_street = collections.Counter(street[g[0]] for g in groups)
    k_street = collections.Counter()
    for i, g in enumerate(groups):
        name = street[g[0]]
        k_street[name] += 1
        label = name if seen_street[name] == 1 else f"{name} ({'north' if k_street[name] == 1 else 'south' if k_street[name] == seen_street[name] else 'middle'})"
        lat = sum(coords[n][0] for n in g) / len(g)
        lon = sum(coords[n][1] for n in g) / len(g)
        crossings.append({"id": f"x{i + 1}", "street": label, "nodes": sorted(nid[n] for n in g), "at": [r5(lat), r5(lon)]})
    by_street = {c["street"]: c for c in crossings}

    def nearest(lat, lon, avoid=()):
        return min((n for n in nodes if n not in avoid), key=lambda n: hav(nodes[n], (lat, lon)))

    crossing_nodes = {n for c in crossings for n in c["nodes"]}
    stations = []
    for e in els:
        t = e.get("tags", {})
        if t.get("amenity") != "fire_station" or not t.get("name"):
            continue
        c = e.get("center") or {"lat": e.get("lat"), "lon": e.get("lon")}
        if not (S <= c["lat"] <= N and W <= c["lon"] <= E):
            continue
        name = t["name"].replace("Number ", "")
        if any(s["name"] == name for s in stations):
            continue
        stations.append({"node": nearest(c["lat"], c["lon"], crossing_nodes), "name": name})
    stations.sort(key=lambda s: s["name"])

    def reach(start, blocked):
        if start in blocked:
            return set()
        seen, q = {start}, collections.deque([start])
        while q:
            u = q.popleft()
            for v in graph[u]:
                if v not in seen and v not in blocked:
                    seen.add(v)
                    q.append(v)
        return seen

    # names for places: official neighborhoods; households: the Census block group around the corner
    hoods = json.loads((CACHE / "neighborhoods.geojson").read_text())["features"]
    areas = json.loads((DATA / "areas.json").read_text())

    def hood_of(n):
        lat, lon = nodes[n]
        for f in hoods:
            if any(in_poly((lon, lat), r) for r in rings(f["geometry"])):
                p = f["properties"]
                return (p.get("NAME") or p.get("name") or p.get("Neighborhood") or "").title() or "East Birmingham"
        return "East Birmingham"

    def households_at(n):
        lat, lon = nodes[n]
        for a in areas:
            polys = a["polygon"] if isinstance(a["polygon"][0][0][0], list) else [a["polygon"]]
            if any(in_poly((lon, lat), p[0]) for p in polys):
                return a["households"]
        return None

    def station(name):
        return next(s for s in stations if s["name"] == name)

    st12 = station("Birmingham Fire Station 12")
    harris = nearest(*HARRIS, crossing_nodes)
    brussels = [by_street[k] for k in by_street if k.startswith("Brussels Avenue")]
    assert len(brussels) == 2, [c["street"] for c in crossings]
    all_nodes = sorted(crossing_nodes)

    def blocked_of(cs):
        return sorted({n for c in cs for n in c["nodes"]})

    # Another pocket a train can trap: with every crossing blocked, find small pieces cut off from
    # Station 12 that still have homes, then the crossings that lead into each one.
    main = reach(st12["node"], set(all_nodes))
    pockets = []
    rest = set(nodes) - main - crossing_nodes
    while rest:
        s = rest.pop()
        comp = reach(s, set(all_nodes))
        rest -= comp
        doors = [c for c in crossings if any(v in comp for n in c["nodes"] for v in graph[n])]
        if 6 <= len(comp) <= 400 and harris not in comp:
            pockets.append((comp, doors))
    pockets.sort(key=lambda p: (len(p[1]), -len(p[0])))

    tests = []

    def add(tid, name, visible, start_s, goal, crossings_used, story, goal_name=None):
        blocked = blocked_of(crossings_used)
        ans = goal in reach(start_s["node"], set(blocked))
        tests.append({
            "id": tid, "name": name, "visible": visible,
            "start": start_s["node"], "startName": start_s["name"],
            "goal": goal, "goalName": goal_name or f"a home in {hood_of(goal)}",
            "blocked": blocked, "crossings": [c["id"] for c in crossings_used],
            "answer": ans, "households": households_at(goal), "story": story,
        })
        return ans

    assert add("t1", "Trains on both Brussels Avenue crossings", True, st12, harris, brussels,
               "Two freight trains wait for Norris Yard, one on each Brussels Avenue crossing.", "Harris Homes") is False
    assert add("t2", "One train on Brussels Avenue", True, st12, harris, brussels[:1],
               "One train sits on the north Brussels Avenue crossing. The other one is clear.", "Harris Homes") is True
    assert add("h1", "A morning with no trains", False, st12, harris, [],
               "No trains are stopped anywhere.", "Harris Homes") is True
    assert add("h2", "Every crossing but one blocked", False, st12, harris, [c for c in crossings if c is not brussels[1]],
               "Trains everywhere, but the south Brussels Avenue crossing is clear.", "Harris Homes") is True

    # another neighborhood: cut off, from another station
    comp, doors = pockets[0]
    goal = max(comp, key=lambda n: (households_at(n) or 0, -n))
    other = min((s for s in stations if s is not st12), key=lambda s: hav(nodes[s["node"]], nodes[goal]))
    assert add("h3", f"Trains on every way into part of {hood_of(goal)}", False, other, goal, doors,
               f"Trains stop on {', '.join(c['street'] for c in doors)}.") is False
    # same place, one of its crossings clear
    assert add("h4", f"{hood_of(goal)}, one crossing clear", False, other, goal, doors[1:] or [],
               f"Only {doors[0]['street']} is clear.") is True
    # a long way round: block every crossing on the direct side; the goal is still reachable
    far = max((n for n in main if n not in crossing_nodes), key=lambda n: hav(nodes[n], nodes[st12["node"]]))
    assert add("h5", "Trains on every crossing, home on the station's side", False, st12, far, crossings,
               "Every crossing on the map has a train, but this home is on the fire station's side of the tracks.") is True
    # start == goal
    assert add("h6", "The call comes from the fire station's own corner", False, st12, st12["node"], brussels,
               "The emergency is at the fire station itself.", st12["name"]) is True

    out = {
        "graph": {"nodes": {str(k): v for k, v in nodes.items()}, "edges": out_edges},
        "crossings": crossings,
        "stations": stations,
        "harris": {"node": harris, "name": "Harris Homes", "households": households_at(harris)},
        "tests": tests,
    }
    (DATA / "trapped.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"trapped.json: {len(nodes)} corners, {len(out_edges)} streets, {len(crossings)} crossings, {len(stations)} fire stations")
    for t in tests:
        print(f"  {t['id']} {t['name']!r}: {t['startName']} -> {t['goalName']}, {len(t['crossings'])} trains -> {t['answer']}")


if __name__ == "__main__":
    build()
