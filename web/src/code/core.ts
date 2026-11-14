// The part of "run student code" that is the same in the Web Worker and in Node tests.
// Takes an already-loaded Pyodide, installs the `city` module, runs code, returns plain data.
import type { PyodideInterface } from "pyodide";
import type { Action } from "@mcc/shared";
import type { ToWorker } from "./protocol";
import { translateError, type PyErrorInfo } from "./errors";

export type RunPayload = Pick<ToWorker, "sites" | "stores" | "neighborhoods">;

type CityProxy = { _setup(json: string): void; _run(code: string): string; destroy(): void };

export type CoreResult =
  | { ok: true; actions: Action[] }
  | { ok: false; friendly: string; line?: number; raw: string };

/** At most this many printed lines per run, so a print-forever loop can't flood the page. */
export const MAX_STDOUT_LINES = 500;

// Python helpers kept in their own namespace (not __main__), so student code can't reach them.
const HELPERS = `
import sys, types, builtins

# Things a student could change that would otherwise stick around until a page reload.
_builtins_snapshot = dict(builtins.__dict__)
_modules_snapshot = dict(sys.modules)
_sys_snapshot = {k: getattr(sys, k) for k in ("stdout", "stderr", "stdin", "path", "displayhook", "excepthook") if hasattr(sys, k)}
_recursion_limit = sys.getrecursionlimit()
_original_stdout = sys.stdout
# Modules city.py itself relies on: re-import them fresh each run.
_city_deps = ("json", "difflib", "traceback")

def restore():
    bd = builtins.__dict__
    for k in [k for k in bd if k not in _builtins_snapshot]:
        del bd[k]
    bd.update(_builtins_snapshot)
    for k in [k for k in sys.modules if k not in _modules_snapshot]:
        del sys.modules[k]
    sys.modules.update(_modules_snapshot)
    for k in _city_deps:
        sys.modules.pop(k, None)
    for k, v in _sys_snapshot.items():
        setattr(sys, k, v)
    sys.setrecursionlimit(_recursion_limit)

def install_city(source):
    m = types.ModuleType("city")
    m.__file__ = "city.py"
    exec(compile(source, "city.py", "exec"), m.__dict__)
    sys.modules["city"] = m
    return m

def flush():
    _original_stdout.flush()
`;

/** Make a runner for one loaded Pyodide. Every run starts from a clean Python: a fresh
 *  `city` module, original builtins and sys.modules, fresh globals for the student's code. */
export function createCore(pyodide: PyodideInterface, citySource: string) {
  const helperGlobals = pyodide.toPy({});
  pyodide.runPython(HELPERS, { globals: helperGlobals });
  const restore = helperGlobals.get("restore");
  const installCityModule = helperGlobals.get("install_city");
  const flush = helperGlobals.get("flush");

  // input() has nothing to read from here; make it fail fast with EOFError.
  pyodide.setStdin({ stdin: () => undefined });
  pyodide.setStderr({ batched: () => {} });

  return {
    run(code: string, payload: RunPayload, onStdout: (text: string) => void): CoreResult {
      let lines = 0;
      let capped = false;
      pyodide.setStdout({
        batched: (line: string) => {
          lines++;
          if (lines <= MAX_STDOUT_LINES) onStdout(line + "\n");
          else if (!capped) {
            capped = true;
            onStdout("(too much output, the rest is hidden)\n");
          }
        },
      });

      let city: CityProxy | null = null;
      try {
        restore();
        const mod: CityProxy = installCityModule(citySource);
        city = mod;
        mod._setup(JSON.stringify(payload));
        const text: string = mod._run(code);
        restore(); // undo anything the student changed, before the next run
        flush();
        const out = JSON.parse(text) as
          | { ok: true; actions: Action[] }
          | { ok: false; error: PyErrorInfo & { traceback?: string } };
        if (out.ok) return { ok: true, actions: out.actions };
        const t = translateError(out.error);
        return { ok: false, friendly: t.friendly, line: t.line, raw: out.error.traceback ?? `${out.error.type}: ${out.error.message}` };
      } catch (e) {
        try {
          restore();
        } catch {
          /* ignore */
        }
        // Our own plumbing failed, not the student's code.
        const raw = e instanceof Error ? e.message : String(e);
        return { ok: false, friendly: "Something went wrong inside the code sandbox. Try pressing Run again.", raw };
      } finally {
        city?.destroy();
      }
    },
  };
}
