// A tiny made-up city and mission for tests. Not real data.
import type { Mission } from "@mcc/shared";
import type { CityData } from "../src/city";

export const city: CityData = {
  neighborhoods: [{ id: "test-town", name: "Test Town", bbox: [-1, -1, 1, 1], center: [0, 0] }],
  areas: [
    { id: "a1", neighborhood: "test-town", center: [0, 0], polygon: [], households: 100, households_no_car: 30, kids: 40, seniors: 20, households_poverty: 25, households_no_internet: 15 },
  ],
  sites: [
    { id: "s1", name: "Church A", kind: "church", lat: 0.1, lon: 0.1 },
    { id: "s2", name: "Church B", kind: "church", lat: 0.2, lon: 0.2 },
    { id: "s3", name: "Church C", kind: "church", lat: 0.3, lon: 0.3 },
    { id: "s4", name: "School A", kind: "school", lat: -0.1, lon: -0.1 },
    { id: "s5", name: "Far Church", kind: "church", lat: 5, lon: 5 },
  ],
};

export const SOLUTION = `places = city.sites(kind="church")\nfor place in places[:3]:\n    city.place_hub(place)\n`;

export function mission(): Mission {
  return {
    id: "test-mission",
    title: "Feed Test Town",
    story: "Test Town needs food close by.",
    residentQuote: "No store near me.",
    partner: "Jones Valley Teaching Farm",
    type: "coverage",
    area: { neighborhood: "test-town", bbox: [-1, -1, 1, 1] },
    thing: "pickup hub",
    siteKinds: ["church", "school"],
    needColumn: "households_no_car",
    walkMinutes: 10,
    levels: [
      {
        number: 2,
        title: "Three hubs",
        concept: "Loops",
        instructions: "Place a hub at each of the first three churches.",
        goal: { metric: "coverage", target: 0.3 },
        maxPlacements: 3,
        starterCode: `places = city.sites(kind="church")\nfor place in places[:3]:\n    pass\n`,
        solution: SOLUTION,
        hints: [
          "What should happen inside the loop?",
          "Replace pass with the line that places a hub.",
          "To water each plant in a row: for plant in row: water(plant).",
        ],
      },
    ],
    source: { kind: "seed", text: "No store near me." },
    approved: true,
  };
}
