"""
The `city` module that students use. It runs inside Pyodide, in the Web Worker.

Student code never draws anything. It only ASKS questions about the city
(city.sites(), city.stores(), city.neighborhoods()) and RECORDS actions
(city.place_hub(site)). The page's engine decides what the actions mean.

How the worker uses this file:
    city._setup(json_text)   feed in the sites / stores / neighborhoods for this run
    city._run(code)          run the student's code, return a JSON string with
                             either the recorded actions or a structured error
"""
import builtins
import difflib
import json
import sys

# The filename we give the student's code, so we can tell their lines from ours.
STUDENT_FILE = "<student>"

# Most actions one run may record. Keeps a runaway loop from building a giant list.
MAX_ACTIONS = 500

_sites = []
_stores = []
_neighborhoods = []
_actions = []


class CityError(Exception):
    """A mistake with a city function. The message is already written in plain words."""


# --------------------------------------------------------------------------
# The objects students see
# --------------------------------------------------------------------------

class Site:
    """A place that could host a hub (a church, school, library...)."""

    def __init__(self, d):
        self.id = d["id"]
        self.name = d["name"]
        self.kind = d["kind"]
        self.lat = d["lat"]
        self.lon = d["lon"]
        self.families_nearby = d.get("families_nearby", 0)
        self.families_without_car = d.get("families_without_car", 0)
        self.minutes_to_store = d.get("minutes_to_store", 0)

    def __repr__(self):
        return "Site(%r, kind=%r, families_nearby=%s, families_without_car=%s, minutes_to_store=%s)" % (
            self.name, self.kind, _num(self.families_nearby),
            _num(self.families_without_car), _num(self.minutes_to_store))

    def __eq__(self, other):
        return isinstance(other, Site) and other.id == self.id

    def __hash__(self):
        return hash(self.id)


class Store:
    """An existing grocery store."""

    def __init__(self, d):
        self.id = d["id"]
        self.name = d["name"]
        self.lat = d["lat"]
        self.lon = d["lon"]

    def __repr__(self):
        return "Store(%r)" % (self.name,)


class Neighborhood:
    """An area of the city that a mission is about."""

    def __init__(self, d):
        self.id = d["id"]
        self.name = d["name"]
        self.households = d.get("households", 0)
        center = d.get("center") or [0, 0]
        self.lon = center[0]
        self.lat = center[1]

    def __repr__(self):
        return "Neighborhood(%r, households=%s)" % (self.name, _num(self.households))


def _num(x):
    """Show 1200.0 as 1200 so printed sites look friendly."""
    if isinstance(x, float) and x == int(x):
        return int(x)
    if isinstance(x, float):
        return round(x, 1)
    return x


# --------------------------------------------------------------------------
# The functions students call
# --------------------------------------------------------------------------

def sites(kind=None):
    """List of places that could host a hub. Pass kind="church" to keep only one kind."""
    if kind is None:
        return list(_sites)
    if not isinstance(kind, str):
        raise CityError("city.sites() wants a kind in quotes, like city.sites(kind=\"church\").")
    wanted = kind.strip().lower()
    kinds = sorted({s.kind for s in _sites})
    if wanted not in kinds and kinds:
        close = difflib.get_close_matches(wanted, kinds, n=1, cutoff=0.6)
        hint = " Did you mean \"%s\"?" % close[0] if close else ""
        raise CityError("I don't know the kind of place \"%s\".%s The kinds here are: %s." % (
            kind, hint, ", ".join(kinds)))
    return [s for s in _sites if s.kind == wanted]


def stores():
    """List of existing grocery stores."""
    return list(_stores)


def neighborhoods():
    """List of areas in this mission, with household counts."""
    return list(_neighborhoods)


def place_hub(site):
    """Put a pickup hub at a site. Accepts a Site, or a site's name or id in quotes."""
    found = _find_site(site)
    if len(_actions) >= MAX_ACTIONS:
        raise CityError("That is a lot of hubs! Stop after a few. Is a loop placing too many?")
    _actions.append({"type": "place_hub", "siteId": found.id, "line": _student_line()})
    return found


def _find_site(site):
    if isinstance(site, Site):
        return site
    if isinstance(site, (list, tuple, set)):
        raise CityError(
            "place_hub wants ONE place at a time, but you gave it a whole list. "
            "Use a for loop: for place in places: city.place_hub(place)")
    if isinstance(site, str):
        text = site.strip()
        for s in _sites:
            if s.id == text:
                return s
        lowered = text.lower()
        exact = [s for s in _sites if s.name.lower() == lowered]
        if len(exact) >= 1:
            return exact[0]
        partial = [s for s in _sites if lowered and lowered in s.name.lower()]
        if len(partial) == 1:
            return partial[0]
        names = [s.name for s in _sites]
        close = difflib.get_close_matches(text, names, n=1, cutoff=0.5)
        if close:
            raise CityError("I can't find a place called \"%s\". Did you mean \"%s\"?" % (site, close[0]))
        raise CityError(
            "I can't find a place called \"%s\". Try printing city.sites() to see the names." % (site,))
    raise CityError(
        "place_hub needs a place, like one from city.sites(). I got %s instead." % _kind_of(site))


def _kind_of(x):
    if x is None:
        return "None (nothing)"
    return "a " + type(x).__name__


def _student_line():
    """Find the line number in the student's code that made this call."""
    f = sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == STUDENT_FILE:
            return f.f_lineno
        f = f.f_back
    return None


# --------------------------------------------------------------------------
# Called by the worker
# --------------------------------------------------------------------------

def _setup(json_text):
    data = json.loads(json_text)
    _sites[:] = [Site(d) for d in data.get("sites", [])]
    _stores[:] = [Store(d) for d in data.get("stores", [])]
    _neighborhoods[:] = [Neighborhood(d) for d in data.get("neighborhoods", [])]
    del _actions[:]


def _public_attrs(obj):
    try:
        return [a for a in dir(obj) if not a.startswith("_")]
    except Exception:
        return []


def _error_info(exc, ns):
    """Describe an exception as plain data the page can translate into words."""
    import traceback

    # Last traceback frame that is the student's own code = the line to point at.
    line = None
    tb = exc.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == STUDENT_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next

    info = {
        "type": type(exc).__name__,
        "message": str(exc),
        "line": line,
    }

    if isinstance(exc, SyntaxError):
        info["line"] = exc.lineno
        info["offset"] = exc.offset
        info["text"] = (exc.text or "").rstrip("\n")
        info["message"] = exc.msg or str(exc)
        # Python names these differently; the page treats them alike.
        info["type"] = type(exc).__name__
        info["traceback"] = "%s: %s (line %s)" % (info["type"], info["message"], exc.lineno)
        return info

    if isinstance(exc, NameError):
        info["name"] = getattr(exc, "name", None)
        names = set(ns.keys()) | {n for n in dir(builtins) if not n.startswith("_")}
        info["candidates"] = sorted(n for n in names if not n.startswith("_"))
    elif isinstance(exc, AttributeError):
        info["name"] = getattr(exc, "name", None)
        obj = getattr(exc, "obj", None)
        if obj is not None:
            info["candidates"] = _public_attrs(obj)
            info["objType"] = type(obj).__name__
            if info["objType"] == "module":
                info["objType"] = "module:" + getattr(obj, "__name__", "")

    # A trimmed traceback: only student frames, like Python's own.
    lines = ["Traceback (most recent call last):"]
    for fs in traceback.extract_tb(exc.__traceback__):
        if fs.filename == STUDENT_FILE:
            lines.append('  File "<student>", line %s' % fs.lineno)
            if fs.line:
                lines.append("    " + fs.line)
    lines.append("%s: %s" % (type(exc).__name__, exc))
    info["traceback"] = "\n".join(lines)
    return info


def _run(code):
    """Run the student's code. Returns a JSON string: {ok, actions} or {ok: False, error}."""
    del _actions[:]
    this_module = sys.modules[__name__]
    ns = {"__name__": "__main__", "city": this_module}
    try:
        compiled = compile(code, STUDENT_FILE, "exec")
        exec(compiled, ns)
    except SystemExit:
        pass  # exit() just means "stop here"
    except BaseException as exc:  # noqa: B902 - we want everything, including KeyboardInterrupt
        return json.dumps({"ok": False, "error": _error_info(exc, ns)})
    return json.dumps({"ok": True, "actions": list(_actions)})
