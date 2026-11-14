# Open Bed: appended to common/base.py. The student writes assign_beds(shelters, people).
FUNCTION = "assign_beds"


def _args(test):
    return (_fresh(test["shelters"]), _fresh(test["people"]))


def _shape(result):
    if isinstance(result, dict) and all(isinstance(k, str) and (v is None or isinstance(v, str)) for k, v in result.items()):
        return {"type": "dict", "value": dict(result)}
    return _wrong(result)
