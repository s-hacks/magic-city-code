// Smoke test on the real Birmingham files in web/public/data/ (built by data/build.py).
// Skips quietly if the files have not been built yet.
import { describe, expect, it } from "vitest";
import type { CityData, Neighborhood } from "@mcc/shared";
import { baseline, describeSites } from "./index";
import { makeMission } from "./fixtures.test-helpers";

const FILES = ["areas", "stores", "sites", "neighborhoods"] as const;

async function loadCity(): Promise<CityData | null> {
  const fsName: string = "node:fs"; // loaded at runtime so the browser build never sees it
  const fs = await import(/* @vite-ignore */ fsName);
  const loaded: Record<string, unknown> = {};
  for (const name of FILES) {
    const url = new URL(`../../public/data/${name}.json`, import.meta.url);
    if (!fs.existsSync(url)) return null;
    loaded[name] = JSON.parse(fs.readFileSync(url, "utf8"));
  }
  return loaded as unknown as CityData;
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
      `west-end baseline: coverage ${(result.metrics.coverage * 100).toFixed(1)}% of ${result.metrics.needTotal} no-car households, ` +
        `avg walk ${result.metrics.avgWalkMinutes.toFixed(1)} min (est.), ${result.residents.length} dots, ${sites.length} sites, ${ms.toFixed(0)} ms`,
    );
    expect(result.metrics.coverage).toBeGreaterThanOrEqual(0);
    expect(result.metrics.coverage).toBeLessThanOrEqual(1);
  });
});
