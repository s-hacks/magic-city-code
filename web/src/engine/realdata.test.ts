// Smoke test on the real Birmingham files in web/public/data/ (built by data/build.py).
// Prints the West End baseline, what reopening the former West End Save-A-Lot would add,
// and for each seed mission its baseline and the best a simple greedy pick reaches per level
// (handy for setting goal targets). Skips quietly if the files have not been built yet.
import { describe, expect, it } from "vitest";
import { MissionSchema, type Action, type CityData, type Mission, type Neighborhood, type Store } from "@mcc/shared";
import { baseline, describeSites, simulate } from "./index";
import { makeMission } from "./fixtures.test-helpers";

const FILES = ["areas", "stores", "sites", "neighborhoods"] as const;

async function loadJson(name: string): Promise<unknown | null> {
  const fsName: string = "node:fs"; // loaded at runtime so the browser build never sees it
  const fs = await import(/* @vite-ignore */ fsName);
  const url = new URL(`../../public/data/${name}`, import.meta.url);
  if (!fs.existsSync(url)) return null;
  return JSON.parse(fs.readFileSync(url, "utf8"));
}

async function loadCity(): Promise<CityData | null> {
  const loaded: Record<string, unknown> = {};
  for (const name of FILES) {
    const value = await loadJson(`${name}.json`);
    if (value === null) return null;
    loaded[name] = value;
  }
  return loaded as unknown as CityData;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Greedy: add whichever allowed site raises coverage most, up to `n` hubs. */
function greedyCoverage(mission: Mission, city: CityData, n: number, levelIndex: number): number {
  const sites = describeSites(mission, city);
  const chosen: Action[] = [];
  let best = baseline(mission, city, levelIndex).metrics.coverage;
  for (let k = 0; k < n; k++) {
    let pick: string | null = null;
    for (const site of sites) {
      if (chosen.some((a) => a.siteId === site.id)) continue;
      const c = simulate(mission, [...chosen, { type: "place_hub", siteId: site.id }], city, levelIndex).metrics.coverage;
      if (c > best + 1e-12) {
        best = c;
        pick = site.id;
      }
    }
    if (pick === null) break;
    chosen.push({ type: "place_hub", siteId: pick });
  }
  return best;
}

describe("real Birmingham data", () => {
  it("runs a West End baseline", async () => {
    const city = await loadCity();
    if (city === null) {
      console.log("real data not built yet; skipping smoke test");
      return;
    }
    const westEnd = city.neighborhoods.find((n: Neighborhood) => n.id === "west-end");
    if (westEnd === undefined) {
      console.log("no west-end neighborhood in neighborhoods.json; skipping smoke test");
      return;
    }
    const mission = makeMission({
      id: "smoke-west-end",
      area: { neighborhood: "west-end", bbox: westEnd.bbox },
      siteKinds: ["church", "school", "library", "community_center"],
    });
    const t0 = performance.now();
    const result = baseline(mission, city);
    const sites = describeSites(mission, city);
    const ms = performance.now() - t0;
    console.log(
      `west-end baseline: coverage ${pct(result.metrics.coverage)} of ${result.metrics.needTotal} no-car households, ` +
        `avg walk ${result.metrics.avgWalkMinutes.toFixed(1)} min (est.), ${result.residents.length} dots, ${sites.length} sites, ${ms.toFixed(0)} ms`,
    );
    expect(result.metrics.coverage).toBeGreaterThanOrEqual(0);
    expect(result.metrics.coverage).toBeLessThanOrEqual(1);

    const former = (await loadJson("former_stores.json")) as Store[] | null;
    if (former !== null && former.length > 0) {
      const reopened: CityData = { ...city, stores: [...city.stores, ...former] };
      const after = baseline(mission, reopened);
      console.log(
        `west-end with ${former.map((s) => s.name).join(", ")} reopened: coverage ${pct(after.metrics.coverage)}, ` +
          `+${(after.metrics.needCovered - result.metrics.needCovered).toFixed(0)} no-car households within 10 min`,
      );
    }
  });

  it("prints seed mission baselines and greedy best per level", async () => {
    const city = await loadCity();
    const index = (await loadJson("missions/index.json")) as { id: string }[] | null;
    if (city === null || index === null) {
      console.log("real data or missions not built yet; skipping");
      return;
    }
    for (const entry of index) {
      const raw = await loadJson(`missions/${entry.id}.json`);
      const parsed = MissionSchema.safeParse(raw);
      if (!parsed.success) {
        console.log(`${entry.id}: does not parse (${parsed.error.issues[0]?.message})`);
        continue;
      }
      const mission = parsed.data;
      const lines: string[] = [];
      for (const mode of ["stores", "none"] as const) {
        const m: Mission = { ...mission, existingSources: mode };
        const base = baseline(m, city);
        const levels = m.levels.map((level, i) => {
          const best = greedyCoverage(m, city, level.maxPlacements, i);
          return `L${level.number} max ${level.maxPlacements} target ${pct(level.goal.target)} greedy ${pct(best)}`;
        });
        lines.push(`  [${mode}${mode === mission.existingSources ? ", as in JSON" : ""}] baseline ${pct(base.metrics.coverage)}; ${levels.join("; ")}`);
      }
      console.log(`${mission.id} (${mission.area.neighborhood}, ${mission.needColumn}, ${describeSites(mission, city).length} sites)\n${lines.join("\n")}`);
    }
  }, 60_000);
});
