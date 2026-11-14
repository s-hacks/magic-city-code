"""Build the street graph, rail crossings and test cases for the "Don't Get Trapped" challenges.

Run from web/:
    uv run --python 3.12 --with osmnx --with networkx scripts/prep_trains.py

Writes public/data/trains.json:
    nodes, edges     the driving street network around Woodlawn and Harris Homes (two-way, meters)
    crossings        street-level rail crossings (each one is a corner id in the graph)
    homes            {corner: households}, Census block-group households spread over the corners inside
    rail             rail lines, for drawing
    reach/route/underpass   tests for the three levels, with the correct answers from networkx

What is real: streets, rail lines, crossings, fire stations (OpenStreetMap) and household counts (ACS).
What is made up: where trains stop. No public record says which crossings are blocked when.
A "train" here is 1.4 km long, stopped at a crossing, and blocks every crossing it covers.
"""

import itertools
import json
from pathlib import Path

import networkx as nx
import osmnx as ox
from shapely.geometry import Point, Polygon

# Woodlawn, Harris Homes, East Lake edge (west, south, east, north)
BBOX = (-86.775, 33.515, -86.70, 33.565)
TRAIN_HALF_M = 700  # half the train length, measured along the track
NEWS_NAMES = {"Brussels", "Antwerp", "56th", "57th", "59th"}  # crossings named in the Norris Yard coverage
SAME_CROSSING_M = 60  # crossing nodes this close are one crossing (one node per track in OSM)
OUT = Path(__file__).resolve().parent.parent / "public" / "data"
MIRRORS = ["https://overpass-api.de/api", "https://overpass.kumi.systems/api", "https://overpass.private.coffee/api"]
ox.settings.cache_folder = str(Path(__file__).resolve().parent / ".osmnx-cache")
ox.settings.useful_tags_node = ["highway", "junction", "railway", "ref"]
ox.settings.requests_timeout = 90


def overpass(fn, *args, **kw):
    """The public Overpass servers are often busy; try each mirror a few times (responses are cached)."""
    for _ in range(3):
        for url in MIRRORS:
            ox.settings.overpass_url = url
            try:
                return fn(*args, **kw)
            except Exception as e:  # noqa: BLE001
                print(f"  {url} failed: {str(e).splitlines()[0][:90]}")
    raise SystemExit("all Overpass mirrors failed; try again in a minute")


def main():
    print("downloading streets and rail…")
    Gd = overpass(ox.graph_from_bbox, BBOX, network_type="drive", simplify=False)
    Gr = overpass(ox.graph_from_bbox, BBOX, custom_filter='["railway"="rail"]', simplify=False, retain_all=True)
    stations_gdf = overpass(ox.features_from_bbox, BBOX, tags={"amenity": "fire_station"})

    # Keep crossings as corners when simplifying, then make the streets two-way and simple.
    U = ox.convert.to_undirected(ox.simplify_graph(Gd, node_attrs_include=["railway"]))
    S = nx.Graph()
    for u, v, d in U.edges(data=True):
        if u == v or (S.has_edge(u, v) and S[u][v]["w"] <= d["length"]):
            continue
        geom = None
        if "geometry" in d:
            pts = list(d["geometry"].coords)
            if U.nodes[u]["x"] != pts[0][0]:  # orient geometry u -> v
                pts.reverse()
            geom = [[round(x, 5), round(y, 5)] for x, y in pts[1:-1]]
        name = d.get("name")
        S.add_edge(u, v, w=float(d["length"]), geom=geom, name=name if isinstance(name, str) or name is None else name[0])
    S = S.subgraph(max(nx.connected_components(S), key=len)).copy()
    xy = {n: (U.nodes[n]["y"], U.nodes[n]["x"]) for n in S.nodes}

    def meters(a, b):
        return ox.distance.great_circle(*xy[a], *xy[b])

    def street(n):
        names = [d["name"] for _, _, d in S.edges(n, data=True) if d.get("name")]
        # most common street name; on a tie, the name local news uses for the crossing
        return max(sorted(set(names)), key=lambda x: (names.count(x), x.split()[0] in NEWS_NAMES)) if names else "an unnamed street"

    # --- crossings: one per street, however many tracks ------------------------------
    raw_x = [n for n in S.nodes if U.nodes[n].get("railway") == "level_crossing" and n in Gr.nodes]
    P = nx.Graph()
    P.add_nodes_from(raw_x)
    P.add_edges_from((a, b) for a, b in itertools.combinations(raw_x, 2) if meters(a, b) < SAME_CROSSING_M)
    members = {}  # kept corner -> the OSM crossing nodes it stands for
    for group in nx.connected_components(P):
        group = sorted(group)
        keep = group[0]
        members[keep] = group
        for other in group[1:]:
            for nb, d in list(S[other].items()):
                if nb != keep and nb not in group and not (S.has_edge(keep, nb) and S[keep][nb]["w"] <= d["w"]):
                    # the street's shape is flipped if it was stored other -> nb the other way round; redraw straight
                    S.add_edge(keep, nb, w=d["w"] + meters(keep, other), geom=None, name=d["name"])
            S.remove_node(other)
    S = S.subgraph(max(nx.connected_components(S), key=len)).copy()
    members = {k: v for k, v in members.items() if k in S}
    crossing_names = {c: street(c) for c in members}
    for name in set(crossing_names.values()):  # tell same-street crossings apart
        same = sorted((c for c in members if crossing_names[c] == name), key=lambda c: -xy[c][0])
        if len(same) == 2:
            crossing_names[same[0]] += " (north)"
            crossing_names[same[1]] += " (south)"
        elif len(same) > 2:
            for i, c in enumerate(same):
                crossing_names[c] += f" #{i + 1}"

    # --- relabel to small ints -----------------------------------------------------
    ids = {osm: i for i, osm in enumerate(S.nodes)}
    R = nx.relabel_nodes(S, ids)
    nodes = {ids[n]: [round(xy[n][0], 6), round(xy[n][1], 6)] for n in S.nodes}
    edges = [[u, v, round(d["w"], 1)] + ([d["geom"]] if d["geom"] else []) for u, v, d in R.edges(data=True)]
    crossings = sorted(ids[c] for c in members)
    xname = {ids[c]: crossing_names[c] for c in members}
    print(f"graph: {len(nodes)} corners, {len(edges)} streets, {len(crossings)} crossings")

    def near(lat, lon, pool=None):
        return min(pool or nodes, key=lambda n: (nodes[n][0] - lat) ** 2 + (nodes[n][1] - lon) ** 2)

    # --- trains ----------------------------------------------------------------------
    rail = nx.Graph()
    for u, v, d in Gr.edges(data=True):
        rail.add_edge(u, v, w=float(d["length"]))
    rxy = {n: [round(d["x"], 5), round(d["y"], 5)] for n, d in Gr.nodes(data=True)}
    of_osm = {m: ids[c] for c, ms in members.items() for m in ms}

    def train_at(crossing):
        """A train stopped across `crossing`: the crossings it blocks and the track it sits on."""
        blocked, track = set(), set()
        for seed in members[next(c for c in members if ids[c] == crossing)]:
            reach = nx.single_source_dijkstra_path_length(rail, seed, cutoff=TRAIN_HALF_M, weight="w")
            blocked |= {of_osm[n] for n in reach if n in of_osm}
            track |= {(min(a, b), max(a, b)) for a, b in rail.edges(reach) if a in reach and b in reach}
        return {"at": crossing, "name": f"Train stopped on {xname[crossing]}", "blocked": sorted(blocked),
                "track": [[rxy[a], rxy[b]] for a, b in sorted(track)]}

    def scenario(*seeds):
        trains = [train_at(c) for c in seeds]
        return {"trains": trains, "blocked": sorted({b for t in trains for b in t["blocked"]})}

    # --- homes: block-group households spread over the corners inside ------------------
    areas = json.loads((OUT / "areas.json").read_text())
    homes = {}
    for a in areas:
        poly = Polygon(a["polygon"][0])
        inside = [n for n, (lat, lon) in nodes.items() if n not in xname and poly.contains(Point(lon, lat))]
        for n in inside:
            homes[n] = homes.get(n, 0) + a["households"] / len(inside)
    homes = {n: round(h) for n, h in homes.items() if round(h) > 0}
    print(f"homes: {sum(homes.values())} households on {len(homes)} corners (estimate)")

    # --- islands: places whose every way out is a street-level crossing -----------------
    H = R.copy()
    H.remove_nodes_from(crossings)
    comps = sorted(nx.connected_components(H), key=len, reverse=True)
    islands = []
    for comp in comps[1:]:
        gates = sorted(c for c in crossings if any(nb in comp for nb in R.neighbors(c)))
        islands.append({"corners": comp, "gates": gates, "households": sum(homes.get(n, 0) for n in comp)})
    harris_node = near(33.5393, -86.7330)
    harris = next(i for i in islands if harris_node in i["corners"])
    for i in islands:
        tag = "  <- Harris Homes" if i is harris else ""
        print(f"  island: {len(i['corners'])} corners, {i['households']} households, gates: {[xname[g] for g in i['gates']]}{tag}")
    others = sorted((i for i in islands if i is not harris and i["households"] > 0), key=lambda i: len(i["gates"]))

    def home_in(island):
        return max(island["corners"], key=lambda n: homes.get(n, 0))

    def place(island):
        if island is harris:
            return "Harris Homes"
        n = home_in(island)
        names = [d["name"] for _, _, d in R.edges(n, data=True) if d.get("name")]
        return f"a home on {names[0]}" if names else "a home"

    stations = []
    for _, f in stations_gdf[stations_gdf["name"].notna()].iterrows():
        c = f.geometry.centroid
        n = near(c.y, c.x, comps[0])
        if ox.distance.great_circle(c.y, c.x, *nodes[n]) < 250:
            stations.append({"name": f["name"].replace("Birmingham ", ""), "node": n})
    stations.sort(key=lambda s: nx.shortest_path_length(R, s["node"], harris_node, weight="w"))
    print("stations, nearest to Harris Homes first:", [s["name"] for s in stations])
    st1, st2 = stations[0], stations[1]

    def sp(start, goal, blocked=()):
        Hb = R.copy()
        Hb.remove_nodes_from(set(blocked) - {start})
        try:
            path = nx.shortest_path(Hb, start, goal, weight="w")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return {"path": [], "meters": None}
        return {"path": path, "meters": round(nx.path_weight(Hb, path, "w"), 1)}

    gN, gS = sorted(harris["gates"], key=lambda c: -nodes[c][0])[:2]
    clear = sp(st1["node"], harris_node)
    on_clear = next(c for c in clear["path"] if c in (gN, gS))  # the gate the ambulance normally uses
    off_clear = gS if on_clear == gN else gN
    isl2 = others[0]  # fewest gates
    isl3 = others[-1]  # most gates

    def base(tid, name, visible, st, goal, goal_name, sc):
        return {"id": tid, "name": name, "visible": visible, "start": st["node"], "goal": goal, "startName": st["name"],
                "goalName": goal_name, "blocked": sc["blocked"], "trains": sc["trains"]}

    # --- level 1: can help get in? ------------------------------------------------------
    def reach_test(*a):
        t = base(*a)
        t["expected"] = bool(sp(t["start"], t["goal"], t["blocked"])["path"])
        return t

    reach = [
        reach_test("t1", f"One train on Brussels Avenue: {st1['name']} → Harris Homes", True, st1, harris_node, "Harris Homes", scenario(on_clear)),
        reach_test("t2", f"Trains on both Brussels Avenue crossings: {st1['name']} → Harris Homes", True, st1, harris_node, "Harris Homes", scenario(gN, gS)),
        reach_test("h1", "No trains today", False, st1, harris_node, "Harris Homes", scenario()),
        reach_test("h2", f"Every way in is blocked: {place(isl2)}", False, st2, home_in(isl2), place(isl2), scenario(*isl2["gates"])),
        reach_test("h3", f"One way in is still open: {place(isl3)}", False, st1, home_in(isl3), place(isl3), scenario(*isl3["gates"][:-1])),
        reach_test("h4", "A train far from the route", False, st2, harris_node, "Harris Homes", scenario(isl3["gates"][0])),
    ]

    # --- level 2: fastest way around ----------------------------------------------------
    def route_test(*a):
        t = base(*a)
        t["expected"] = sp(t["start"], t["goal"], t["blocked"])
        t["clearMeters"] = sp(t["start"], t["goal"])["meters"]
        return t

    route = [
        route_test("t1", f"Train on the usual way in: {st1['name']} → Harris Homes", True, st1, harris_node, "Harris Homes", scenario(on_clear)),
        route_test("t2", f"A train that is not in the way: {st2['name']} → Harris Homes", True, st2, harris_node, "Harris Homes", scenario(off_clear)),
        route_test("h1", "Both Brussels Avenue crossings blocked", False, st1, harris_node, "Harris Homes", scenario(gN, gS)),
        route_test("h2", "No trains today", False, st2, harris_node, "Harris Homes", scenario()),
        route_test("h3", f"{st1['name']} → {place(isl3)}", False, st1, home_in(isl3), place(isl3), scenario(*isl3["gates"][:-1])),
        route_test("h4", f"Cut off: {place(isl2)}", False, st1, home_in(isl2), place(isl2), scenario(*isl2["gates"])),
    ]

    # --- level 3: one underpass -----------------------------------------------------------
    def trapped(station, blocked):
        Hb = R.copy()
        Hb.remove_nodes_from(blocked)
        ok = nx.node_connected_component(Hb, station)
        return sum(h for n, h in homes.items() if n not in ok)

    def underpass_test(tid, name, visible, st, scs):
        candidates = sorted({b for sc in scs for b in sc["blocked"]})
        scores = {c: sum(trapped(st["node"], set(sc["blocked"]) - {c}) for sc in scs) for c in candidates}
        return {"id": tid, "name": name, "visible": visible, "station": st["node"], "stationName": st["name"],
                "scenarios": scs, "candidates": candidates, "baseline": sum(trapped(st["node"], sc["blocked"]) for sc in scs),
                "scores": scores, "best": min(scores.values())}

    # Norris Yard mornings use only the crossings east of 56th Street, where blockages are reported.
    h_day = scenario(gN, gS)
    near_yard = [i for i in others if all(nodes[g][1] > -86.752 for g in i["gates"])]
    a_day = scenario(*near_yard[0]["gates"])
    both = scenario(gN, gS, *near_yard[0]["gates"])
    everywhere = [scenario(*i["gates"]) for i in [harris, *others]]
    underpass = [
        underpass_test("t1", "Two bad mornings near Norris Yard", True, st1, [h_day, a_day]),
        underpass_test("t2", "A bad week near Norris Yard: 5 mornings", True, st1, [h_day, a_day, both, scenario(gN), scenario(gS)]),
        underpass_test("h1", "A bad week on every rail line in the area", False, st1, everywhere),
        underpass_test("h2", "The same week from another station", False, st2, everywhere),
    ]

    data = {
        "nodes": nodes, "edges": edges,
        "crossings": [{"node": c, "name": xname[c]} for c in crossings],
        "homes": homes, "harris": harris_node,
        "harrisCorners": sorted(harris["corners"]),
        "rail": [[rxy[a], rxy[b]] for a, b in rail.edges],
        "reach": reach, "route": route, "underpass": underpass,
    }
    (OUT / "trains.json").write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote trains.json ({(OUT / 'trains.json').stat().st_size // 1024} KB)")
    for t in reach:
        print(" reach", t["id"], t["name"], "->", t["expected"])
    for t in route:
        print(" route", t["id"], t["name"], "->", t["expected"]["meters"], "m (clear day:", t["clearMeters"], "m)")
    for t in underpass:
        best = [xname[c] for c, s in t["scores"].items() if s == t["best"]]
        print(" underpass", t["id"], t["name"], "| trapped now:", t["baseline"], "| best:", best, "->", t["best"], "| candidates:", len(t["candidates"]))


if __name__ == "__main__":
    main()
