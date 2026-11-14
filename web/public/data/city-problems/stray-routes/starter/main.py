from routes.load import read_sightings, read_shelter
from routes.plan import plan_route, route_length

shelter = read_shelter()
sightings = read_sightings()
print("Sightings today:", len(sightings))

order = plan_route(shelter, sightings)
print("Stops in your route:", len(order))

by_id = {s["sighting_id"]: s for s in sightings}
your_stops = [by_id[sighting_id] for sighting_id in order]

old_km = route_length(shelter, sightings)  # the old route: file order
new_km = route_length(shelter, your_stops)
print("Old route:", round(old_km, 1), "km")
print("Your route:", round(new_km, 1), "km")
if old_km > 0 and new_km > 0:
    print("Shorter by", round(100 * (old_km - new_km) / old_km), "percent")
print("First five stops:", order[:5])

# --- The map: the van's trip from the shelter and back --------------------------------
import mapview

mapview.points([shelter], color="green", label="name", name="shelter")
if your_stops:
    mapview.route([shelter] + your_stops + [shelter], label="sighting_id", name="your route")
    mapview.note(f"Your route: {round(new_km, 1)} km for {len(your_stops)} stops")
else:
    mapview.note("Write plan_route() and the van's route shows up here.")
