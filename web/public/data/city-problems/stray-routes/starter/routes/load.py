"""Already written for you: read the sightings and the shelter."""
import csv
import json


def read_sightings(path="data/sightings.csv"):
    """A list of sighting dicts. The number columns are real numbers."""
    sightings = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            sightings.append({
                "sighting_id": row["sighting_id"],
                "street": row["street"],
                "reports": int(row["reports"]),
                "minutes_ago": int(row["minutes_ago"]),
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
            })
    return sightings


def read_shelter(path="data/shelter.json"):
    """A dict like {"name": ..., "lat": ..., "lon": ...}."""
    with open(path) as f:
        return json.load(f)
