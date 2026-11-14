// Dev-harness only: a West End-ish synthetic city and a stand-in engine, used when
// the real data files or engine are missing. Not used by the app.
import type { Action, Area, CityData, Mission, PlacedHub, ResidentDot, Result, Site, SiteInfo, SiteKind } from "@mcc/shared";
import { SITE_KINDS } from "@mcc/shared";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HARNESS_BBOX: [number, number, number, number] = [-86.888, 33.467, -86.834, 33.506];

export function harnessMission(bbox = HARNESS_BBOX, neighborhood = "west-end"): Mission {
  return {
    id: "harness-feed-the-block",
    title: "Feed the Block",
    story: "No grocery store near West End.",
    residentQuote: "The closest store is two bus rides away.",
    partner: "Jones Valley Teaching Farm",
    type: "coverage",
    area: { neighborhood, bbox },
    thing: "pickup hub",
    siteKinds: [...SITE_KINDS],
    needColumn: "households_no_car",
    walkMinutes: 10,
    levels: [
      {
        number: 1,
        title: "Place hubs",
        concept: "Loops",
        instructions: "Place up to 5 hubs.",
        goal: { metric: "coverage", target: 0.6 },
        maxPlacements: 8,
        starterCode: "",
        solution: "",
        hints: ["a", "b", "c"],
      },
    ],
    source: { kind: "seed", text: "harness" },
    approved: true,
  } as Mission;
}

export function syntheticCity(): CityData {
  const r = rng(7);
  const [x0, y0, x1, y1] = HARNESS_BBOX;
  const nx = 8, ny = 6;
  const areas: Area[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const ax = x0 + ((x1 - x0) * i) / nx, ay = y0 + ((y1 - y0) * j) / ny;
      const bx = ax + (x1 - x0) / nx, by = ay + (y1 - y0) / ny;
      const hh = Math.round(200 + r() * 500);
      areas.push({
        id: `0107300${i}${j}`,
        neighborhood: "west-end",
        center: [(ax + bx) / 2, (ay + by) / 2],
        polygon: [[[ax, ay], [bx, ay], [bx, by], [ax, by], [ax, ay]]],
        households: hh,
        households_no_car: Math.round(hh * (0.1 + r() * 0.4)),
        kids: Math.round(hh * 0.6),
        seniors: Math.round(hh * 0.3),
        households_poverty: Math.round(hh * 0.3),
        households_no_internet: Math.round(hh * 0.2),
      });
    }
  const sites: Site[] = Array.from({ length: 28 }, (_, k) => ({
    id: `site_h${k}`,
    name: ["St. Paul Church", "Hope Baptist", "West End Library", "Parker School", "Elmwood Rec Center", "Mt. Zion Church", "Arlington School"][k % 7] + (k >= 7 ? ` ${Math.floor(k / 7) + 1}` : ""),
    kind: SITE_KINDS[k % 4] as SiteKind,
    lon: x0 + 0.003 + r() * (x1 - x0 - 0.006),
    lat: y0 + 0.003 + r() * (y1 - y0 - 0.006),
  }));
  return {
    areas,
    sites,
    stores: [
      { id: "store_a", name: "Food Giant", lat: 33.5035, lon: -86.838 },
      { id: "store_b", name: "Piggly Wiggly", lat: 33.469, lon: -86.886 },
      { id: "store_c", name: "Aldi", lat: 33.513, lon: -86.81 },
    ],
    neighborhoods: [{ id: "west-end", name: "West End", bbox: HARNESS_BBOX, center: [-86.861, 33.4865] }],
  };
}

const M_PER_MIN = 80;
const DETOUR = 1.3;
function meters(a: [number, number], b: [number, number]) {
  const dx = (a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (a[1] - b[1]) * 110540;
  return Math.hypot(dx, dy);
}

/** A rough stand-in for the real engine's simulate(), for visual checks only. */
export function fakeSimulate(mission: Mission, actions: Action[], data: CityData): Result {
  const r = rng(42);
  const walk = mission.walkMinutes;
  const siteById = new Map(data.sites.map((s) => [s.id, s]));
  const placed: PlacedHub[] = actions
    .map((a, order) => {
      const s = siteById.get(a.siteId);
      return s ? { siteId: s.id, name: s.name, kind: s.kind, lat: s.lat, lon: s.lon, line: a.line, order } : null;
    })
    .filter(Boolean) as PlacedHub[];
  const sources = [
    ...data.stores.map((s) => ({ id: null as string | null, p: [s.lon, s.lat] as [number, number] })),
    ...placed.map((h) => ({ id: h.siteId as string | null, p: [h.lon, h.lat] as [number, number] })),
  ];
  const residents: ResidentDot[] = [];
  let total = 0, covered = 0;
  const bbox = mission.area.bbox;
  const areas = data.areas.filter((a) => a.center[0] >= bbox[0] && a.center[0] <= bbox[2] && a.center[1] >= bbox[1] && a.center[1] <= bbox[3]);
  const allHh = areas.reduce((s, a) => s + a.households, 0) || 1;
  let id = 0;
  for (const a of areas) {
    const ring = a.polygon[0];
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const n = Math.max(1, Math.round((a.households / allHh) * 3000));
    for (let k = 0; k < n; k++) {
      const pos: [number, number] = [Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), Math.min(...ys) + r() * (Math.max(...ys) - Math.min(...ys))];
      let best = sources[0], bestD = Infinity;
      for (const s of sources) {
        const d = meters(pos, s.p);
        if (d < bestD) (bestD = d), (best = s);
      }
      const minutes = (bestD * DETOUR) / M_PER_MIN;
      const status = minutes <= walk ? "near" : minutes <= walk * 2 ? "mid" : "far";
      residents.push({ id: id++, areaId: a.id, position: pos, target: best.p, minutes, status, servedBy: best.id });
    }
    total += a.households_no_car;
  }
  const near = residents.filter((d) => d.status === "near").length;
  covered = Math.round((near / Math.max(1, residents.length)) * total);
  const coverage = covered / Math.max(1, total);
  const goal = mission.levels[0].goal.target;
  return {
    ok: true,
    errors: [],
    placed,
    residents,
    goalMet: coverage >= goal,
    walkRadiusMeters: (walk * M_PER_MIN) / DETOUR,
    metrics: { coverage, avgWalkMinutes: 0, needTotal: total, needCovered: covered, baselineCoverage: 0, helped: 0 },
  };
}

export function fakeDescribeSites(mission: Mission, data: CityData): SiteInfo[] {
  const radius = (mission.walkMinutes * M_PER_MIN) / DETOUR;
  return data.sites.map((s) => {
    const nearby = data.areas.filter((a) => meters(a.center, [s.lon, s.lat]) < radius);
    return {
      ...s,
      families_nearby: nearby.reduce((t, a) => t + a.households_no_car, 0),
      families_without_car: nearby.reduce((t, a) => t + a.households_no_car, 0),
      minutes_to_store: Math.min(...data.stores.map((st) => (meters([st.lon, st.lat], [s.lon, s.lat]) * DETOUR) / M_PER_MIN)),
    };
  });
}
