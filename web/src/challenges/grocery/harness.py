# Grocery Gap: appended to common/base.py. The student writes pick_sites(areas, stores, sites, k).
FUNCTION = "pick_sites"
_areas = {a["id"]: a for a in _data["areas"]}
_sites = {s["id"]: s for s in _data["sites"]}


def _args(test):
    return (
        _fresh([_areas[i] for i in test["areas"]]),
        _fresh(_data["stores"]),
        _fresh([_sites[i] for i in test["sites"]]),
        test["k"],
    )


def _shape(result):
    if isinstance(result, (list, tuple)) and all(isinstance(x, str) for x in result):
        return {"type": "list", "value": list(result)}
    return _wrong(result)
