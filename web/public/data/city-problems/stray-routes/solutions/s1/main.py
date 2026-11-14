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
