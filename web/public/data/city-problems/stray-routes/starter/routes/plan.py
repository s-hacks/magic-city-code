"""Your part: plan the van's route."""
from routes.geo import distance_km

HOT_REPORTS = 3  # a sighting with this many reports or more is a hot spot


def route_length(shelter, stops):
    """Km for: shelter -> each stop in order -> back to the shelter.

    An empty list of stops gives 0.
    """
    # TODO: write this
    return 0.0


def plan_route(shelter, sightings):
    """A list of sighting_ids in the order to visit them.

    Hot spots first, then the rest. Inside each group, always go to the
    closest stop that is left. Ties: smaller sighting_id first.
    """
    # TODO: write this
    return []
