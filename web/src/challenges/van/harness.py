# Stray-Dog Van Route: appended to common/base.py. The student writes plan_route(dist).
FUNCTION = "plan_route"


def _args(test):
    return (_fresh(test["dist"]),)


def _shape(result):
    if isinstance(result, (list, tuple)) and all(isinstance(x, int) and not isinstance(x, bool) for x in result):
        return {"type": "list", "value": list(result)}
    return _wrong(result)
