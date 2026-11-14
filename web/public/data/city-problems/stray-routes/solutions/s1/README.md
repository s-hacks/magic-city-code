# Plan a stray-dog pickup route

(Sample problem. The volunteer, the shelter and the sightings are made up.)

Stray animals are the number one complaint to 311 in Birmingham. A volunteer drives one van from the shelter, picks up strays, and drives back. Your job is to plan today's route.

The rules:

1. The van starts and ends at the shelter.
2. Visit every sighting once.
3. **Hot spots first.** A hot spot is a sighting with 3 or more reports. Visit all the hot spots before any other stop.
4. Inside each group (hot spots, then the rest), always drive to the closest stop that is left. This is called the "nearest neighbor" trick.

## The data

`data/sightings.csv` has one row for each place where a stray was reported today.

| column | what it is |
| --- | --- |
| sighting_id | the sighting, like `W07` |
| street | the street |
| reports | how many people called about it |
| minutes_ago | how long ago the newest call came in |
| lat, lon | where it is |

`data/shelter.json` has the shelter: `{"name": ..., "lat": ..., "lon": ...}`.

## Already written for you

- `routes/load.py` has `read_sightings()` (a list of dicts with real numbers for `reports`, `minutes_ago`, `lat` and `lon`) and `read_shelter()` (a dict with `lat` and `lon`).
- `routes/geo.py` has `distance_km(a, b)`. Give it any two dicts that have `lat` and `lon` and it gives the straight-line distance in kilometers.

## What you write

Both functions go in `routes/plan.py`. The number `HOT_REPORTS = 3` is already there.

### `route_length(shelter, stops)`

`stops` is a list of sighting dicts in the order the van visits them. Returns the whole trip in km: shelter to the first stop, stop to stop, and the last stop back to the shelter. An empty list gives `0`.

### `plan_route(shelter, sightings)`

Returns a list of `sighting_id`s in the order to visit them, following the rules above. The shelter is not in the list. If two stops are the same distance away, pick the smaller `sighting_id`.

```python
plan_route(shelter, sightings)
# ["W26", "W12", ..., "W07"]
```

## Run it and test it

- Press **Run** to run `main.py`. It compares your route with the old one (the order of the file).
- Press **Run tests** to check your work.

## Tips

- Build the route one stop at a time: from where the van is now, find the closest stop that is left, drive there, and take it off the list.
- `min(items, key=...)` finds the item with the smallest value of something you calculate.
- Split the sightings into two lists first (hot and not hot), then do the same loop on each.
- Keep a variable like `here` for where the van is. It starts as the shelter.
