import { describe, expect, it } from "vitest";
import { looksLikePython, validateMission } from "../src/validate";
import { city, mission } from "./fixtures";

describe("validateMission", () => {
  it("accepts a good mission", () => {
    const r = validateMission(mission(), city);
    expect(r.ok).toBe(true);
  });

  it("rejects a schema problem", () => {
    const m = mission() as unknown as Record<string, unknown>;
    delete m.title;
    const r = validateMission(m, city);
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown neighborhood", () => {
    const m = mission();
    m.area.neighborhood = "atlantis";
    const r = validateMission(m, city);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/atlantis/);
  });

  it("rejects an area with too few candidate sites", () => {
    const m = mission();
    m.siteKinds = ["library"];
    const r = validateMission(m, city);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/at least 3/);
  });

  it("rejects too many placements and code asking for a kind with too few sites", () => {
    const m = mission();
    m.levels[0].maxPlacements = 9;
    const r = validateMission(m, city);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/maxPlacements 9/);
  });

  it("rejects starter code that does not use city", () => {
    const m = mission();
    m.levels[0].starterCode = "print('hello')";
    const r = validateMission(m, city);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/city\./);
  });

  it("rejects a hint that gives away the solution", () => {
    const m = mission();
    m.levels[0].hints[2] = "Just write: for place in places[:3]:\n    city.place_hub(place)";
    const r = validateMission(m, city);
    expect(r.ok).toBe(false);
  });

  it("skips data checks when data files are missing", () => {
    const r = validateMission(mission(), { ...city, areas: null, sites: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.length).toBe(2);
  });

  it("knows rough Python from not-Python", () => {
    expect(looksLikePython("for p in city.sites():\n    city.place_hub(p)")).toBe(true);
    expect(looksLikePython("city.place_hub(places[0]")).toBe(false);
    expect(looksLikePython("const x = city.sites();")).toBe(false);
    expect(looksLikePython("print('#1 spot')")).toBe(true);
  });
});
