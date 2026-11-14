"""Your part: plan the van's route."""
from routes.geo import distance_km

HOT_REPORTS = 3  # a sighting with this many reports or more is a hot spot


def route_length(shelter, stops):
    """Km for: shelter -> each stop in order -> back to the shelter.

    An empty list of stops gives 0.
    """
    total = 0.0
    here = shelter
    for stop in stops:
        total += distance_km(here, stop)
        here = stop
    total += distance_km(here, shelter)  # drive home
    return total


def plan_route(shelter, sightings):
    """A list of sighting_ids in the order to visit them.

    Hot spots first, then the rest. Inside each group, always go to the
    closest stop that is left. Ties: smaller sighting_id first.
    """
    hot = [s for s in sightings if s["reports"] >= HOT_REPORTS]
    not_hot = [s for s in sightings if s["reports"] < HOT_REPORTS]

    order = []
    here = shelter
    for group in (hot, not_hot):
        left = sorted(group, key=lambda s: s["sighting_id"])
        while left:
            closest = min(left, key=lambda s: distance_km(here, s))
            order.append(closest["sighting_id"])
            left.remove(closest)
            here = closest
    return order
