// Page-side API for running student Python. Hides the Web Worker.
//
//   const runner = createPythonRunner();
//   runner.onStatus((s) => ...);            // loading / ready / running / error
//   const outcome = await runner.run(code, { sites, stores, neighborhoods });
//
// One run at a time. A run that lasts longer than 5 seconds is stopped by killing the
// worker (so an endless loop can never freeze the page) and a fresh worker is started.
import type { Action } from "@mcc/shared";
import type { RunPayload } from "./core";
import type { FromWorker, ToWorker } from "./protocol";

export const RUN_TIMEOUT_MS = 5000;
export const CRASH_MESSAGE = "Python had a problem and restarted. Press Run again.";
export const TIMEOUT_MESSAGE = "Your code ran for more than 5 seconds. Is there a loop that never ends?";

export type RunOutcome =
  | { ok: true; actions: Action[]; stdout: string }
  | { ok: false; friendly: string; line?: number; raw: string; stdout: string; timedOut?: boolean };

export type RunnerStatus =
  | { state: "loading"; message: string; progress?: number }
  | { state: "ready" }
  | { state: "running" }
  | { state: "error"; message: string }; // Python could not start

export interface RunOptions {
  /** Called with each chunk of printed text as it arrives. */
  onStdout?: (text: string) => void;
}

export interface PythonRunner {
  /** Resolves when Python has loaded the first time. Rejects if it cannot start. */
  ready: Promise<void>;
  /** Subscribe to status changes. Called once right away. Returns an unsubscribe function. */
  onStatus(cb: (status: RunnerStatus) => void): () => void;
  /** Run student code. Never rejects: problems come back as { ok: false, friendly, line }. */
  run(code: string, payload: RunPayload, options?: RunOptions): Promise<RunOutcome>;
  /** Stop the worker for good (for tests and page teardown). */
  dispose(): void;
}

/** The small slice of Worker we use, so tests can pass a fake one. */
export interface WorkerLike {
  postMessage(message: ToWorker): void;
  terminate(): void;
  onmessage: ((e: { data: FromWorker }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onmessageerror?: ((e: unknown) => void) | null;
}

export interface RunnerOptions {
  createWorker?: () => WorkerLike;
  timeoutMs?: number;
}

function defaultWorker(): WorkerLike {
  return new Worker(new URL("./python.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
}

export function createPythonRunner(options: RunnerOptions = {}): PythonRunner {
  const makeWorker = options.createWorker ?? defaultWorker;
  const timeoutMs = options.timeoutMs ?? RUN_TIMEOUT_MS;

  const listeners = new Set<(s: RunnerStatus) => void>();
  let status: RunnerStatus = { state: "loading", message: "Waking up Python..." };
  const setStatus = (s: RunnerStatus) => {
    status = s;
    listeners.forEach((cb) => cb(s));
  };

  let worker: WorkerLike;
  let workerReady: Promise<void>; // the current worker's load
  let disposed = false;
  let runId = 0;
  let busy = false;
  let current: ((m: FromWorker) => void) | null = null; // handler for the run in flight
  let onCrash: (() => void) | null = null; // ends the run in flight if the worker dies

  // `ready` is for the first load only.
  let resolveFirst!: () => void;
  let rejectFirst!: (e: Error) => void;
  const ready = new Promise<void>((res, rej) => {
    resolveFirst = res;
    rejectFirst = rej;
  });
  ready.catch(() => {}); // callers may ignore it; don't report an unhandled rejection

  function startWorker() {
    const w = makeWorker();
    worker = w;
    let loaded = false;
    setStatus({ state: "loading", message: "Waking up Python..." });
    workerReady = new Promise<void>((resolve, reject) => {
      w.onmessage = (e) => {
        if (w !== worker) return; // message from a worker we already killed
        const m = e.data;
        if (m.type === "loading") setStatus({ state: "loading", message: m.message, progress: m.progress });
        else if (m.type === "ready") {
          loaded = true;
          setStatus({ state: "ready" });
          resolve();
          resolveFirst();
        } else if (m.type === "load_error") {
          setStatus({ state: "error", message: m.message });
          reject(new Error(m.message));
          rejectFirst(new Error(m.message));
        } else current?.(m);
      };
      // A crashed worker is thrown away and replaced, so the next Run works.
      const crash = (ev: unknown) => {
        if (w !== worker) return;
        const message = (ev as { message?: string } | null)?.message || "The Python worker crashed.";
        w.terminate();
        if (!loaded) {
          // Died while starting up: report it instead of looping on restarts.
          setStatus({ state: "error", message });
          reject(new Error(message));
          rejectFirst(new Error(message));
          return;
        }
        if (!disposed) startWorker();
        onCrash?.();
      };
      w.onerror = crash;
      w.onmessageerror = crash;
    });
    workerReady.catch(() => {});
  }

  startWorker();

  function run(code: string, payload: RunPayload, opts: RunOptions = {}): Promise<RunOutcome> {
    if (disposed) return Promise.resolve(fail("The code sandbox was shut down.", "disposed", ""));
    if (busy) return Promise.resolve(fail("Still running your last code. Wait a moment.", "busy", ""));
    busy = true;

    return (async (): Promise<RunOutcome> => {
      try {
        await workerReady;
      } catch (e) {
        busy = false;
        return fail("Python could not start. Check your connection and reload the page.", String(e instanceof Error ? e.message : e), "");
      }
      if (disposed) {
        busy = false;
        return fail("The code sandbox was shut down.", "disposed", "");
      }

      const id = ++runId;
      const w = worker;
      let stdout = "";
      setStatus({ state: "running" });

      return new Promise<RunOutcome>((resolve) => {
        let finished = false;
        const finish = (outcome: RunOutcome) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          current = null;
          onCrash = null;
          busy = false;
          if (outcome.ok || !("timedOut" in outcome && outcome.timedOut)) {
            if (status.state === "running") setStatus({ state: "ready" });
          }
          resolve(outcome);
        };

        const timer = setTimeout(() => {
          // Kill the stuck worker, start a fresh one, and tell the student in plain words.
          w.terminate();
          if (!disposed) startWorker();
          finish({ ok: false, friendly: TIMEOUT_MESSAGE, raw: "TimeoutError: run took more than " + timeoutMs + " ms", stdout, timedOut: true });
        }, timeoutMs);

        onCrash = () => finish({ ok: false, friendly: CRASH_MESSAGE, raw: "WorkerCrash", stdout });

        current = (m) => {
          if (m.type === "stdout" && m.runId === id) {
            stdout += m.text;
            opts.onStdout?.(m.text);
          } else if (m.type === "done" && m.runId === id) {
            finish({ ok: true, actions: m.actions, stdout });
          } else if (m.type === "error") {
            finish({ ok: false, friendly: m.friendly, line: m.line, raw: m.raw, stdout });
          }
        };

        const msg: ToWorker = { type: "run", runId: id, code, ...payload };
        w.postMessage(msg);
      });
    })();
  }

  function fail(friendly: string, raw: string, stdout: string): RunOutcome {
    return { ok: false, friendly, raw, stdout };
  }

  return {
    ready,
    onStatus(cb) {
      listeners.add(cb);
      cb(status);
      return () => listeners.delete(cb);
    },
    run,
    dispose() {
      disposed = true;
      worker.terminate();
      listeners.clear();
    },
  };
}
