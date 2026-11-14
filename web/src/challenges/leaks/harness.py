# Stop the Leaks: appended to common/base.py. The student writes plan_crews(leaks, crews, depot).
FUNCTION = "plan_crews"
_SPEED = _data["speed"]  # meters per hour
_DETOUR = _data["detour"]  # streets are longer than a straight line


def _drive_hours(a, b):
    """Hours to drive between two things with "lat" and "lon"."""
    return _distance(a, b) * _DETOUR / _SPEED


city.drive_hours = _drive_hours


def _args(test):
    return (_fresh(test["leaks"]), test["crews"], _fresh(_data["depot"]))


def _shape(result):
    if isinstance(result, (list, tuple)) and all(isinstance(r, (list, tuple)) and all(isinstance(x, str) for x in r) for r in result):
        return {"type": "list", "value": [list(r) for r in result]}
    return _wrong(result)
