"""Already written for you: read the two CSV files."""
import csv


def read_reports(path="data/reports_311.csv"):
    """A list of dicts, one per 311 report. Every value is text."""
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def read_inlets(path="data/inlets.csv"):
    """A dict from inlet_id to its facts."""
    inlets = {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            inlets[row["inlet_id"]] = {
                "street": row["street"],
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
                "homes_downhill": int(row["homes_downhill"]),
                "near_bus_stop": row["near_bus_stop"] == "yes",
            }
    return inlets
