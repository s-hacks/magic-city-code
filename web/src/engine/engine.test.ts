// Engine tests on a tiny hand-checked city (see fixtures.test-helpers.ts).
import { describe, expect, it } from "vitest";
import {
  baseline,
  describeSites,
  estimateWalkMinutes,
  missionAreas,
  neighborhoodsSummary,
  pointInPolygon,
  simulate,
  walkRadiusMeters,
} from "./index";
import type { Action } from "@mcc/shared";
import { makeCity, makeMission, minutesForLat } from "./fixtures.test-helpers";

const hub = (siteId: string, line?: number): Action => ({ type: "place_hub", siteId, line });

describe("walk estimate", () => {
  it("is straight-line distance x 1.3 at 80 m per minute", () => {
    const m = estimateWalkMinutes([-86.95, 33.0], [-86.95, 33.01]);
    expect(m).toBeCloseTo((1111.949 * 1.3) / 80, 2); // about 18.1 minutes
    expect(walkRadiusMeters(10)).toBeCloseTo(800 / 1.3, 6);
  });
});

describe("mission areas", () => {
  it("counts areas whose center is in the box", () => {
    const ids = missionAreas(makeMission(), makeCity()).map((a) => a.id);
    expect(ids).toEqual(["A1", "A2", "A3"]);
  });

  it("also counts areas tagged with the mission's neighborhood", () => {
    const city = makeCity();
    city.areas[3].neighborhood = "test-hood";
    expect(missionAreas(makeMission(), city).map((a) => a.id)).toEqual(["A1", "A2", "A3", "A4"]);
  });

  it("summarises neighborhoods with household counts", () => {
    const summary = neighborhoodsSummary(makeMission(), makeCity());
    expect(summary).toHaveLength(1);
    expect(summary[0].id).toBe("test-hood");
    expect(summary[0].households).toBe(60);
  });
});

describe("baseline", () => {
  it("zero actions equals the baseline", () => {
    const city = makeCity();
    const mission = makeMission();
    expect(simulate(mission, [], city)).toEqual(baseline(mission, city));
  });

  it("only A1 (100 of 600 no-car households) starts covered", () => {
    const result = baseline(makeMission(), makeCity());
    expect(result.ok).toBe(true);
    expect(result.metrics.needTotal).toBe(600);
    expect(result.metrics.needCovered).toBe(100);
    expect(result.metrics.coverage).toBeCloseTo(1 / 6, 10);
    expect(result.metrics.baselineCoverage).toBeCloseTo(1 / 6, 10);
    expect(result.metrics.helped).toBe(0);
    expect(result.goalMet).toBe(false);
    const expectedAvg = (100 * minutesForLat(0.002) + 200 * minutesForLat(0.038) + 300 * minutesForLat(0.068)) / 600;
    expect(result.metrics.avgWalkMinutes).toBeCloseTo(expectedAvg, 6);
  });
});

describe("placing hubs", () => {
  it("one hub at S1 covers A2: coverage 300/600 = 0.5", () => {
    const result = simulate(makeMission(), [hub("S1", 3)], makeCity());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.placed).toEqual([
      { siteId: "S1", name: "First Church", kind: "church", lat: 33.052, lon: -86.95, line: 3, order: 0 },
    ]);
    expect(result.metrics.coverage).toBeCloseTo(0.5, 10);
    expect(result.metrics.needCovered).toBe(300);
    expect(result.metrics.helped).toBe(200);
    expect(result.goalMet).toBe(true); // level 1 goal is 0.5
    // A1 still walks to the store, A2 to S1, A3 to S1 (closer than the store).
    const expectedAvg = (100 * minutesForLat(0.002) + 200 * minutesForLat(0.002) + 300 * minutesForLat(0.028)) / 600;
    expect(result.metrics.avgWalkMinutes).toBeCloseTo(expectedAvg, 6);
  });

  it("two hubs on level 2 cover everyone", () => {
    const result = simulate(makeMission(), [hub("S1"), hub("S2")], makeCity(), 1);
    expect(result.metrics.coverage).toBeCloseTo(1, 10);
    expect(result.metrics.helped).toBe(500);
    expect(result.goalMet).toBe(true);
    expect(result.placed.map((p) => p.order)).toEqual([0, 1]);
  });

  it("dots served by a hub point at it", () => {
    const result = simulate(makeMission(), [hub("S1")], makeCity());
    const a2 = result.residents.filter((r) => r.areaId === "A2");
    expect(a2.length).toBeGreaterThan(0);
    for (const dot of a2) {
      expect(dot.servedBy).toBe("S1");
      expect(dot.target).toEqual([-86.95, 33.052]);
      expect(dot.status).toBe("near");
    }
    const a1 = result.residents.filter((r) => r.areaId === "A1");
    for (const dot of a1) expect(dot.servedBy).toBeNull();
  });
});

describe("rules", () => {
  const city = makeCity();
  const mission = makeMission();

  it("too many hubs: keeps the first N and explains", () => {
    const result = simulate(mission, [hub("S1", 2), hub("S2", 3)], city, 0);
    expect(result.ok).toBe(false);
    expect(result.goalMet).toBe(false);
    expect(result.placed.map((p) => p.siteId)).toEqual(["S1"]);
    expect(result.metrics.coverage).toBeCloseTo(0.5, 10);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("too_many");
    expect(result.errors[0].line).toBe(3);
    expect(result.errors[0].message).toBe(
      "Line 3: You tried to place 2 pickup hubs, but this level allows only 1. I used only the first one.",
    );
  });

  it("duplicate site", () => {
    const result = simulate(mission, [hub("S1", 1), hub("S1", 2)], city, 1);
    expect(result.placed).toHaveLength(1);
    expect(result.errors.map((e) => e.code)).toEqual(["duplicate"]);
    expect(result.errors[0].message).toBe(
      "Line 2: You already put a pickup hub at First Church. Each place can only have one, so try a different spot.",
    );
  });

  it("unknown site", () => {
    const result = simulate(mission, [hub("site_nope", 4)], city);
    expect(result.placed).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ code: "unknown_site", line: 4, siteId: "site_nope" });
    expect(result.errors[0].message).toBe(
      'Line 4: I can\'t find a place called "site_nope". Try picking one from city.sites().',
    );
    expect(result.metrics.coverage).toBeCloseTo(1 / 6, 10);
  });

  it("site outside the mission area", () => {
    const result = simulate(mission, [hub("S4")], city);
    expect(result.errors[0].code).toBe("outside_area");
    expect(result.errors[0].message).toBe(
      "Far Church is outside the mission area. Pick a place inside the box on the map.",
    );
  });

  it("wrong kind of site", () => {
    const result = simulate(mission, [hub("S3", 5)], city);
    expect(result.errors[0].code).toBe("wrong_kind");
    expect(result.errors[0].message).toBe(
      "Line 5: Oak School is a school. In this mission a pickup hub can only go at churches.",
    );
    expect(result.placed).toHaveLength(0);
  });

  it("invalid actions are skipped but valid ones still count", () => {
    const result = simulate(mission, [hub("S3"), hub("S1")], city);
    expect(result.placed.map((p) => p.siteId)).toEqual(["S1"]);
    expect(result.metrics.coverage).toBeCloseTo(0.5, 10);
    expect(result.ok).toBe(false);
  });
});

describe("sites for Python", () => {
  it("lists only allowed kinds inside the box, with hand-checked numbers", () => {
    const sites = describeSites(makeMission(), makeCity());
    expect(sites.map((s) => s.id)).toEqual(["S1", "S2"]);
    const s1 = sites[0];
    expect(s1.families_nearby).toBe(200); // only A2 is within 10 minutes
    expect(s1.families_without_car).toBe(200);
    expect(s1.minutes_to_store).toBeCloseTo(Math.round(minutesForLat(0.04) * 10) / 10, 6);
  });

  it("families_nearby follows the need column", () => {
    const sites = describeSites(makeMission({ id: "kids", needColumn: "kids" }), makeCity());
    expect(sites[0].families_nearby).toBe(400); // A2 kids
    expect(sites[0].families_without_car).toBe(200);
  });
});

describe("resident dots", () => {
  it("are about 3,000, split by need, inside their block", () => {
    const city = makeCity();
    const result = baseline(makeMission(), city);
    const count = (id: string) => result.residents.filter((r) => r.areaId === id).length;
    expect(count("A1")).toBe(500);
    expect(count("A2")).toBe(1000);
    expect(count("A3")).toBe(1500);
    for (const dot of result.residents) {
      const area = city.areas.find((a) => a.id === dot.areaId)!;
      expect(pointInPolygon(dot.position, area.polygon)).toBe(true);
    }
    expect(result.residents.filter((r) => r.areaId === "A1").every((r) => r.status === "near")).toBe(true);
    expect(result.residents.filter((r) => r.areaId === "A3").every((r) => r.status === "far")).toBe(true);
  });

  it("are identical between runs, even with fresh data objects", () => {
    const first = simulate(makeMission(), [hub("S1")], makeCity());
    const second = simulate(makeMission(), [hub("S1")], makeCity());
    expect(second.residents).toEqual(first.residents);
    const before = baseline(makeMission(), makeCity());
    expect(before.residents.map((r) => r.position)).toEqual(first.residents.map((r) => r.position));
  });

  it("every area with need gets at least one dot", () => {
    const city = makeCity();
    city.areas[0].households_no_car = 1; // tiny next to the others: 3000 * 1 / 500,301 rounds to 0
    city.areas[1].households_no_car = 200_000;
    city.areas[2].households_no_car = 300_000;
    const result = baseline(makeMission(), city);
    expect(result.residents.filter((r) => r.areaId === "A1").length).toBe(1);
  });
});
