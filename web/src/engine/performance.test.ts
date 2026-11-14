// Speed check on a made-up city the size of Birmingham's mission areas:
// 200 blocks, 600 candidate sites, 40 stores. Repeated runs should be well under 50 ms.
import { describe, expect, it } from "vitest";
import type { Action, CityData, LonLat } from "@mcc/shared";
import { describeSites, simulate } from "./index";
import { makeMission } from "./fixtures.test-helpers";

function bigCity(): CityData {
  const areas: CityData["areas"] = [];
  for (let i = 0; i < 200; i++) {
    const center: LonLat = [-87 + (i % 20) * 0.005, 33 + Math.floor(i / 20) * 0.005];
    const h = 0.002;
    areas.push({
      id: `A${i}`,
      neighborhood: "test-hood",
      center,
      polygon: [[[center[0] - h, center[1] - h], [center[0] + h, center[1] - h], [center[0], center[1] + h]]],
      households: 300,
      households_no_car: 20 + (i % 7) * 10,
      kids: 100,
      seniors: 50,
      households_poverty: 30,
      households_no_internet: 20,
    });
  }
  const sites: CityData["sites"] = [];
  for (let i = 0; i < 600; i++) {
    sites.push({ id: `site_${i}`, name: `Site ${i}`, kind: "church", lat: 33 + (i % 30) * 0.0016, lon: -87 + Math.floor(i / 30) * 0.005 });
  }
  const stores: CityData["stores"] = [];
  for (let i = 0; i < 40; i++) stores.push({ id: `store_${i}`, name: `Store ${i}`, lat: 32.9 + i * 0.01, lon: -87.2 + i * 0.01 });
  return { areas, sites, stores, neighborhoods: [] };
}

describe("performance", () => {
  it("first run and repeated runs are fast", () => {
    const city = bigCity();
    const mission = makeMission({ id: "big", area: { neighborhood: "test-hood", bbox: [-87.01, 32.99, -86.89, 33.06] } });
    const level = { ...mission.levels[0], maxPlacements: 10 };
    mission.levels = [level];
    const actions: Action[] = describeSites(mission, city)
      .slice(0, 10)
      .map((s) => ({ type: "place_hub", siteId: s.id }));

    const t0 = performance.now();
    const first = simulate(mission, actions, city);
    const t1 = performance.now();
    for (let i = 0; i < 10; i++) simulate(mission, actions, city);
    const t2 = performance.now();
    const repeatMs = (t2 - t1) / 10;
    console.log(`first run ${(t1 - t0).toFixed(1)} ms, repeat ${repeatMs.toFixed(1)} ms, ${first.residents.length} dots`);
    expect(first.ok).toBe(true);
    expect(first.residents.length).toBeGreaterThan(2900);
    expect(repeatMs).toBeLessThan(50);
  });
});
