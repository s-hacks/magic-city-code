# Water Bill Check: appended to common/base.py. The student writes flag_estimated(bills).
FUNCTION = "flag_estimated"


def _args(test):
    return (_fresh(test["bills"]),)


def _shape(result):
    if isinstance(result, (list, tuple, set, frozenset)) and all(isinstance(x, str) for x in result):
        return {"type": "list", "value": sorted(result)}
    return _wrong(result)
