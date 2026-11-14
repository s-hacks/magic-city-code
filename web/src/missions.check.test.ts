// Checks every seed mission in web/public/data/missions/ against the real city data and real Pyodide:
// schema, starter code runs, solutions meet their goals, the level-2 loop does not meet the level-4 goal.
// Also prints the calibration table and the "one store vs five hubs" comparison for Feed the Block.
import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { readFileSync } from "node:fs";
import { loadPyodide } from "pyodide";
import { MissionSchema, type Action, type CityData, type FormerStore, type Mission } from "@mcc/shared";
import citySource from "./code/city.py?raw";
import { createCore, type CoreResult, type RunPayload } from "./code/core";
import { baseline, describeSites, neighborhoodsSummary, simulate } from "./engine";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), "utf8"));
const city: CityData = {
  areas: readJson("areas.json"),
  stores: readJson("stores.json"),
  sites: readJson("sites.json"),
  neighborhoods: readJson("neighborhoods.json"),
};
const index: { id: string }[] = readJson("missions/index.json");
const missions: Mission[] = index.map((m) => MissionSchema.parse(readJson(`missions/${m.id}.json`)));

const pct = (x: number) => (x * 100).toFixed(1) + "%";
let core: ReturnType<typeof createCore>;
const payloadFor = (m: Mission): RunPayload => ({
  sites: describeSites(m, city),
  stores: city.stores,
  neighborhoods: neighborhoodsSummary(m, city),
});
const runPy = (m: Mission, code: string): CoreResult => core.run(code, payloadFor(m), () => {});

const rows: string[][] = [];
const level2Actions = new Map<string, Action[]>();

describe("seed missions", () => {
  beforeAll(async () => {
    const indexURL = dirname(createRequire(import.meta.url).resolve("pyodide/package.json")) + "/";
    core = createCore(await loadPyodide({ indexURL }), citySource);
  }, 60_000);

  it("has the five missions in order, all seed and approved", () => {
    expect(index.map((m) => m.id)).toEqual(["feed-the-block", "homework-hotspots", "warm-nights", "saturday-shuttle", "farm-stand-route"]);
    for (const m of missions) {
      expect(m.source.kind).toBe("seed");
      expect(m.approved).toBe(true);
      expect(m.levels.map((l) => l.number)).toEqual([1, 2, 4]);
      const hood = city.neighborhoods.find((n) => n.id === m.area.neighborhood);
      expect(m.area.bbox).toEqual(hood?.bbox);
    }
  });

  for (const m of missions) {
    describe(m.id, () => {
      m.levels.forEach((level, i) => {
        it(`level ${level.number}: starter runs, solution meets the goal`, () => {
          const starter = runPy(m, level.starterCode);
          expect(starter.ok, starter.ok ? "" : (starter as { raw: string }).raw).toBe(true);

          const sol = runPy(m, level.solution);
          expect(sol.ok, sol.ok ? "" : (sol as { raw: string }).raw).toBe(true);
          if (!sol.ok) return;
          const result = simulate(m, sol.actions, city, i);
          expect(result.errors).toEqual([]);
          expect(result.goalMet).toBe(true);
          if (level.number === 2) level2Actions.set(m.id, sol.actions);
          const b = baseline(m, city, i).metrics;
          rows.push([
            m.id,
            String(level.number),
            pct(b.coverage),
            pct(result.metrics.coverage),
            pct(level.goal.target),
            `${Math.round(b.needCovered)} -> ${Math.round(result.metrics.needCovered)} of ${Math.round(b.needTotal)} households`,
          ]);
        });
      });

      it("level 1 names a real site inside the area", () => {
        const named = describeSites(m, city).filter((s) => m.levels[0].instructions.includes(s.name));
        expect(named.length).toBeGreaterThan(0);
      });

      it("the level-2 loop does not meet the level-4 target", () => {
        const actions = level2Actions.get(m.id);
        expect(actions).toBeDefined();
        const r = simulate(m, actions!, city, 2);
        expect(r.goalMet).toBe(false);
      });
    });
  }

  it("prints the calibration table", () => {
    console.log(
      "\nmission | level | baseline | solution | target | households reached\n" + rows.map((r) => r.join(" | ")).join("\n"),
    );
  });

  it("compares one new store at the old Save-A-Lot with five chosen hubs", () => {
    const m = missions.find((x) => x.id === "feed-the-block")!;
    const former: FormerStore[] = readJson("former_stores.json");
    const saveALot = former.find((f) => f.name === "Save-A-Lot")!;
    const withStore: CityData = { ...city, stores: [...city.stores, { id: saveALot.id, name: saveALot.name, lat: saveALot.lat, lon: saveALot.lon }] };
    const store = baseline(m, withStore, 2).metrics;
    const sol = runPy(m, m.levels[2].solution);
    if (!sol.ok) throw new Error(sol.raw);
    const hubs = simulate(m, sol.actions, city, 2).metrics;
    const base = baseline(m, city, 2).metrics;
    const line = (name: string, x: typeof store) =>
      `${name}: ${pct(base.coverage)} -> ${pct(x.coverage)}; ${Math.round(x.needCovered)} of ${Math.round(x.needTotal)} no-car households reached (${Math.round(x.needCovered - base.needCovered)} more than today)`;
    console.log("\nFeed the Block comparison\n" + line("One new store at old Save-A-Lot", store) + "\n" + line("Five hubs (level 4 solution)", hubs));
    expect(store.coverage).toBeGreaterThanOrEqual(0);
    expect(hubs.coverage).toBeGreaterThanOrEqual(0);
  });
});
