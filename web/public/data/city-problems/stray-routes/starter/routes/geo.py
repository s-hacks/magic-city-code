"""Already written for you: distance between two places."""
import math


def distance_km(a, b):
    """Straight-line distance in km between two dicts that have "lat" and "lon".

    Good enough for a small city map.
    """
    mid_lat = math.radians((a["lat"] + b["lat"]) / 2)
    north_south = (b["lat"] - a["lat"]) * 111.0
    east_west = (b["lon"] - a["lon"]) * 111.0 * math.cos(mid_lat)
    return math.hypot(east_west, north_south)
