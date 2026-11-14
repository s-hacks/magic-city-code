# Shared test harness for the newer challenges (Stray-Dog Van, Water Bill Check, Open Bed).
# Runs inside Pyodide in a web worker. Each challenge appends its own Python after this file and defines:
#   FUNCTION         the name of the function the student writes
#   _args(test)      the arguments for one test (fresh copies, so a student can't change the data)
#   _shape(result)   {"type", "value", "repr"} with value = a JSON-safe copy, or None if it's the wrong shape
# DATA_JSON (set by the worker) holds the challenge's data file, including every test's input.
# Entry point: __run(code, payload_json) -> json string, one result per test id in the payload.
import json, math, sys, time, traceback, types

STUDENT = "<your code>"
TIME_LIMIT = 3.0
_data = json.loads(DATA_JSON)  # noqa: F821 (set by the worker)
_tests = {t["id"]: t for t in _data["tests"]}
_deadline = 0.0


class TimeLimit(Exception):
    pass


def _tracer(frame, event, arg):
    # Only the student's own lines are traced, so the check costs little.
    if frame.f_code.co_filename != STUDENT:
        return None
    if time.monotonic() > _deadline:
        raise TimeLimit()
    return _tracer


def _error(e):
    tb = traceback.extract_tb(e.__traceback__)
    line = next((f.lineno for f in reversed(tb) if f.filename == STUDENT), 0)
    msg = f"{type(e).__name__}: {e}"
    if isinstance(e, NameError):
        msg += "  (check the spelling, or define it first)"
    if isinstance(e, KeyError):
        msg = f"KeyError: {e} is not a key in that dictionary"
    return {"line": line, "message": msg}


def _distance(a, b):
    """Straight-line meters between two things with "lat" and "lon" (dicts), or (lat, lon) pairs."""
    la1, lo1 = (a["lat"], a["lon"]) if isinstance(a, dict) else a
    la2, lo2 = (b["lat"], b["lon"]) if isinstance(b, dict) else b
    p1, p2 = math.radians(la1), math.radians(la2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


city = types.ModuleType("city")
city.distance = _distance
sys.modules["city"] = city


def _fresh(x):
    return json.loads(json.dumps(x))


def __run(code, payload_json):
    global _deadline
    payload = json.loads(payload_json)
    ids = [t["id"] for t in payload["tests"]]
    ns = {"__name__": "__student__", "city": city}
    try:
        _deadline = time.monotonic() + TIME_LIMIT
        sys.settrace(_tracer)
        try:
            exec(compile(code, STUDENT, "exec"), ns)
        finally:
            sys.settrace(None)
        fn = ns.get(FUNCTION)  # noqa: F821 (set by the challenge)
        if not callable(fn):
            raise NameError(f"Define a function called {FUNCTION}")  # noqa: F821
    except BaseException as e:  # syntax errors, top-level crashes, a missing function
        err = {"line": e.lineno or 0, "message": f"SyntaxError: {e.msg}"} if isinstance(e, SyntaxError) else _error(e)
        if isinstance(e, TimeLimit):
            err = None
        return json.dumps([{"id": i, "events": [], "result": None, "error": err, "timedOut": err is None, "ms": 0} for i in ids])

    out = []
    for i in ids:
        res = {"id": i, "events": [], "result": None, "error": None, "timedOut": False}
        args = _args(_tests[i])  # noqa: F821
        t0 = time.monotonic()
        _deadline = t0 + TIME_LIMIT
        sys.settrace(_tracer)
        try:
            res["result"] = _shape(fn(*args))  # noqa: F821
        except TimeLimit:
            res["timedOut"] = True
        except BaseException as e:  # noqa: BLE001 (every student error is reported, never raised)
            res["error"] = _error(e)
        finally:
            sys.settrace(None)
        res["ms"] = round((time.monotonic() - t0) * 1000)
        out.append(res)
    return json.dumps(out)


def _wrong(result):
    return {"type": type(result).__name__, "value": None, "repr": repr(result)[:120]}
