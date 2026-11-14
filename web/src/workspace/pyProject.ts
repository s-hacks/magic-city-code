// Main-thread side of the project worker. One worker for the page. Runs go one at a time; a
// run that takes longer than HARD_LIMIT_MS (an endless loop) kills the worker, because
// Pyodide can't be interrupted, and a fresh one starts loading straight away.
import { useEffect, useState } from "react";
import type { Project } from "@mcc/shared";
import type { FromProjectWorker, ToProjectWorker } from "./project.worker";
import type { MapLayer } from "./mapData";

export const HARD_LIMIT_MS = 10_000;

export interface PyError {
  file: string | null;
  line: number | null;
  type: string;
  message: string;
  trace: string;
}
/** map: what the program drew with mapview (kept even when it crashed later). */
export interface RunResult { ok: boolean; ms: number; error?: PyError; map?: MapLayer[] }
export interface TestResult { name: string; file: string; line: number | null; ok: boolean; message?: string; ms: number }
export interface TestsResult { results: TestResult[]; passed: number; total: number; ms: number }
export type Outcome<T> = { kind: "done"; result: T } | { kind: "timeout" } | { kind: "failed"; message: string };

export type PyStatus = "loading" | "ready" | "failed";
type OnOut = (stream: "out" | "err", text: string) => void;

let worker: Worker | null = null;
let status: PyStatus = "loading";
let loadError = "";
const listeners = new Set<(s: PyStatus) => void>();
let nextId = 1;
let pending: { id: number; onOut: OnOut; resolve: (o: Outcome<unknown>) => void } | null = null;
let chain: Promise<unknown> = Promise.resolve();

function setStatus(s: PyStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}

function spawn(): Worker {
  const w = new Worker(new URL("./project.worker.ts", import.meta.url), { type: "module" });
  worker = w;
  setStatus("loading");
  w.onmessage = ({ data }: MessageEvent<FromProjectWorker>) => {
    if (w !== worker) return;
    if (data.type === "ready") setStatus("ready");
    else if (data.type === "load_error") { loadError = data.message; setStatus("failed"); }
    else if (pending && "id" in data && data.id === pending.id) {
      if (data.type === "out") pending.onOut(data.stream, data.text);
      else if (data.type === "done") { const p = pending; pending = null; p.resolve({ kind: "done", result: data.result }); }
      else if (data.type === "fatal") { const p = pending; pending = null; p.resolve({ kind: "failed", message: data.message }); }
    }
  };
  w.onerror = (e) => {
    if (w !== worker) return;
    loadError = e.message || "the Python worker crashed";
    if (pending) { const p = pending; pending = null; p.resolve({ kind: "failed", message: loadError }); }
    setStatus("failed");
  };
  return w;
}

/** Start loading Python now (safe to call many times). */
export function warmPython() {
  if (!worker) spawn();
}

export function pythonLoadError() {
  return loadError;
}

/** React hook: the worker's status, and starts loading it. */
export function usePyStatus(): PyStatus {
  const [s, setS] = useState(status);
  useEffect(() => {
    warmPython();
    setS(status);
    listeners.add(setS);
    return () => { listeners.delete(setS); };
  }, []);
  return s;
}

function runNow<T>(mode: "run" | "tests", project: Project, onOut: OnOut): Promise<Outcome<T>> {
  const w = worker ?? spawn();
  const id = nextId++;
  return new Promise<Outcome<T>>((resolve) => {
    const timer = setTimeout(() => {
      if (pending?.id !== id) return;
      pending = null;
      w.terminate();
      spawn(); // warm a fresh one for the next run
      resolve({ kind: "timeout" });
    }, HARD_LIMIT_MS);
    pending = {
      id,
      onOut,
      resolve: (o) => { clearTimeout(timer); resolve(o as Outcome<T>); },
    };
    const msg: ToProjectWorker = { type: "run", id, mode, project };
    w.postMessage(msg);
  });
}

function queue<T>(mode: "run" | "tests", project: Project, onOut: OnOut): Promise<Outcome<T>> {
  const job = chain.then(() => runNow<T>(mode, project, onOut));
  chain = job.catch(() => {});
  return job;
}

/** Run the project's entry file as __main__. */
export const runProject = (project: Project, onOut: OnOut) => queue<RunResult>("run", project, onOut);
/** Run every test_*.py in the project. */
export const testProject = (project: Project, onOut: OnOut) => queue<TestsResult>("tests", project, onOut);
