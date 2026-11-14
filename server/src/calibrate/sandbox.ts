// A warm Python sandbox for the server: one worker thread running real Pyodide.
// Runs go one at a time. Each run has a hard time limit; if it is hit, the worker is killed
// (Pyodide can't be interrupted) and a fresh one starts loading in the background.
import { Worker } from "node:worker_threads";
import type { CoreResult, RunPayload } from "../../../web/src/code/core";
import type { FromPythonWorker, ToPythonWorker } from "./python-worker-impl";

export const RUN_TIMEOUT_MS = 3000;
export const LOAD_TIMEOUT_MS = 60_000;

export type SandboxResult = CoreResult | { ok: false; friendly: string; raw: string; timedOut: true; line?: undefined };

const WORKER_URL = new URL("./python-worker.mjs", import.meta.url);

export class PythonSandbox {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private chain: Promise<unknown> = Promise.resolve();
  private pending = new Map<number, (r: CoreResult) => void>();
  private busy = 0;
  lastLoadMs: number | null = null;

  constructor(private runTimeoutMs = RUN_TIMEOUT_MS) {}

  /** Start loading Pyodide now (safe to call many times). Resolves when it is ready. */
  warm(): Promise<void> {
    if (this.ready) return this.ready;
    const worker = new Worker(WORKER_URL);
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => fail(new Error("Python took too long to start")), LOAD_TIMEOUT_MS);
      const fail = (err: Error) => {
        clearTimeout(timer);
        if (this.worker === worker) this.reset();
        reject(err);
      };
      worker.on("message", (m: FromPythonWorker) => {
        if (m.type === "ready") {
          clearTimeout(timer);
          this.lastLoadMs = m.loadMs;
          this.idle();
          resolve();
        } else if (m.type === "load_error") fail(new Error(m.message));
        else if (m.type === "result") {
          this.pending.get(m.id)?.(m.result);
          this.pending.delete(m.id);
        }
      });
      worker.on("error", (err) => fail(err));
      worker.on("exit", () => {
        if (this.worker === worker) this.reset();
      });
    });
    this.ready.catch(() => {}); // callers see the error through run()
    return this.ready;
  }

  /** Run Python code with the city module. Never rejects for student-code problems. */
  run(code: string, payload: RunPayload): Promise<SandboxResult> {
    const job = this.chain.then(() => this.runNow(code, payload));
    this.chain = job.catch(() => {});
    return job;
  }

  private async runNow(code: string, payload: RunPayload): Promise<SandboxResult> {
    this.busy++;
    try {
      const ready = this.warm(); // creates the worker right away if needed
      this.worker?.ref(); // keep the process alive while we wait on it
      await ready;
      const worker = this.worker!;
      const id = this.nextId++;
      return await new Promise<SandboxResult>((resolve) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          // Kill the stuck worker and start a fresh one so the sandbox stays warm.
          this.reset();
          void worker.terminate();
          void this.warm();
          resolve({
            ok: false,
            friendly: `The code ran for more than ${this.runTimeoutMs / 1000} seconds. Is there a loop that never ends?`,
            raw: "timeout",
            timedOut: true,
          });
        }, this.runTimeoutMs);
        this.pending.set(id, (r) => {
          clearTimeout(timer);
          resolve(r);
        });
        worker.postMessage({ id, code, payload } satisfies ToPythonWorker);
      });
    } finally {
      this.busy--;
      this.idle();
    }
  }

  /** Let the process exit while nothing is running (the worker stays loaded). */
  private idle() {
    if (this.busy === 0) this.worker?.unref();
  }

  private reset() {
    this.worker = null;
    this.ready = null;
  }

  async dispose() {
    const w = this.worker;
    this.reset();
    await w?.terminate();
  }
}

let shared: PythonSandbox | null = null;
/** The server's one sandbox, created on first use. */
export function getSandbox(): PythonSandbox {
  shared ??= new PythonSandbox();
  return shared;
}
