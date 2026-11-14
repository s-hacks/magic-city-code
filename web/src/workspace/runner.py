# Runs a whole student project inside Pyodide (web worker). The worker calls
#   __ws_run(project_json, mode)  ->  json string
# mode "run":   writes every file to /home/pyodide/ws, then runs the entry file as __main__.
# mode "tests": writes the files, then runs every test_*.py and calls each test_* function.
# The project folder is the working directory and is on sys.path, so open("data/x.csv")
# and "from helpers import load" both work. Output streams through the worker's stdout hook.
import builtins, json, linecache, os, re, runpy, shutil, sys, time, traceback, importlib

ROOT = "/home/pyodide/ws"


def _no_input(*_args, **_kwargs):
    raise RuntimeError("input() can't ask for typing here. Put the value in your code or read it from a file in data/.")


builtins.input = _no_input


def _rel(filename):
    if filename and filename.startswith(ROOT + "/"):
        return filename[len(ROOT) + 1:]
    return None


def _write_project(project):
    # Forget modules loaded from the project last time, so edits to helper files take effect.
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None) or ""
        if f.startswith(ROOT + "/"):
            del sys.modules[name]
    os.chdir("/")  # can't delete the folder we're standing in
    if os.path.isdir(ROOT):
        shutil.rmtree(ROOT)
    os.makedirs(ROOT)
    for d in project.get("folders") or []:
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)
    for f in project["files"]:
        path = os.path.join(ROOT, f["path"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(f["content"])
    os.chdir(ROOT)
    while ROOT in sys.path:
        sys.path.remove(ROOT)
    sys.path.insert(0, ROOT)
    importlib.invalidate_caches()
    linecache.clearcache()


def _error(exc):
    """Where in the student's files it went wrong, plus a short trace of only their frames."""
    file, line = None, None
    if isinstance(exc, SyntaxError) and _rel(exc.filename):
        file, line = _rel(exc.filename), exc.lineno
    frames = [fr for fr in traceback.extract_tb(exc.__traceback__) if _rel(fr.filename)]
    if frames and file is None:
        file, line = _rel(frames[-1].filename), frames[-1].lineno
    trace = "".join(
        f'  {_rel(fr.filename)}, line {fr.lineno}, in {fr.name}\n' + (f"    {fr.line}\n" if fr.line else "")
        for fr in frames
    )
    message = str(exc)
    if isinstance(exc, AssertionError) and not message and frames:
        message = f"this check was false: {frames[-1].line}"
    if isinstance(exc, SyntaxError):
        message = exc.msg or message
    return {"file": file, "line": line, "type": type(exc).__name__, "message": message, "trace": trace}


def _run(project):
    entry = project.get("entry") or "main.py"
    t0 = time.monotonic()
    try:
        runpy.run_path(os.path.join(ROOT, entry), run_name="__main__")
        return {"ok": True, "ms": int((time.monotonic() - t0) * 1000)}
    except SystemExit as e:
        ok = e.code in (None, 0)
        return {"ok": ok, "ms": int((time.monotonic() - t0) * 1000), **({} if ok else {"error": {"file": None, "line": None, "type": "SystemExit", "message": f"the program stopped with exit code {e.code}", "trace": ""}})}
    except BaseException as e:  # noqa: BLE001 — every student error is reported, never raised
        return {"ok": False, "ms": int((time.monotonic() - t0) * 1000), "error": _error(e)}


_TEST_FILE = re.compile(r"(^|/)test_[^/]*\.py$")


def _tests(project):
    files = sorted(f["path"] for f in project["files"] if _TEST_FILE.search(f["path"]))
    results = []
    t_all = time.monotonic()
    for path in files:
        try:
            ns = runpy.run_path(os.path.join(ROOT, path), run_name="__test__")
        except BaseException as e:  # noqa: BLE001
            err = _error(e)
            results.append({"name": f"{path} (could not load)", "file": err["file"] or path, "line": err["line"], "ok": False, "message": f'{err["type"]}: {err["message"]}', "ms": 0})
            continue
        for name, fn in ns.items():
            if not (name.startswith("test_") and callable(fn)):
                continue
            t0 = time.monotonic()
            try:
                fn()
                results.append({"name": f"{path}::{name}", "file": path, "line": getattr(getattr(fn, "__code__", None), "co_firstlineno", None), "ok": True, "ms": int((time.monotonic() - t0) * 1000)})
            except BaseException as e:  # noqa: BLE001
                err = _error(e)
                msg = err["message"] if err["type"] == "AssertionError" else f'{err["type"]}: {err["message"]}'
                results.append({"name": f"{path}::{name}", "file": err["file"] or path, "line": err["line"], "ok": False, "message": msg, "ms": int((time.monotonic() - t0) * 1000)})
    passed = sum(1 for r in results if r["ok"])
    return {"results": results, "passed": passed, "total": len(results), "ms": int((time.monotonic() - t_all) * 1000)}


def __ws_run(project_json, mode):
    project = json.loads(project_json)
    _write_project(project)
    out = _tests(project) if mode == "tests" else _run(project)
    sys.stdout.flush()
    sys.stderr.flush()
    return json.dumps(out)
