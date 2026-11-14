/// <reference lib="webworker" />
// Generic Python runner. A challenge sends its harness (Python) + data once, then runs code against it.
// The harness must define __run(code, payload_json) -> json string.

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/';

type PyodideAPI = {
  globals: { set: (k: string, v: unknown) => void; get: (k: string) => (...a: unknown[]) => string };
  runPython: (code: string) => unknown;
};

const ready: Promise<PyodideAPI> = (async () => {
  const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`);
  return loadPyodide({ indexURL: PYODIDE });
})();

let loaded: string | null = null;

self.onmessage = async ({ data }: MessageEvent) => {
  try {
    const py = await ready;
    if (data.type === 'setup') {
      if (loaded !== data.id) {
        py.globals.set('DATA_JSON', data.data);
        py.runPython(data.harness);
        loaded = data.id;
      }
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'run') {
      const out = py.globals.get('__run')(data.code, JSON.stringify(data.payload));
      self.postMessage({ type: 'result', results: JSON.parse(out) });
    }
  } catch (e) {
    self.postMessage({ type: 'fatal', message: String(e) });
  }
};
