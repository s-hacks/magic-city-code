// The part of "run student code" that is the same in the Web Worker and in Node tests.
// Takes an already-loaded Pyodide, installs the `city` module, runs code, returns plain data.
import type { PyodideInterface } from "pyodide";
import type { Action } from "@mcc/shared";
import type { ToWorker } from "./protocol";
import { translateError, type PyErrorInfo } from "./errors";

export type RunPayload = Pick<ToWorker, "sites" | "stores" | "neighborhoods">;

export type CoreResult =
  | { ok: true; actions: Action[] }
  | { ok: false; friendly: string; line?: number; raw: string };

/** At most this many printed lines per run, so a print-forever loop can't flood the page. */
export const MAX_STDOUT_LINES = 500;

/** Put the `city` module into Python (also importable as `import city`). */
export function installCity(pyodide: PyodideInterface, citySource: string) {
  pyodide.globals.set("_city_source", citySource);
  pyodide.runPython(`
import sys, types
_m = types.ModuleType("city")
_m.__file__ = "city.py"
exec(compile(_city_source, "city.py", "exec"), _m.__dict__)
sys.modules["city"] = _m
del _m, _city_source
`);
  return pyodide.pyimport("city");
}

/** Make a runner for one loaded Pyodide. Student code runs with fresh globals each time. */
export function createCore(pyodide: PyodideInterface, citySource: string) {
  const city = installCity(pyodide, citySource);
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

      try {
        city._setup(JSON.stringify(payload));
        const text: string = city._run(code);
        pyodide.runPython("import sys; sys.stdout.flush()");
        const out = JSON.parse(text) as
          | { ok: true; actions: Action[] }
          | { ok: false; error: PyErrorInfo & { traceback?: string } };
        if (out.ok) return { ok: true, actions: out.actions };
        const t = translateError(out.error);
        return { ok: false, friendly: t.friendly, line: t.line, raw: out.error.traceback ?? `${out.error.type}: ${out.error.message}` };
      } catch (e) {
        // Our own plumbing failed, not the student's code.
        const raw = e instanceof Error ? e.message : String(e);
        return { ok: false, friendly: "Something went wrong inside the code sandbox. Try pressing Run again.", raw };
      }
    },
  };
}
