# /// script
# requires-python = ">=3.12"
# dependencies = ["requests", "shapely>=2"]
# ///
"""Build the static Birmingham city data for Magic City Code.

Outputs (web/public/data/): areas.json, stores.json, sites.json, neighborhoods.json
Field names match shared/data.ts exactly.

Sources (all public, no personal data):
  * Census TIGERweb REST   - Birmingham city boundary (place 0107000) + block groups (Jefferson Co. 01073)
  * Census ACS 5-year 2023 - table-based summary-file bulk downloads (the keyless Census API now
                             redirects to "missing key", so we stream the national .dat files and
                             keep only Jefferson County block-group rows). Tables B25044, B01001.
  * OpenStreetMap Overpass - supermarkets and candidate hub sites
  * City of Birmingham's 99 official neighborhoods (UAB CHEERS ArcGIS feature service) -> neighborhood bboxes

Run: uv run --python 3.12 data/build.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
import time
from pathlib import Path

import requests
from shapely.geometry import Point, shape, mapping
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
OUT = ROOT / "web" / "public" / "data"
CACHE.mkdir(exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

ACS_YEAR = 2023
ACS_BASE = f"https://www2.census.gov/programs-surveys/acs/summary_file/{ACS_YEAR}/table-based-SF/data/5YRData/acsdt5y{ACS_YEAR}-"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb"
NBHD_SVC = "https://services.arcgis.com/B5nw9n9EyXWSnzjv/arcgis/rest/services/Birmingham_Alabama_Neighborhoods/FeatureServer/0"
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
GEO_PREFIX = "1500000US01073"
HEADERS = {"User-Agent": "magic-city-code-data-prep/1.0 (hackathon; public data only)"}

# neighborhood id -> (display name, official neighborhood NUMs to union for the bbox)
NEIGHBORHOODS = {
    "west-end": ("West End", [2001, 2002, 2003, 2004, 2005]),
    "ensley": ("Ensley", [801, 204, 803]),
    "woodlawn": ("Woodlawn", [2104, 2103, 2102]),
    "east-lake": ("East Lake", [602, 603, 604, 605]),
    "north-birmingham": ("North Birmingham", [1106, 1101, 1105, 1104]),
    "collegeville": ("Collegeville", [1102, 1103]),
    "titusville": ("Titusville", [1901, 1902, 1903]),
    "east-thomas": ("East Thomas", [1602, 1603, 1604]),
    "southside": ("Southside", [1701, 1702, 1703]),
    "smithfield": ("Smithfield", [1605]),
}


def get_json(url, params=None, tries=4, post=None, timeout=180):
    for i in range(tries):
        try:
            r = (requests.post(url, data=post, headers=HEADERS, timeout=timeout) if post
                 else requests.get(url, params=params, headers=HEADERS, timeout=timeout))
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa
            print(f"  retry {i+1} {url[:70]}: {e}", file=sys.stderr)
            time.sleep(2 + 3 * i)
    raise RuntimeError(f"unreachable: {url}")


def cached_json(name, fn):
    p = CACHE / name
    if p.exists():
        return json.loads(p.read_text())
    d = fn()
    p.write_text(json.dumps(d))
    return d


def r5(x):
    return round(float(x), 5)


# ---------------------------------------------------------------- boundaries
def city_boundary():
    def f():
        return get_json(f"{TIGER}/Places_CouSub_ConCity_SubMCD/MapServer/4/query", {
            "where": "STATE='01' AND PLACE='07000'", "outFields": "NAME,GEOID",
            "returnGeometry": "true", "outSR": 4326, "f": "geojson"})
    d = cached_json("city.geojson", f)
    return unary_union([shape(x["geometry"]) for x in d["features"]])


def block_groups():
    def f():
        return get_json(f"{TIGER}/Tracts_Blocks/MapServer/1/query", {
            "where": "STATE='01' AND COUNTY='073'", "outFields": "GEOID",
            "returnGeometry": "true", "outSR": 4326, "f": "geojson", "resultRecordCount": 2000})
    return cached_json("bg.geojson", f)


# ---------------------------------------------------------------- ACS bulk
def acs_table(table):
    """Return {12-digit GEOID: row dict} for Jefferson Co. block groups, streaming the national file once."""
    p = CACHE / f"acs_{ACS_YEAR}_{table}_jeff.txt"
    if not p.exists():
        url = f"{ACS_BASE}{table}.dat"
        print(f"  streaming {url}")
        with requests.get(url, stream=True, headers=HEADERS, timeout=300) as r:
            r.raise_for_status()
            r.encoding = "utf-8"
            lines = r.iter_lines(decode_unicode=True)
            header = next(lines)
            keep = [header]
            for ln in lines:
                if ln.startswith(GEO_PREFIX):
                    keep.append(ln)
        p.write_text("\n".join(keep))
    rows = list(csv.DictReader(p.read_text().splitlines(), delimiter="|"))
    return {r["GEO_ID"][-12:]: r for r in rows}


def num(r, col):
    try:
        return int(float(r[col]))
    except (ValueError, KeyError, TypeError):
        return 0


def build_areas(city):
    bg = block_groups()
    veh = acs_table("b25044")
    sex = acs_table("b01001")
    cityp = prep(city)
    # B01001: male under18 E003-E006, female E027-E030; male 65+ E020-E025, female E044-E049
    kid_cols = [f"B01001_E{i:03d}" for i in list(range(3, 7)) + list(range(27, 31))]
    sen_cols = [f"B01001_E{i:03d}" for i in list(range(20, 26)) + list(range(44, 50))]
    areas = []
    for f in bg["features"]:
        gid = f["properties"]["GEOID"]
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        inter = g.intersection(city).area / g.area if g.area else 0
        if not (cityp.contains(g.centroid) or inter >= 0.5):
            continue
        v, s = veh.get(gid), sex.get(gid)
        if v is None or s is None:
            print(f"  no ACS row for {gid}", file=sys.stderr)
            continue
        hh = num(v, "B25044_E001")
        nocar = num(v, "B25044_E003") + num(v, "B25044_E010")
        simp = g.simplify(0.00008, preserve_topology=True)
        parts = [simp] if simp.geom_type == "Polygon" else list(simp.geoms)
        rings = []
        for p_ in parts:
            ring = [[r5(x), r5(y)] for x, y in p_.exterior.coords]
            if len(ring) >= 4:
                rings.append(ring)
        c = g.centroid
        areas.append({
            "id": gid, "neighborhood": None, "center": [r5(c.x), r5(c.y)], "polygon": rings,
            "households": hh, "households_no_car": nocar,
            "kids": sum(num(s, c_) for c_ in kid_cols),
            "seniors": sum(num(s, c_) for c_ in sen_cols),
        })
    areas.sort(key=lambda a: a["id"])
    return areas


# ---------------------------------------------------------------- neighborhoods
def build_neighborhoods():
    def f():
        return get_json(f"{NBHD_SVC}/query", {"where": "1=1", "outFields": "NUM,NAME", "returnGeometry": "true",
                                              "outSR": 4326, "f": "geojson", "geometryPrecision": 6})
    d = cached_json("neighborhoods.geojson", f)
    by = {int(x["properties"]["NUM"]): shape(x["geometry"]) for x in d["features"]}
    out = []
    for nid, (name, nums) in NEIGHBORHOODS.items():
        u = unary_union([by[n] for n in nums])
        minx, miny, maxx, maxy = u.bounds
        c = u.centroid
        out.append({"id": nid, "name": name, "bbox": [r5(minx), r5(miny), r5(maxx), r5(maxy)],
                    "center": [r5(c.x), r5(c.y)]})
    return out


# ---------------------------------------------------------------- OSM
def overpass(query, name):
    def f():
        last = None
        for url in OVERPASS:
            try:
                print(f"  overpass {url}")
                return get_json(url, post={"data": query}, tries=2, timeout=240)
            except Exception as e:  # noqa
                last = e
        raise last
    return cached_json(name, f)


def element_point(e):
    if e["type"] == "node":
        return e["lon"], e["lat"]
    c = e.get("center")
    return (c["lon"], c["lat"]) if c else (None, None)


def osm_features(city):
    minx, miny, maxx, maxy = city.bounds
    bb = f"{miny:.4f},{minx:.4f},{maxy:.4f},{maxx:.4f}"
    q = f"""[out:json][timeout:200];
(
 nwr["shop"="supermarket"]({bb});
 nwr["shop"="grocery"]({bb});
 nwr["amenity"="place_of_worship"]({bb});
 nwr["amenity"="school"]({bb});
 nwr["amenity"="library"]({bb});
 nwr["amenity"="community_centre"]({bb});
);
out center tags;"""
    els = overpass(q, "overpass_all.json")["elements"]
    cityp = prep(city)
    stores, sites = [], []
    seen = set()
    grocery_ok = re.compile(r"market|grocer|foods?|fresh|supermarket|piggly|kroger|publix|walmart|aldi|save|winn|sprouts|whole|costco|sam'?s|target|food", re.I)
    bad = re.compile(r"dollar|family dollar|7-eleven|shell|chevron|exxon|rite aid|cvs|walgreens|gas|mart express|convenience|liquor|tobacco|smoke|mexican|meat depot|restaurant|bakery|butcher", re.I)
    for e in els:
        t = e.get("tags", {})
        name = (t.get("name") or "").strip()
        lon, lat = element_point(e)
        if lon is None or not name or not cityp.contains(Point(lon, lat)):
            continue
        eid = f"{e['type'][0]}{e['id']}"
        rec = {"name": name, "lat": r5(lat), "lon": r5(lon)}
        if t.get("shop") in ("supermarket", "grocery"):
            if bad.search(name):
                continue
            if t["shop"] == "grocery" and not grocery_ok.search(name):
                continue
            stores.append({"id": f"store_{eid}", **rec})
            continue
        am = t.get("amenity")
        kind = {"place_of_worship": "church", "school": "school", "library": "library",
                "community_centre": "community_center"}.get(am)
        if not kind:
            continue
        # Every place of worship can host a hub, whatever the faith. The kind is
        # still called "church" because that is the word in the student API.
        if t.get("disused") or t.get("abandoned") or t.get("disused:amenity"):
            continue
        key = (kind, name.lower(), round(lat, 3), round(lon, 3))  # dedupe node vs way duplicates
        if key in seen:
            continue
        seen.add(key)
        sites.append({"id": f"site_{eid}", "kind": kind, **rec})
    # reorder keys to match contract
    sites = [{"id": s["id"], "name": s["name"], "kind": s["kind"], "lat": s["lat"], "lon": s["lon"]} for s in sites]
    return stores, sites


def write(name, obj):
    p = OUT / name
    p.write_text(json.dumps(obj, separators=(",", ":")))
    print(f"wrote {p.relative_to(ROOT)}  {len(obj)} records  {p.stat().st_size/1024:.0f} KB")


def main():
    print("City boundary...")
    city = city_boundary()
    print("Neighborhoods...")
    nb = build_neighborhoods()
    print("Areas (TIGERweb + ACS)...")
    areas = build_areas(city)
    for a in areas:
        for n in nb:
            x0, y0, x1, y1 = n["bbox"]
            if x0 <= a["center"][0] <= x1 and y0 <= a["center"][1] <= y1:
                a["neighborhood"] = n["id"]
                break
    print("OSM...")
    stores, sites = osm_features(city)
    write("neighborhoods.json", nb)
    write("areas.json", areas)
    write("stores.json", stores)
    write("sites.json", sites)

    # focus-area report
    print("\nFocus areas")
    for nid in ("west-end", "ensley"):
        n = next(x for x in nb if x["id"] == nid)
        x0, y0, x1, y1 = n["bbox"]
        inb = lambda lon, lat: x0 <= lon <= x1 and y0 <= lat <= y1
        ar = [a for a in areas if inb(*a["center"])]
        kinds = {}
        for s in sites:
            if inb(s["lon"], s["lat"]):
                kinds[s["kind"]] = kinds.get(s["kind"], 0) + 1
        st = [s["name"] for s in stores if inb(s["lon"], s["lat"])]
        print(f"{nid} bbox={n['bbox']}: areas={len(ar)} hh={sum(a['households'] for a in ar)} "
              f"no_car={sum(a['households_no_car'] for a in ar)} stores={len(st)} {st} sites={kinds}")
    print(f"\nTotals: areas={len(areas)} hh={sum(a['households'] for a in areas)} "
          f"no_car={sum(a['households_no_car'] for a in areas)} stores={len(stores)} sites={len(sites)}")


if __name__ == "__main__":
    main()
