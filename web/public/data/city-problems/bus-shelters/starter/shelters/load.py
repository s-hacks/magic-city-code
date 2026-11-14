"""Already written for you: read the stops file."""
import csv


def read_stops(path="data/stops.csv"):
    """A list of stop dicts. The number columns are real numbers."""
    stops = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            stops.append({
                "stop_id": row["stop_id"],
                "name": row["name"],
                "students": int(row["students"]),
                "avg_wait_min": float(row["avg_wait_min"]),
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
            })
    return stops
