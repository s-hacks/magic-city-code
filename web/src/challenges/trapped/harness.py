# Don't Get Trapped 1: runs inside Pyodide (web worker). Loaded once with DATA_JSON = trapped.json.
# Entry point: __run(code, payload_json) -> json string, one result per test.
# Every graph[corner] lookup is logged (with the student's line number) so the map can replay the
# search spreading out from the fire station, and stop where the trains are.
import json, sys, time, traceback

STUDENT = "<your code>"
TIME_LIMIT = 3.0
MAX_EVENTS = 200_000
_data = json.loads(DATA_JSON)  # noqa: F821 (set by the worker)
_nodes = {int(k) for k in _data["graph"]["nodes"]}
_base = {n: [] for n in _nodes}
for u, v, w, *_ in _data["graph"]["edges"]:
    _base[u].append((v, w))
    _base[v].append((u, w))

_events = []  # flat triples: kind (2 = expand), corner, line
_deadline = 0.0


class TimeLimit(Exception):
    pass


def _line():
    f = sys._getframe(2)
    while f is not None and f.f_code.co_filename != STUDENT:
        f = f.f_back
    return f.f_lineno if f is not None else 0


def _log(node):
    if time.monotonic() > _deadline:
        raise TimeLimit()
    if len(_events) < MAX_EVENTS * 3:
        _events.extend((2, node, _line()))


class TracedGraph(dict):
    """graph[corner] logs that the search looked at that corner. Students see a normal dict."""

    def __getitem__(self, node):
        if isinstance(node, int):
            _log(node)
        return dict.__getitem__(self, node)

    def get(self, node, default=None):
        return self[node] if node in self else default


def _error(e):
    tb = traceback.extract_tb(e.__traceback__)
    line = next((f.lineno for f in reversed(tb) if f.filename == STUDENT), 0)
    msg = f"{type(e).__name__}: {e}"
    if isinstance(e, NameError):
        msg += "  (check the spelling, or define it first)"
    if isinstance(e, KeyError):
        msg += "  (that corner isn't in graph: corners are ints, and every corner on the map is a key)"
    return {"line": line, "message": msg}


def _shape(result):
    if isinstance(result, bool):
        return {"type": "bool", "value": result}
    return {"type": type(result).__name__, "value": None, "repr": repr(result)[:120]}


def __run(code, payload_json):
    global _deadline
    payload = json.loads(payload_json)
    ns = {"__name__": "__student__"}
    out = []
    try:
        _deadline = time.monotonic() + TIME_LIMIT
        exec(compile(code, STUDENT, "exec"), ns)
        fn = ns.get("can_reach")
        if not callable(fn):
            raise NameError("Define a function called can_reach(graph, start, goal, blocked)")
    except BaseException as e:  # noqa: BLE001
        err = _error(e) if not isinstance(e, SyntaxError) else {"line": e.lineno or 0, "message": f"SyntaxError: {e.msg}"}
        return json.dumps([{"id": t["id"], "events": [], "result": None, "error": err, "timedOut": False, "ms": 0} for t in payload["tests"]])

    for t in payload["tests"]:
        g = TracedGraph({n: list(adj) for n, adj in _base.items()})
        _events.clear()
        res = {"id": t["id"], "result": None, "error": None, "timedOut": False}
        t0 = time.monotonic()
        _deadline = t0 + TIME_LIMIT
        try:
            res["result"] = _shape(fn(g, t["start"], t["goal"], set(t["blocked"])))
        except TimeLimit:
            res["timedOut"] = True
        except BaseException as e:  # noqa: BLE001
            res["error"] = _error(e)
        res["ms"] = round((time.monotonic() - t0) * 1000)
        res["events"] = list(_events)
        out.append(res)
    return json.dumps(out)
