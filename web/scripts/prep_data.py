"""Build the street graph + test cases for the "Route to Fresh Food" challenge.

Run from web/:
    uv run --python 3.12 --with osmnx --with networkx scripts/prep_data.py

Writes:
    public/data/graph.json        {nodes: {id: [lat, lon]}, edges: [[u, v, meters, geom?]]}
    public/data/route_tests.json  places + tests with the correct shortest paths
"""

import json
from pathlib import Path

import networkx as nx
import osmnx as ox

# Downtown Birmingham + Woodlawn (west, south, east, north)
BBOX = (-86.8240, 33.5040, -86.7420, 33.5520)
OUT = Path(__file__).resolve().parent.parent / "public" / "data"
MIRRORS = ["https://overpass-api.de/api", "https://overpass.kumi.systems/api", "https://overpass.private.coffee/api"]
ox.settings.cache_folder = str(Path(__file__).resolve().parent / ".osmnx-cache")


def overpass(fn, *args, **kw):
    """The public Overpass servers are often busy; try each mirror (responses are cached)."""
    for url in MIRRORS:
        ox.settings.overpass_url = url
        try:
            return fn(*args, **kw)
        except Exception as e:  # noqa: BLE001
            print(f"  {url} failed: {str(e).splitlines()[0][:90]}")
    raise SystemExit("all Overpass mirrors failed; try again in a minute")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("downloading walk network…")
    G = overpass(ox.graph_from_bbox, BBOX, network_type="walk", simplify=True)
    U = ox.convert.to_undirected(G)

    # Collapse the multigraph into a simple graph, keeping the shortest parallel edge.
    S = nx.Graph()
    for u, v, d in U.edges(data=True):
        if u == v:
            continue
        w = float(d["length"])
        if S.has_edge(u, v) and S[u][v]["w"] <= w:
            continue
        geom = None
        if "geometry" in d:
            pts = list(d["geometry"].coords)
            if U.nodes[u]["x"] != pts[0][0]:  # orient geometry u -> v
                pts.reverse()
            geom = [[round(x, 5), round(y, 5)] for x, y in pts[1:-1]]
        S.add_edge(u, v, w=w, geom=geom, name=d.get("name"))
    S = S.subgraph(max(nx.connected_components(S), key=len)).copy()

    ids = {osm: i for i, osm in enumerate(S.nodes)}
    nodes = {ids[n]: [round(U.nodes[n]["y"], 6), round(U.nodes[n]["x"], 6)] for n in S.nodes}
    edges = []
    for u, v, d in S.edges(data=True):
        e = [ids[u], ids[v], round(d["w"], 1)]
        if d["geom"]:
            e.append(d["geom"])
        edges.append(e)
    R = nx.relabel_nodes(S, ids)
    (OUT / "graph.json").write_text(json.dumps({"nodes": nodes, "edges": edges}, separators=(",", ":")))
    print(f"graph: {len(nodes)} nodes, {len(edges)} edges")

    # --- start / goal places --------------------------------------------------
    feats = overpass(ox.features_from_bbox, BBOX, tags={"shop": ["supermarket", "grocery", "greengrocer"], "amenity": "school"})
    feats = feats[feats["name"].notna()]
    places, seen = [], set()
    for _, f in feats.iterrows():
        c = f.geometry.centroid
        if f["name"] in seen:
            continue
        # nearest node in the kept graph (plain scan; avoids the scikit-learn dependency)
        osm = min(S.nodes, key=lambda n: (U.nodes[n]["x"] - c.x) ** 2 + (U.nodes[n]["y"] - c.y) ** 2)
        seen.add(f["name"])
        kind = "school" if f.get("amenity") == "school" else "grocery"
        places.append({"id": f"p{len(places)}", "name": f["name"], "kind": kind, "node": ids[osm]})
    schools = [p for p in places if p["kind"] == "school"]
    stores = [p for p in places if p["kind"] == "grocery"]
    print(f"{len(schools)} schools, {len(stores)} grocery stores")

    def sp(start, goal, closed=()):
        H = R.copy()
        H.remove_edges_from(closed)
        try:
            path = nx.shortest_path(H, start, goal, weight="w")
        except nx.NetworkXNoPath:
            return {"path": [], "meters": None}
        return {"path": path, "meters": round(nx.path_weight(H, path, "w"), 1)}

    # Pick school -> store pairs that are a decent walk (1.2 – 4 km) and spread out.
    pairs = []
    for s in schools:
        for g in stores:
            r = sp(s["node"], g["node"])
            if r["meters"] and 1200 < r["meters"] < 4000:
                pairs.append((r["meters"], s, g, r))
    pairs.sort(key=lambda x: -x[0])
    chosen, used = [], set()
    for m, s, g, r in pairs:
        if s["id"] in used or g["id"] in used and len(chosen) < 2:
            continue
        chosen.append((s, g, r))
        used.update([s["id"], g["id"]])
        if len(chosen) == 4:
            break
    assert len(chosen) >= 3, "not enough school/store pairs; widen BBOX"

    def test(tid, name, visible, s, g, closed=()):
        closed = [list(e) for e in closed]
        return {"id": tid, "name": name, "visible": visible, "start": s["node"], "goal": g["node"],
                "startName": s["name"], "goalName": g["name"], "closed": closed,
                "expected": sp(s["node"], g["node"], closed)}

    (s1, g1, _), (s2, g2, _), (s3, g3, _) = chosen[:3]
    # Unreachable: close every street around a store.
    s4, g4, _ = chosen[3] if len(chosen) > 3 else chosen[0]
    cut = [[g4["node"], n] for n in R.neighbors(g4["node"])]
    tests = [
        test("t1", f"{s1['name']} → {g1['name']}", True, s1, g1),
        test("t2", f"{s2['name']} → {g2['name']}", True, s2, g2),
        test("h1", f"{s3['name']} → {g3['name']}", False, s3, g3),
        test("h2", f"Already there: {g2['name']}", False, g2, g2),
        test("h3", f"Can't be reached: {s4['name']} → {g4['name']} (every street around it is closed)", False, s4, g4, closed=cut),
    ]
    data = {"places": places, "tests": tests}
    (OUT / "route_tests.json").write_text(json.dumps(data, indent=1, ensure_ascii=False))
    for t in tests:
        print(t["id"], t["name"], t["expected"]["meters"])


if __name__ == "__main__":
    main()
