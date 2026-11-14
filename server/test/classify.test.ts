// Checks the keyword fallback that picks a mission theme when there is no AI.
import { describe, expect, it } from "vitest";
import { classifyProblem } from "../src/classify";
import { themeSpec } from "../src/templates";

describe("keyword fallback classifier", () => {
  const cases: [string, string][] = [
    ["There's no grocery store near West End, and I don't have a car.", "food"],
    ["My kids can't do their homework online at home.", "homework"],
    ["On cold nights, where can people near me go to get warm?", "warming"],
    ["With no Saturday bus, I can't get to the store on my day off.", "transit"],
    ["The produce truck never comes to our side of the neighborhood.", "farmstand"],
    ["There's no safe playground for the kids after school.", "kids"],
    ["My grandma can't get to the pharmacy, lots of elderly folks here.", "seniors"],
  ];
  it.each(cases)("%s -> %s", (text, theme) => {
    const c = classifyProblem(text);
    expect(c.supported).toBe(true);
    if (c.supported) expect(c.theme).toBe(theme);
  });

  it("maps themes to the right need groups", () => {
    expect(themeSpec("food").needColumn).toBe("households_no_car");
    expect(themeSpec("homework").needColumn).toBe("households_no_internet");
    expect(themeSpec("warming").needColumn).toBe("households_poverty");
    expect(themeSpec("kids").needColumn).toBe("kids");
    expect(themeSpec("seniors").needColumn).toBe("seniors");
    expect(themeSpec("farmstand").placements).toBe(4);
  });

  it.each(["My water bill is wrong", "There are potholes everywhere on my street", "The street lights are out", "asdf"])(
    "%s -> unsupported",
    (text) => {
      const c = classifyProblem(text);
      expect(c.supported).toBe(false);
      if (!c.supported) expect(c.reason.length).toBeGreaterThan(10);
    },
  );
});
