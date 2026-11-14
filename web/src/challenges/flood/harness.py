# Flood Cut-Off: runs inside Pyodide (web worker). Loaded once with DATA_JSON = graph.json.
# Entry point: __run(code, payload_json) -> json string, one result per test.
# Like Route to Fresh Food's harness, heap pushes/pops and graph lookups are logged, so the map
# can replay the search spreading out from the shelters, line by line.
import heapq, json, sys, time, traceback

STUDENT = "<your code>"
TIME_LIMIT = 3.0
MAX_EVENTS = 400_000
_data = json.loads(DATA_JSON)  # noqa: F821 (set by the worker)
_nodes = {int(k) for k in _data["nodes"]}
_base = {n: [] for n in _nodes}
for e in _data["edges"]:
    u, v, w = e[0], e[1], e[2]
    _base[u].append((v, w))
    _base[v].append((u, w))

_events = []  # flat triples: kind (0 push, 1 pop, 2 expand), node, line
_deadline = 0.0


class TimeLimit(Exception):
    pass


def _line():
    f = sys._getframe(2)
    while f is not None and f.f_code.co_filename != STUDENT:
        f = f.f_back
    return f.f_lineno if f is not None else 0


def _log(kind, node):
    if time.monotonic() > _deadline:
        raise TimeLimit()
    if len(_events) < MAX_EVENTS * 3:
        _events.extend((kind, node, _line()))


class TracedGraph(dict):
    """graph[node] logs an 'expand'. Students see a normal dict."""

    def __getitem__(self, node):
        if isinstance(node, int):
            _log(2, node)
        return dict.__getitem__(self, node)

    def get(self, node, default=None):
        return self[node] if node in self else default


def _node_of(item):
    if isinstance(item, (tuple, list)):
        for x in item[1:]:
            if isinstance(x, int) and x in _nodes:
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


def _shape(result):
    if isinstance(result, dict) and all(isinstance(k, int) and not isinstance(k, bool) and isinstance(v, (int, float)) and not isinstance(v, bool) for k, v in result.items()):
        return {"type": "dict", "value": {str(k): round(float(v), 2) for k, v in result.items()}}
    return {"type": type(result).__name__, "value": None, "repr": repr(result)[:120]}


def __run(code, payload_json):
    global _deadline
    payload = json.loads(payload_json)
    ns = {"__name__": "__student__"}
    out = []
    heapq.heappush, heapq.heappop = _traced_push, _traced_pop
    try:
        try:
            _deadline = time.monotonic() + TIME_LIMIT
            exec(compile(code, STUDENT, "exec"), ns)
            fn = ns.get("walk_times")
            if not callable(fn):
                raise NameError("Define a function called walk_times(graph, shelters)")
        except BaseException as e:
            err = _error(e) if not isinstance(e, SyntaxError) else {"line": e.lineno or 0, "message": f"SyntaxError: {e.msg}"}
            return json.dumps([{"id": t["id"], "events": [], "result": None, "error": err, "timedOut": False, "ms": 0} for t in payload["tests"]])

        for t in payload["tests"]:
            closed = {(a, b) for a, b in t["closed"]} | {(b, a) for a, b in t["closed"]}
            g = TracedGraph({n: [(v, w) for v, w in adj if (n, v) not in closed] for n, adj in _base.items()})
            _events.clear()
            res = {"id": t["id"], "result": None, "error": None, "timedOut": False}
            t0 = time.monotonic()
            _deadline = t0 + TIME_LIMIT
            try:
                res["result"] = _shape(fn(g, list(t["shelters"])))
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
