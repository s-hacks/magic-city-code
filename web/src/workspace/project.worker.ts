/// <reference lib="webworker" />
// Web Worker that runs a whole student project with Pyodide (served from /pyodide/, so it
// works offline). It takes the project's files and a mode ("run" or "tests"), streams print()
// output back line by line, then sends one result. It never touches the page.
import { loadPyodide } from "pyodide";
import runnerSource from "./runner.py?raw";

export type ToProjectWorker = { type: "run"; id: number; mode: "run" | "tests"; project: object };
export type FromProjectWorker =
  | { type: "ready" }
  | { type: "load_error"; message: string }
  | { type: "out"; id: number; stream: "out" | "err"; text: string }
  | { type: "done"; id: number; result: unknown }
  | { type: "fatal"; id: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const send = (m: FromProjectWorker) => ctx.postMessage(m);

let current = 0; // the run whose output is streaming now

const ready = (async () => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const py = await loadPyodide({ indexURL: `${base}pyodide/` });
  py.setStdout({ batched: (text: string) => send({ type: "out", id: current, stream: "out", text }) });
  py.setStderr({ batched: (text: string) => send({ type: "out", id: current, stream: "err", text }) });
  py.runPython(runnerSource);
  return py;
})();

ready.then(
  () => send({ type: "ready" }),
  (e) => send({ type: "load_error", message: e instanceof Error ? e.message : String(e) }),
);

ctx.onmessage = async ({ data }: MessageEvent<ToProjectWorker>) => {
  if (data.type !== "run") return;
  try {
    const py = await ready;
    current = data.id;
    const fn = py.globals.get("__ws_run") as (json: string, mode: string) => string;
    const out = fn(JSON.stringify(data.project), data.mode);
    send({ type: "done", id: data.id, result: JSON.parse(out) });
  } catch (e) {
    send({ type: "fatal", id: data.id, message: e instanceof Error ? e.message : String(e) });
  }
};
