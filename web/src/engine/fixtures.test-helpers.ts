// A tiny made-up city for engine tests, small enough to check every number by hand.
// Everything sits on one north-south line (longitude -86.95), so distances are just
// latitude differences: 1 degree of latitude = 111,194.9 m.
import type { Area, CityData, LonLat, Mission } from "@mcc/shared";

export const METERS_PER_DEGREE_LAT = (6_371_000 * Math.PI) / 180;
/** Estimated walk for a pure north-south gap of `dLat` degrees. */
export function minutesForLat(dLat: number): number {
  return (Math.abs(dLat) * METERS_PER_DEGREE_LAT * 1.3) / 80;
}

const LON = -86.95;

function square(center: LonLat, half = 0.002): LonLat[][] {
  const [x, y] = center;
  return [[[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half], [x - half, y - half]]];
}

function area(id: string, lat: number, noCar: number, households: number, neighborhood: string | null): Area {
  const center: LonLat = [LON, lat];
  return {
    id,
    neighborhood,
    center,
    polygon: square(center),
    households,
    households_no_car: noCar,
    kids: noCar * 2,
    seniors: 0,
  };
}

export function makeCity(): CityData {
  return {
    areas: [
      area("A1", 33.01, 100, 10, "test-hood"), // 3.6 min from the store: covered from the start
      area("A2", 33.05, 200, 20, "test-hood"), // far from the store, next to S1
      area("A3", 33.08, 300, 30, "test-hood"), // far from the store, next to S2
      area("A4", 33.2, 1000, 1000, "other"), // outside the mission box: never counted
    ],
    stores: [{ id: "store_1", name: "Corner Market", lat: 33.012, lon: LON }],
    sites: [
      { id: "S1", name: "First Church", kind: "church", lat: 33.052, lon: LON },
      { id: "S2", name: "Hill Church", kind: "church", lat: 33.081, lon: LON },
      { id: "S3", name: "Oak School", kind: "school", lat: 33.05, lon: LON },
      { id: "S4", name: "Far Church", kind: "church", lat: 33.3, lon: LON },
    ],
    neighborhoods: [
      { id: "test-hood", name: "Test Hood", bbox: [-87, 33, -86.9, 33.1], center: [LON, 33.05] },
      { id: "other", name: "Other Place", bbox: [-87, 33.15, -86.9, 33.25], center: [LON, 33.2] },
    ],
  };
}

export function makeMission(overrides: Partial<Mission> = {}): Mission {
  const level = (number: number, maxPlacements: number, target: number) => ({
    number,
    title: `Level ${number}`,
    concept: "Calling a function",
    instructions: "Place hubs.",
    goal: { metric: "coverage" as const, target },
    maxPlacements,
    starterCode: "",
    solution: "",
    hints: ["a", "b", "c"],
  });
  return {
    id: "test-mission",
    title: "Feed the Test Block",
    story: "",
    residentQuote: "",
    partner: "Test Partner",
    type: "coverage",
    area: { neighborhood: "test-hood", bbox: [-87, 33, -86.9, 33.1] },
    thing: "pickup hub",
    siteKinds: ["church"],
    needColumn: "households_no_car",
    walkMinutes: 10,
    levels: [level(1, 1, 0.5), level(2, 2, 0.9)],
    source: { kind: "seed", text: "" },
    approved: true,
    ...overrides,
  };
}
