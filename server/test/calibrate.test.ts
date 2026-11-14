// Calibration with REAL Pyodide and the real engine on the real city data.
// Slow-ish: the first Python load takes a second or two.
import { afterAll, describe, expect, it } from "vitest";
import type { Mission } from "@mcc/shared";
import { simulate } from "../../web/src/engine";
import { calibrateMission } from "../src/calibrate/calibrate";
import { PythonSandbox } from "../src/calibrate/sandbox";
import { engineData, loadCity, neighborhoodList } from "../src/city";
import { fallbackMission } from "../src/generator";
import { loadSeedMissions, Store } from "../src/store";

const city = loadCity();
const data = engineData(city);
const seeds = loadSeedMissions();
const sandbox = new PythonSandbox();
afterAll(() => sandbox.dispose());

const describeIfData = data && seeds.some((m) => m.id === "feed-the-block") ? describe : describe.skip;

describeIfData("calibration", () => {
  it("re-targets feed-the-block to Ensley and makes every level winnable but not free", async () => {
    const ensley = neighborhoodList(city).find((n) => n.id === "ensley")!;
    const seed = seeds.find((m) => m.id === "feed-the-block")!;
    const notes: string[] = [];
    const mission = await fallbackMission({
      classification: { supported: true, theme: "food", matched: [] },
      text: "No grocery store near Ensley.",
      target: ensley,
      city,
      store: new Store({ persistPath: null }),
      notes,
      sandbox,
    });
    expect(mission.area.neighborhood).toBe("ensley");
    expect(notes.join(" ")).toMatch(/calibrated in \d+ ms/);
    expect(notes.join(" ")).toContain(`seed "feed-the-block" moved to Ensley`);
    // Site names from West End were swapped for Ensley sites.
    expect(JSON.stringify(mission.levels)).not.toContain("West End Branch Library");

    for (let i = 0; i < mission.levels.length; i++) {
      const level = mission.levels[i];
      const sol = await sandbox.run(level.solution, payloadFor(mission));
      const start = await sandbox.run(level.starterCode, payloadFor(mission));
      expect(sol.ok && start.ok).toBe(true);
      if (!sol.ok || !start.ok) return;
      const won = simulate(mission, sol.actions, data!, i);
      const fromStart = simulate(mission, start.actions, data!, i);
      expect(won.goalMet).toBe(true); // the answer wins
      expect(fromStart.goalMet).toBe(false); // the starter code does not
      expect(level.goal.target).toBe(Math.floor(won.metrics.coverage * 100) / 100);
      expect(level.goal.target).toBeGreaterThan(won.metrics.baselineCoverage);
    }
    // Targets came from Ensley's numbers, not West End's.
    expect(mission.levels.map((l) => l.goal.target)).not.toEqual(seed.levels.map((l) => l.goal.target));
  }, 60_000);

  it("fails a level whose answer raises a Python error, and one whose starter already wins", async () => {
    const seed = seeds.find((m) => m.id === "feed-the-block")!;
    const broken: Mission = {
      ...seed,
      levels: [
        { ...seed.levels[0], solution: "city.place_hub(nope)\n" },
        { ...seed.levels[seed.levels.length - 1], starterCode: seed.levels[seed.levels.length - 1].solution },
      ],
    };
    const r = await calibrateMission(broken, data, sandbox);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/solution raises a Python error/);
    expect(r.errors.join("\n")).toMatch(/starterCode already reaches the goal/);
  }, 60_000);

  it("fails an answer that places nothing, and stops an endless loop", async () => {
    const seed = seeds.find((m) => m.id === "feed-the-block")!;
    const quick = new PythonSandbox(1000);
    try {
      const none = await calibrateMission({ ...seed, levels: [{ ...seed.levels[0], solution: "x = 1\n" }] }, data, quick);
      expect(!none.ok && none.errors.join()).toMatch(/places nothing/);
      const loop = await calibrateMission({ ...seed, levels: [{ ...seed.levels[0], solution: "while True:\n    pass\n" }] }, data, quick);
      expect(!loop.ok && loop.errors.join()).toMatch(/more than 1 seconds/);
    } finally {
      await quick.dispose();
    }
  }, 60_000);
});

import { describeSites, neighborhoodsSummary } from "../../web/src/engine";
function payloadFor(m: Mission) {
  return { sites: describeSites(m, data!), stores: data!.stores, neighborhoods: neighborhoodsSummary(m, data!) };
}
