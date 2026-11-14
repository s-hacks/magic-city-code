// Tests the runner's 5-second rule and one-run-at-a-time rule using a fake worker.
import { describe, expect, it } from "vitest";
import { createPythonRunner, CRASH_MESSAGE, TIMEOUT_MESSAGE, type WorkerLike } from "./runner";
import type { FromWorker, ToWorker } from "./protocol";

const payload = { sites: [], stores: [], neighborhoods: [] };

/** A fake worker. `behavior` decides what it does with each run message. */
function fakeWorkers(behavior: (m: ToWorker, reply: (r: FromWorker) => void) => void) {
  const made: (WorkerLike & { terminated: boolean })[] = [];
  const createWorker = () => {
    const w: WorkerLike & { terminated: boolean } = {
      terminated: false,
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage(m) {
        if (w.terminated) return;
        behavior(m, (r) => w.onmessage?.({ data: r }));
      },
      terminate() {
        w.terminated = true;
      },
    };
    made.push(w);
    setTimeout(() => w.onmessage?.({ data: { type: "ready" } }), 0);
    return w;
  };
  return { made, createWorker };
}

describe("createPythonRunner", () => {
  it("returns actions and collects stdout", async () => {
    const { createWorker } = fakeWorkers((m, reply) => {
      reply({ type: "stdout", runId: m.runId, text: "hi\n" });
      reply({ type: "done", runId: m.runId, actions: [{ type: "place_hub", siteId: "site_1", line: 2 }] });
    });
    const runner = createPythonRunner({ createWorker });
    await runner.ready;
    const chunks: string[] = [];
    const out = await runner.run("x", payload, { onStdout: (t) => chunks.push(t) });
    expect(out).toEqual({ ok: true, actions: [{ type: "place_hub", siteId: "site_1", line: 2 }], stdout: "hi\n" });
    expect(chunks).toEqual(["hi\n"]);
  });

  it("passes friendly errors through", async () => {
    const { createWorker } = fakeWorkers((m, reply) =>
      reply({ type: "error", runId: m.runId, friendly: "Line 3: oops", line: 3, raw: "NameError" }),
    );
    const runner = createPythonRunner({ createWorker });
    const out = await runner.run("x", payload);
    expect(out).toMatchObject({ ok: false, friendly: "Line 3: oops", line: 3 });
  });

  it("times out, kills the worker and starts a fresh one", async () => {
    let call = 0;
    const { made, createWorker } = fakeWorkers((m, reply) => {
      call++;
      if (call === 1) return; // first run never answers: an endless loop
      reply({ type: "done", runId: m.runId, actions: [] });
    });
    const runner = createPythonRunner({ createWorker, timeoutMs: 40 });
    await runner.ready;
    const started = Date.now();
    const out = await runner.run("while True: pass", payload);
    expect(Date.now() - started).toBeLessThan(500);
    expect(out).toMatchObject({ ok: false, friendly: TIMEOUT_MESSAGE, timedOut: true });
    expect(made).toHaveLength(2);
    expect(made[0].terminated).toBe(true);
    expect(made[1].terminated).toBe(false);

    // The fresh worker works.
    const again = await runner.run("pass", payload);
    expect(again.ok).toBe(true);
  });

  it("allows one run at a time", async () => {
    const { createWorker } = fakeWorkers(() => {});
    const runner = createPythonRunner({ createWorker, timeoutMs: 60 });
    const first = runner.run("a", payload);
    const second = await runner.run("b", payload);
    expect(second.ok).toBe(false);
    await first;
  });

  it("reports load errors", async () => {
    const createWorker = () => {
      const w: WorkerLike = { onmessage: null, onerror: null, postMessage() {}, terminate() {} };
      setTimeout(() => w.onmessage?.({ data: { type: "load_error", message: "no files" } }), 0);
      return w;
    };
    const runner = createPythonRunner({ createWorker });
    await expect(runner.ready).rejects.toThrow("no files");
    const out = await runner.run("x", payload);
    expect(out.ok).toBe(false);
  });

  it("reports status", async () => {
    const { createWorker } = fakeWorkers((m, reply) => reply({ type: "done", runId: m.runId, actions: [] }));
    const runner = createPythonRunner({ createWorker });
    const seen: string[] = [];
    runner.onStatus((s) => seen.push(s.state));
    await runner.run("x", payload);
    expect(seen).toEqual(["loading", "ready", "running", "ready"]);
  });

  it("restarts a worker that errors during a run", async () => {
    let call = 0;
    const { made, createWorker } = fakeWorkers((m, reply) => {
      call++;
      if (call === 1) made[0].onerror?.({ message: "boom" });
      else reply({ type: "done", runId: m.runId, actions: [] });
    });
    const runner = createPythonRunner({ createWorker, timeoutMs: 2000 });
    await runner.ready;
    const started = Date.now();
    const out = await runner.run("x", payload);
    expect(Date.now() - started).toBeLessThan(500); // not the 5 s endless-loop wait
    expect(out).toMatchObject({ ok: false, friendly: CRASH_MESSAGE });
    expect(made).toHaveLength(2);
    expect(made[0].terminated).toBe(true);
    expect((await runner.run("y", payload)).ok).toBe(true);
  });

  it("restarts a worker on messageerror too", async () => {
    let call = 0;
    const { made, createWorker } = fakeWorkers((m, reply) => {
      call++;
      if (call === 1) made[0].onmessageerror?.({});
      else reply({ type: "done", runId: m.runId, actions: [] });
    });
    const runner = createPythonRunner({ createWorker, timeoutMs: 2000 });
    const out = await runner.run("x", payload);
    expect(out).toMatchObject({ ok: false, friendly: CRASH_MESSAGE });
    expect(made).toHaveLength(2);
    expect((await runner.run("y", payload)).ok).toBe(true);
  });
});
