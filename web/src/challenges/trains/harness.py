# Runs inside Pyodide (web worker). Loaded once per challenge with DATA_JSON set.
# Entry point: __run(code, payload_json) -> json string, one result per test.
# One harness for the three "Don't Get Trapped" levels; payload["level"] picks the function.
import heapq, json, sys, time, traceback

STUDENT = "<your code>"
MAX_EVENTS = 400_000
FUNCTIONS = {
    "reach": ("can_reach", "can_reach(graph, start, goal, blocked)", 3.0),
    "route": ("rescue_route", "rescue_route(graph, start, goal, blocked)", 3.0),
    "underpass": ("best_underpass", "best_underpass(graph, station, homes, mornings, crossings)", 5.0),
}
_data = json.loads(DATA_JSON)  # noqa: F821 (set by the worker)
_coords = {int(k): v for k, v in _data["nodes"].items()}
_homes = {int(k): v for k, v in _data["homes"].items()}
_base = {n: [] for n in _coords}
for e in _data["edges"]:
    u, v, w = e[0], e[1], e[2]
    _base[u].append((v, w))
    _base[v].append((u, w))

_events = []  # flat: kind, node, line   (kind 0 = push, 1 = pop, 2 = expand)
_deadline = 0.0
_ticks = 0


class TimeLimit(Exception):
    pass


def _line():
    f = sys._getframe(2)
    while f is not None and f.f_code.co_filename != STUDENT:
        f = f.f_back
    return f.f_lineno if f is not None else 0


def _log(kind, node):
    if time.monotonic() > _deadline or len(_events) > MAX_EVENTS * 3:
        raise TimeLimit()
    _events.extend((kind, node, _line()))


class TracedGraph(dict):
    """graph[node] logs an 'expand'. Students see a normal dict."""

    def __getitem__(self, node):
        if isinstance(node, int):
            _log(2, node)
        return dict.__getitem__(self, node)

    def get(self, node, default=None):
        return self[node] if node in self else default


class TimedGraph(dict):
    """Level 3 searches the map many times: no replay, only the time limit."""

    def __getitem__(self, node):
        global _ticks
        _ticks += 1
        if _ticks % 512 == 0 and time.monotonic() > _deadline:
            raise TimeLimit()
        return dict.__getitem__(self, node)

    def get(self, node, default=None):
        return self[node] if node in self else default


def _node_of(item):
    # heap items are usually (dist, node) or (dist, node, path): find the node id
    if isinstance(item, (tuple, list)):
        for x in item[1:]:
            if isinstance(x, int) and x in _coords:
                return x
        return -1
    return item if isinstance(item, int) else -1


_push, _pop = heapq.heappush, heapq.heappop


def _traced_push(heap, item):
    _log(0, _node_of(item))
    return _push(heap, item)


def _traced_pop(heap):
    item = _pop(heap)
    _log(1, _node_of(item))
    return item


def _error(e):
    tb = traceback.extract_tb(e.__traceback__)
    line = next((f.lineno for f in reversed(tb) if f.filename == STUDENT), 0)
    msg = f"{type(e).__name__}: {e}"
    if isinstance(e, NameError):
        msg += "  (check the spelling, or define it first)"
    return {"line": line, "message": msg}


def _jsonable(result):
    # value is always a list of ints: [0] or [1] for a bool, [n] for an int
    if isinstance(result, bool):
        return {"type": "bool", "value": [int(result)], "repr": repr(result)}
    if isinstance(result, int):
        return {"type": "int", "value": [result], "repr": repr(result)}
    if isinstance(result, (list, tuple)) and all(isinstance(x, int) and not isinstance(x, bool) for x in result):
        return {"type": "list", "value": list(result), "repr": repr(result)[:120]}
    return {"type": type(result).__name__, "value": None, "repr": repr(result)[:120]}


def _args(level, t):
    if level == "underpass":
        return (TimedGraph(_base), t["station"], dict(_homes), [set(m) for m in t["mornings"]], list(t["crossings"]))
    return (TracedGraph(_base), t["start"], t["goal"], set(t["blocked"]))


def __run(code, payload_json):
    global _deadline
    payload = json.loads(payload_json)
    level = payload["level"]
    name, signature, limit = FUNCTIONS[level]
    ns = {"__name__": "__student__"}
    out = []
    heapq.heappush, heapq.heappop = _traced_push, _traced_pop
    try:
        try:
            _deadline = time.monotonic() + limit
            exec(compile(code, STUDENT, "exec"), ns)
            fn = ns.get(name)
            if not callable(fn):
                raise NameError(f"Define a function called {signature}")
        except BaseException as e:  # syntax errors, top-level crashes
            err = _error(e) if not isinstance(e, SyntaxError) else {"line": e.lineno or 0, "message": f"SyntaxError: {e.msg}"}
            return json.dumps([{"id": t["id"], "events": [], "result": None, "error": err, "timedOut": False, "ms": 0} for t in payload["tests"]])

        for t in payload["tests"]:
            args = _args(level, t)
            _events.clear()
            res = {"id": t["id"], "result": None, "error": None, "timedOut": False}
            t0 = time.monotonic()
            _deadline = t0 + limit
            try:
                res["result"] = _jsonable(fn(*args))
            except TimeLimit:
                res["timedOut"] = True
            except BaseException as e:
                res["error"] = _error(e)
            res["ms"] = round((time.monotonic() - t0) * 1000)
            res["events"] = list(_events)
            out.append(res)
    finally:
        heapq.heappush, heapq.heappop = _push, _pop
    return json.dumps(out)
