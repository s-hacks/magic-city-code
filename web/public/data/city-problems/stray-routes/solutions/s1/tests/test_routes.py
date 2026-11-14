from routes.geo import distance_km
from routes.load import read_sightings, read_shelter
from routes.plan import plan_route, route_length

SHELTER = {"lat": 33.5, "lon": -86.8}


def spot(sighting_id, lat, lon, reports=1):
    return {"sighting_id": sighting_id, "lat": lat, "lon": lon, "reports": reports}


def test_route_length_goes_there_and_back():
    a = spot("A", 33.51, -86.8)
    b = spot("B", 33.52, -86.8)
    assert route_length(SHELTER, []) == 0, "With no stops the van does not move, so the length is 0"
    got = route_length(SHELTER, [a])
    want = 2 * distance_km(SHELTER, a)
    assert abs(got - want) < 0.001, f"One stop should be there and back ({want:.2f} km) but you returned {got:.2f}"
    got = route_length(SHELTER, [a, b])
    want = distance_km(SHELTER, a) + distance_km(a, b) + distance_km(b, SHELTER)
    assert abs(got - want) < 0.001, f"Shelter to A, A to B, then B to the shelter should be {want:.2f} km, but you returned {got:.2f}"


def test_every_sighting_once():
    sightings = [spot("A", 33.51, -86.8), spot("B", 33.52, -86.8), spot("C", 33.53, -86.8, reports=4)]
    got = plan_route(SHELTER, sightings)
    assert sorted(got) == ["A", "B", "C"], f"Every sighting should be in the route exactly once, but you returned {got}"


def test_hot_spots_come_first():
    sightings = [
        spot("S1", 33.501, -86.8),
        spot("S2", 33.54, -86.8, reports=4),
        spot("S3", 33.52, -86.8),
    ]
    got = plan_route(SHELTER, sightings)
    # S2 is far away but has 4 reports. After it, S3 is closer than S1.
    assert got == ["S2", "S3", "S1"], f"S2 has 4 reports so it goes first, then the closest left. Expected ['S2', 'S3', 'S1'], you returned {got}"


def test_go_to_the_closest_stop_from_where_you_are():
    sightings = [spot("P", 33.51, -86.8), spot("Q", 33.52, -86.8), spot("R", 33.505, -86.78)]
    got = plan_route(SHELTER, sightings)
    # From the shelter P is closest. From P, Q is closer than R.
    assert got == ["P", "Q", "R"], f"Closest to the shelter is P, then from P the closest is Q, then R. You returned {got}"


def test_real_data():
    shelter = read_shelter()
    sightings = read_sightings()
    order = plan_route(shelter, sightings)
    all_ids = sorted(s["sighting_id"] for s in sightings)
    assert sorted(order) == all_ids, f"The route should visit all {len(all_ids)} sightings once, but it has {len(order)} stops"
    hot_ids = {s["sighting_id"] for s in sightings if s["reports"] >= 3}
    assert set(order[:len(hot_ids)]) == hot_ids, f"The first {len(hot_ids)} stops should be the hot spots ({sorted(hot_ids)})"
    by_id = {s["sighting_id"]: s for s in sightings}
    new_km = route_length(shelter, [by_id[i] for i in order])
    old_km = route_length(shelter, sightings)
    assert new_km < old_km, f"Your route ({new_km:.1f} km) should be shorter than the old file-order route ({old_km:.1f} km)"
