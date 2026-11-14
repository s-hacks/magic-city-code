from shelters.load import read_stops
from shelters.pick import pick_shelters

stops = read_stops()
print("Bus stops in the file:", len(stops))

picked = pick_shelters(stops, how_many=4)
by_id = {stop["stop_id"]: stop for stop in stops}

print("Build shelters at:")
for stop_id in picked:
    stop = by_id[stop_id]
    print(" ", stop_id, stop["name"], "-", stop["students"], "students wait", stop["avg_wait_min"], "min")

# --- The map: your new shelters, numbered best first ---------------------------------
import mapview

mapview.highlight([by_id[s] for s in picked if s in by_id], label="name", name="new shelters")
mapview.note("Shelters at: " + ", ".join(picked) if picked else "Write pick_shelters() and your picks light up here.")
