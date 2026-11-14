# Where do new bus shelters help the most kids?

(Sample problem. The parent group and the numbers are made up.)

Kids in Ensley wait for the bus in the rain and the heat. A parent group can pay for 4 bus shelters. Your job is to pick the 4 stops where a shelter helps the most.

The group's rule: a stop's score is **the number of students who wait there times the average minutes they wait**. A stop with 40 students who wait 10 minutes scores 400 "kid-minutes".

## The data

`data/stops.csv` has one row for each bus stop.

| column | what it is |
| --- | --- |
| stop_id | the stop, like `E07` |
| name | the street corner |
| students | how many students use the stop on a school day |
| avg_wait_min | how many minutes they wait on average |
| lat, lon | where the stop is |

## Already written for you

`shelters/load.py` has `read_stops()`. It gives a list of dicts, like `{"stop_id": "E07", "name": "Avenue E & 20th St", "students": 22, "avg_wait_min": 10.0, "lat": 33.51, "lon": -86.88}`. The numbers are real numbers.

## What you write

Both functions go in `shelters/pick.py`.

### `score_stop(stop)`

Takes one stop dict. Returns `students * avg_wait_min`.

```python
score_stop({"students": 20, "avg_wait_min": 5})   # 100
```

### `pick_shelters(stops, how_many=4)`

Takes the list of stops. Returns a list of the `stop_id`s of the `how_many` best stops, the best one first.

- Best means the biggest score.
- If two stops have the same score, the smaller `stop_id` goes first.
- If there are fewer stops than `how_many`, return all of them.

```python
pick_shelters([
    {"stop_id": "A", "students": 10, "avg_wait_min": 5},
    {"stop_id": "B", "students": 4, "avg_wait_min": 20},
], how_many=1)
# ["B"]   (A scores 50, B scores 80)
```

## Run it and test it

- Press **Run** to run `main.py`. It prints the stops you picked.
- Press **Run tests** to check your work.

## Tips

- The stop with the most students is not always the best one. Look at the wait time too.
- `sorted(items, key=...)` can sort by a number you work out for each item.
- To sort big to small, put a minus sign in front of the number, or use `reverse=True`. For ties, make the key a pair: `(-score, stop_id)`.
- A slice like `my_list[:4]` takes the first 4 items.
