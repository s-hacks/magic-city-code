// Runs REAL Pyodide in Node with the trains harness: every level's solution must pass every test,
// the starter code must not, and common mistakes must get the right verdict.
import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadPyodide } from "pyodide";
import harness from "./harness.py?raw";
import { checkTrain, key, type TrainData, type TrainTest } from "./check";
import { trappedReach, trappedRoute, trappedUnderpass } from "./index";
import type { TestRun } from "../../py/runner";

const j = JSON.parse(readFileSync(resolve(__dirname, "../../../public/data/trains.json"), "utf8"));
const edgeLen = new Map<string, number>();
for (const [u, v, m] of j.edges) { edgeLen.set(key(u, v), m); edgeLen.set(key(v, u), m); }
const tag = (level: string) => j[level].map((t: object) => ({ ...t, level }));
const data = {
  ...j, graph: { nodes: j.nodes, edges: j.edges }, edgeLen,
  reach: tag("reach"), route: tag("route"), underpass: tag("underpass"),
  xname: new Map(j.crossings.map((c: { node: number; name: string }) => [c.node, c.name])),
} as TrainData;

let runPy: (code: string, payload: object) => TestRun[];
const verdicts = (ch: typeof trappedReach, code: string) => {
  const tests = ch.tests(data);
  const runs = runPy(code, ch.payload(tests, data, { flood: false }));
  return tests.map((t: TrainTest, i: number) => checkTrain(t, runs[i], data));
};

describe("Don't Get Trapped (Pyodide)", () => {
  beforeAll(async () => {
    const indexURL = dirname(createRequire(import.meta.url).resolve("pyodide/package.json")) + "/";
    const py = await loadPyodide({ indexURL });
    py.globals.set("DATA_JSON", JSON.stringify({ nodes: j.nodes, edges: j.edges, homes: j.homes }));
    py.runPython(harness);
    const run = py.globals.get("__run");
    runPy = (code, payload) => JSON.parse(run(code, JSON.stringify(payload)));
  }, 60_000);

  for (const ch of [trappedReach, trappedRoute, trappedUnderpass]) {
    it(`${ch.id}: the solution passes every test`, () => {
      const v = verdicts(ch, ch.solution);
      expect(v.filter((x) => !x.ok)).toEqual([]);
    });
    it(`${ch.id}: the starter code does not pass`, () => {
      expect(verdicts(ch, ch.starterCode).some((x) => !x.ok)).toBe(true);
    });
  }

  it("level 1 has both answers in its tests", () => {
    expect(new Set(data.reach.map((t) => t.expected))).toEqual(new Set([true, false]));
  });

  it("level 2: ignoring blocked drives through a train", () => {
    const v = verdicts(trappedRoute, trappedRoute.solution.replace("if neighbor in blocked:", "if False:"));
    expect(v[0].kind).toBe("closed");
  });

  it("level 3: picking the first crossing is worse somewhere, and a non-crossing is rejected", () => {
    expect(verdicts(trappedUnderpass, "def best_underpass(g, s, h, m, crossings):\n    return crossings[0]\n").some((x) => x.kind === "wrong")).toBe(true);
    expect(verdicts(trappedUnderpass, "def best_underpass(g, s, h, m, crossings):\n    return s\n")[0].title).toMatch(/not one of the crossings/);
  });

  it("wrong return types and crashes are reported in plain words", () => {
    expect(verdicts(trappedReach, "def can_reach(g, s, t, b):\n    return [s]\n")[0].kind).toBe("type");
    expect(verdicts(trappedRoute, "def rescue_route(g, s, t, b):\n    return nope\n")[0].kind).toBe("crash");
    expect(verdicts(trappedRoute, "x = 1\n")[0].detail).toMatch(/rescue_route/);
  });
});
