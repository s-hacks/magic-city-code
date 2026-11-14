import { describe, expect, it } from "vitest";
import { generateMission } from "../src/generator";
import { loadCity } from "../src/city";
import { Store } from "../src/store";
import { validateMission } from "../src/validate";
import { city as fixtureCity } from "./fixtures";

const SHOWCASE: [string, string, string, number][] = [
  ["There's no grocery store near West End, and I don't have a car.", "west-end", "households_no_car", 5],
  ["My kids can't do their homework online at home.", "ensley", "households_no_internet", 5],
  ["On cold nights, where can people near me go to get warm?", "southside", "households_poverty", 5],
  ["With no Saturday bus, I can't get to the store on my day off.", "east-lake", "households_no_car", 5],
  ["The produce truck never comes to our side of the neighborhood.", "woodlawn", "households_no_car", 4],
];

describe("generator offline path (no Claude)", () => {
  const city = loadCity();
  const haveData = !!city.neighborhoods && !!city.sites;

  it.each(SHOWCASE)("%s", async (text, hood, need, placements) => {
    const store = new Store({ persistPath: null });
    const out = await generateMission({ text }, { store, claude: null, city: haveData ? city : undefined });
    expect(out.usedAI).toBe(false);
    expect(out.response.status).toBe("ok");
    if (out.response.status !== "ok") return;
    const m = out.response.mission;
    expect(out.response.source).toBe("fallback");
    expect(m.area.neighborhood).toBe(hood);
    expect(m.needColumn).toBe(need);
    expect(Math.max(...m.levels.map((l) => l.maxPlacements))).toBe(placements);
    expect(m.approved).toBe(false);
    expect(validateMission(m, haveData ? city : loadCity()).ok).toBe(true);
    expect(out.response.problem.status).toBe("mission");
    expect(store.getMission(m.id)).toBeDefined();
  });

  it("says unsupported for a water bill and saves the card as needs_new_type", async () => {
    const store = new Store({ persistPath: null });
    const out = await generateMission({ text: "My water bill is wrong" }, { store, claude: null });
    expect(out.response.status).toBe("unsupported");
    expect(out.response.problem.status).toBe("needs_new_type");
    expect(store.listProblems().some((p) => p.id === out.response.problem.id)).toBe(true);
  });

  it("scrubs the resident's words before saving", async () => {
    const store = new Store({ persistPath: null });
    const out = await generateMission(
      { text: "My name is Ann Lee, call 205-555-1234. No grocery store near me." },
      { store, claude: null, city: fixtureCity },
    );
    expect(out.response.problem.text).not.toMatch(/Ann|555/);
    if (out.response.status === "ok") expect(out.response.mission.residentQuote).not.toMatch(/Ann|555/);
  });

  it("honors a requested neighborhood", async () => {
    const store = new Store({ persistPath: null });
    const out = await generateMission({ text: "No grocery store and no car.", neighborhood: "test-town" }, { store, claude: null, city: fixtureCity });
    expect(out.response.status).toBe("ok");
    if (out.response.status === "ok") expect(out.response.mission.area.neighborhood).toBe("test-town");
  });
});
