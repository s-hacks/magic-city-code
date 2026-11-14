// Runs inside a worker thread: loads real Pyodide once, installs the web app's city.py,
// and runs code on request. The main thread can kill this worker if a run takes too long,
// because Pyodide itself cannot be interrupted.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort } from "node:worker_threads";
import { createCore, type RunPayload } from "../../../web/src/code/core";
import { REPO_ROOT } from "../paths";

type Core = ReturnType<typeof createCore>;
type LoadPyodide = (opts: { indexURL: string }) => Promise<Parameters<typeof createCore>[0]>;

export type ToPythonWorker = { id: number; code: string; payload: RunPayload };
export type FromPythonWorker =
  | { type: "ready"; loadMs: number }
  | { type: "load_error"; message: string }
  | { type: "result"; id: number; result: ReturnType<Core["run"]> };

const port = parentPort!;
const PYODIDE_DIR = path.join(REPO_ROOT, "web/node_modules/pyodide");
const CITY_PY = path.join(REPO_ROOT, "web/src/code/city.py");

let core: Core | null = null;
const queue: ToPythonWorker[] = [];

function run(m: ToPythonWorker) {
  const result = core!.run(m.code, m.payload, () => {});
  port.postMessage({ type: "result", id: m.id, result } satisfies FromPythonWorker);
}

port.on("message", (m: ToPythonWorker) => {
  if (core) run(m);
  else queue.push(m);
});

try {
  const started = Date.now();
  const mod = (await import(pathToFileURL(path.join(PYODIDE_DIR, "pyodide.mjs")).href)) as { loadPyodide: LoadPyodide };
  const pyodide = await mod.loadPyodide({ indexURL: PYODIDE_DIR + "/" });
  core = createCore(pyodide, fs.readFileSync(CITY_PY, "utf8"));
  port.postMessage({ type: "ready", loadMs: Date.now() - started } satisfies FromPythonWorker);
  while (queue.length) run(queue.shift()!);
} catch (e) {
  port.postMessage({ type: "load_error", message: e instanceof Error ? e.message : String(e) } satisfies FromPythonWorker);
}
