# Which storm drains should crews clear first?

(Sample problem. The neighbors and the data are made up.)

When it rains hard, clogged storm drains (called "inlets") flood streets, yards and bus stops. About a third of Birmingham's 27,000 storm inlets need repair. The crew can only fix a few in one day. Your job is to put the inlets in the order the crew should visit them.

## The data

`data/reports_311.csv` has one row for each 311 call about a drain.

| column | what it is |
| --- | --- |
| report_id | the number of the call |
| inlet_id | which inlet the call was about, like `I05` |
| date | the day of the call, like `2025-03-10` |
| street | the street |
| issue | what the caller saw (clogged, flooding, ...) |

Careful: neighbors often call about the same drain on the same day. Two reports with the same `inlet_id` and the same `date` are repeats. They should count once.

`data/inlets.csv` has one row for each inlet.

| column | what it is |
| --- | --- |
| inlet_id | the inlet, like `I05` |
| street | the street |
| lat, lon | where it is |
| homes_downhill | how many homes sit downhill and flood when it clogs |
| near_bus_stop | `yes` or `no` |

## Already written for you

`drains/load.py` reads the files:

- `read_reports()` gives a list of dicts, like `{"report_id": "R001", "inlet_id": "I01", "date": "2025-03-02", ...}`. Every value is text.
- `read_inlets()` gives a dict from inlet id to a dict, like `{"I01": {"street": "Maple St", "homes_downhill": 14, "near_bus_stop": False, ...}}`. Numbers are real numbers and `near_bus_stop` is `True` or `False`.

## What you write

Both functions go in `drains/rank.py`.

### `count_unique_reports(reports)`

Takes the list of report dicts. Returns a dict from `inlet_id` to the number of different days it was reported. The same inlet on the same day counts once.

```python
count_unique_reports([
    {"inlet_id": "A", "date": "2025-03-01"},
    {"inlet_id": "A", "date": "2025-03-01"},
    {"inlet_id": "A", "date": "2025-03-02"},
])
# {"A": 2}
```

### `rank_inlets(reports, inlets)`

Returns a list of `inlet_id`s, the one to fix first at the front. Use these rules:

1. Only inlets that have at least one report are in the list.
2. Weight of an inlet = `homes_downhill`, plus 5 more if `near_bus_stop` is `True`.
3. Score = (number of different days reported) x weight.
4. Highest score first. If two scores tie, the smaller `inlet_id` (A before B) goes first.

## Run it and test it

- Press **Run** to run `main.py`. It prints the first five inlets in your list.
- Press **Run tests** to check your work. Each test says in plain words what went wrong.

## Tips

- A dict is a good way to count: `counts[key] = counts.get(key, 0) + 1`.
- A `set` remembers what you have already seen. You can put a pair like `(inlet_id, date)` in a set.
- `sorted(items, key=...)` can sort by more than one thing. Put a minus sign in front of a number to sort big to small.
- Do one function at a time. Get the counting tests green first.

## The map

The map next to the editor shows every spot in the data files that has `lat` and `lon`. When you run `main.py`, the bottom of the file draws your answer on top with `mapview`:

- `mapview.highlight(rows, label="name")` lights up your picks, numbered in order.
- `mapview.points(rows, color="cyan")` adds plain dots.
- `mapview.route(stops)` draws a line through the stops, in order.
- `mapview.note("text")` puts a caption on the map.

With **Live** on, the map redraws a moment after you stop typing.
