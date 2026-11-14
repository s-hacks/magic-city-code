// Web Worker that runs student Python with Pyodide. It never touches the map or the DOM:
// it takes code plus city data, and sends back a list of actions (or a friendly error).
//
// Pyodide files are served from /pyodide/ (copied there by scripts/copy-pyodide.mjs),
// so this works with no internet at the venue.
import { loadPyodide } from "pyodide";
import citySource from "./city.py?raw";
import { createCore } from "./core";
import type { FromWorker, ToWorker } from "./protocol";

const ctx = self as unknown as {
  postMessage(message: FromWorker): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

const send = (m: FromWorker) => ctx.postMessage(m);

let core: ReturnType<typeof createCore> | null = null;
let queued: ToWorker | null = null; // a run that arrived before Python finished loading

async function start() {
  try {
    send({ type: "loading", message: "Waking up Python...", progress: 0.1 });
    const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
    const pyodide = await loadPyodide({ indexURL: `${base}pyodide/` });
    send({ type: "loading", message: "Teaching Python about the city...", progress: 0.9 });
    core = createCore(pyodide, citySource);
    send({ type: "ready" });
    if (queued) {
      const m = queued;
      queued = null;
      run(m);
    }
  } catch (e) {
    send({ type: "load_error", message: e instanceof Error ? e.message : String(e) });
  }
}

function run(m: ToWorker) {
  if (!core) {
    queued = m;
    return;
  }
  const result = core.run(m.code, m, (text) => send({ type: "stdout", runId: m.runId, text }));
  if (result.ok) send({ type: "done", runId: m.runId, actions: result.actions });
  else send({ type: "error", runId: m.runId, friendly: result.friendly, line: result.line, raw: result.raw });
}

ctx.onmessage = (e) => {
  if (e.data.type === "run") run(e.data);
};

void start();
