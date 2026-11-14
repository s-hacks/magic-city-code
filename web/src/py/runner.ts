// Main-thread side of the Python worker. One worker, re-created if code hangs past the hard limit.
export interface TestRun {
  id: string;
  events: number[]; // flat triples: kind (0 push, 1 pop, 2 expand), node, line
  result: { type: string; value: number[] | null; repr?: string } | null;
  error: { line: number; message: string } | null;
  timedOut: boolean;
  ms: number;
}

const HARD_KILL_MS = 12_000; // the harness stops itself at 3 s per test; this catches loops that never touch the graph

let worker: Worker | null = null;
let setupKey: string | null = null;
let setupMsg: { id: string; harness: string; data: string } | null = null;

function spawn() {
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  setupKey = null;
  return worker;
}

function call<T>(msg: object, expect: string, timeoutMs = 0): Promise<T> {
  const w = worker ?? spawn();
  return new Promise((resolve, reject) => {
    const timer = timeoutMs ? setTimeout(() => { w.terminate(); worker = null; reject(new Error('timeout')); }, timeoutMs) : 0;
    w.onmessage = ({ data }) => {
      clearTimeout(timer);
      if (data.type === expect) resolve(data);
      else reject(new Error(data.message ?? 'worker error'));
    };
    w.postMessage(msg);
  });
}

/** Load Pyodide + the challenge harness. Safe to call repeatedly. */
export async function setup(id: string, harness: string, data: string) {
  setupMsg = { id, harness, data };
  if (setupKey === id && worker) return;
  await call({ type: 'setup', ...setupMsg }, 'ready');
  setupKey = id;
}

export async function runPython(code: string, payload: object): Promise<TestRun[] | 'killed'> {
  if (setupMsg && setupKey !== setupMsg.id) await setup(setupMsg.id, setupMsg.harness, setupMsg.data);
  try {
    const r = await call<{ results: TestRun[] }>({ type: 'run', code, payload }, 'result', HARD_KILL_MS);
    return r.results;
  } catch (e) {
    if ((e as Error).message === 'timeout') {
      if (setupMsg) setup(setupMsg.id, setupMsg.harness, setupMsg.data).catch(() => {}); // warm a fresh worker
      return 'killed';
    }
    throw e;
  }
}
