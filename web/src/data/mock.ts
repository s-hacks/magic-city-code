// MOCK DATA — placeholder until data/build.py produces public/data/*.json and the
// teammate's engine/API are ready. Shapes follow docs/implementation-plan.md §7–10.
// Coordinates are approximate; residents are synthetic clusters, not real households.

export type LngLat = [number, number];

export interface Site {
  id: string;
  name: string;
  kind: 'church' | 'school' | 'library' | 'rec center';
  at: LngLat;
  families_nearby: number;
  families_without_car: number;
}
export interface Place { id: string; name: string; at: LngLat }
export interface Resident { id: number; at: LngLat }

export interface Problem {
  id: string;
  label: string; // flare label
  quote: string;
  neighborhood: string;
  at: LngLat;
  missionId?: string; // only problems with a playable mission
}

export interface Level {
  n: number;
  concept: string;
  task: string;
  target: number; // coverage 0..1
  starterCode: string;
  solution: string; // demo keys 1/2/3
}

export interface Mission {
  id: string;
  title: string;
  story: string;
  partner: string;
  neighborhood: string;
  center: LngLat;
  walkMinutes: number;
  walkMeters: number;
  maxPlacements: number;
  hints: string[];
  levels: Level[];
}

export const BIRMINGHAM: LngLat = [-86.8104, 33.5186];

export const neighborhoods: Place[] = [
  { id: 'downtown', name: 'Downtown', at: [-86.8075, 33.5175] },
  { id: 'west-end', name: 'West End', at: [-86.8565, 33.4985] },
  { id: 'ensley', name: 'Ensley', at: [-86.8870, 33.5170] },
  { id: 'bush-hills', name: 'Bush Hills', at: [-86.8640, 33.5115] },
  { id: 'titusville', name: 'Titusville', at: [-86.8285, 33.4935] },
  { id: 'woodlawn', name: 'Woodlawn', at: [-86.7520, 33.5390] },
  { id: 'east-lake', name: 'East Lake', at: [-86.7140, 33.5640] },
  { id: 'north-bham', name: 'North Birmingham', at: [-86.8150, 33.5610] },
];

// Drawn from reports/Birmingham Alabama city problems.md
export const problems: Problem[] = [
  { id: 'food', label: 'No grocery store', quote: 'The closest real grocery store is two bus rides away. We buy dinner at the gas station.', neighborhood: 'West End', at: [-86.8565, 33.4985], missionId: 'feed-the-block' },
  { id: 'shelter', label: 'Not enough shelter beds', quote: 'On cold nights every bed downtown is full by 6 pm.', neighborhood: 'Downtown', at: [-86.8075, 33.5175] },
  { id: 'bus', label: 'Bus is always late', quote: 'I leave an hour early for a 20-minute ride because the bus might not come.', neighborhood: 'Ensley', at: [-86.8870, 33.5170] },
  { id: 'strays', label: 'Stray dog packs', quote: 'Kids can’t walk to the bus stop because of the dogs.', neighborhood: 'Woodlawn', at: [-86.7520, 33.5390] },
  { id: 'water', label: 'Water bills wrong', quote: 'Three months of the exact same round-number bill.', neighborhood: 'East Lake', at: [-86.7140, 33.5640] },
  { id: 'roads', label: 'Flooded streets', quote: 'Every storm, the drain on our corner backs up into the yard.', neighborhood: 'North Birmingham', at: [-86.8150, 33.5610] },
];

// --- synthetic geography around West End ---------------------------------
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(205);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

const M_PER_DEG = 111_320;
export function offset([lng, lat]: LngLat, dxM: number, dyM: number): LngLat {
  return [lng + dxM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180)), lat + dyM / M_PER_DEG];
}
export function distM(a: LngLat, b: LngLat) {
  const dx = (a[0] - b[0]) * M_PER_DEG * Math.cos((a[1] * Math.PI) / 180);
  const dy = (a[1] - b[1]) * M_PER_DEG;
  return Math.hypot(dx, dy);
}

const C: LngLat = [-86.8565, 33.4985];
const clusters: [number, number, number, number][] = [
  // dx, dy (m), sigma (m), weight
  [-900, 600, 380, 1.2], [300, 900, 320, 1], [1100, 200, 420, 1.1], [-300, -500, 300, 1.3],
  [700, -900, 360, 0.9], [-1500, -300, 330, 0.8], [200, 0, 260, 1.4], [-700, 1500, 380, 0.7],
];
const totalW = clusters.reduce((s, c) => s + c[3], 0);

export const residents: Resident[] = [];
for (const [dx, dy, s, w] of clusters) {
  const n = Math.round((w / totalW) * 2400);
  const cc = offset(C, dx, dy);
  for (let i = 0; i < n; i++) residents.push({ id: residents.length, at: offset(cc, gauss() * s, gauss() * s) });
}
for (let i = 0; i < 400; i++) residents.push({ id: residents.length, at: offset(C, (rand() - 0.5) * 4200, (rand() - 0.5) * 4000) });

export const HOUSEHOLDS_PER_DOT = 3;

export const stores: Place[] = [
  { id: 'store-1', name: 'Neighborhood Market', at: offset(C, 1300, 150) },
  { id: 'store-2', name: 'Discount Grocery', at: offset(C, -1450, -350) },
];

export const shelters: Place[] = [
  { id: 'shelter-1', name: 'Community Shelter (sample)', at: offset(C, 1600, 700) },
  { id: 'shelter-2', name: 'Family Shelter (sample)', at: offset(C, -400, 1200) },
];

const WALK_M = 650; // ~10 min walk, straight line ÷ 1.3

const siteSeeds: [string, Site['kind'], number, number][] = [
  // list order matters for Level 2 ("first five"): weaker sites come first, so sorting (Level 3) wins.
  ['Five Points W. Church', 'church', 900, 1300],
  ['Greater Hope Church', 'church', -900, 600],
  ['St. Paul Church', 'church', 1400, -400],
  ['Elyton School', 'school', -200, -1300],
  ['West End Library', 'library', 200, 0],
  ['Tuxedo Rec Center', 'rec center', -300, -500],
  ['Mt. Olive Church', 'church', 1100, 200],
  ['Princeton Elementary', 'school', 300, 900],
  ['New Bethel Church', 'church', 700, -900],
  ['Arlington School', 'school', -1500, -300],
  ['Grace Fellowship', 'church', -700, 1500],
  ['Westside Community Hall', 'rec center', -1300, 800],
];
export const sites: Site[] = siteSeeds.map(([name, kind, dx, dy], i) => {
  const at = offset(C, dx + gauss() * 60, dy + gauss() * 60);
  const nearby = residents.filter((r) => distM(r.at, at) < WALK_M).length * HOUSEHOLDS_PER_DOT;
  return { id: `site-${i + 1}`, name, kind, at, families_nearby: nearby, families_without_car: Math.round(nearby * (0.3 + rand() * 0.2)) };
});

export const mission: Mission = {
  id: 'feed-the-block',
  title: 'Feed the Block',
  story: 'The closest real grocery store is two bus rides away. We buy dinner at the gas station.',
  partner: 'Jones Valley Teaching Farm · Shipt',
  neighborhood: 'West End',
  center: C,
  walkMinutes: 10,
  walkMeters: WALK_M,
  maxPlacements: 5,
  hints: [
    'Every place in city.sites() has a number called families_without_car. Which places matter most?',
    'sorted() can put a list in order. Try sorting the places by families_without_car.',
    'You only get 5 hubs. A slice like best[:5] gives you the first five.',
  ],
  levels: [
    {
      n: 1, concept: 'Calling a function', task: 'Place one pickup hub at Greater Hope Church.', target: 0.25,
      starterCode: `# Level 1 · Calling a function\n# Put one pickup hub at a church.\n\nchurch = city.site("Greater Hope Church")\n\n`,
      solution: `# Level 1 · Calling a function\n# Put one pickup hub at a church.\n\nchurch = city.site("Greater Hope Church")\ncity.place_hub(church)\n`,
    },
    {
      n: 2, concept: 'Loops', task: 'Place hubs at the first five places on the list.', target: 0.6,
      starterCode: `# Level 2 · Loops\nplaces = city.sites()\n\nfor place in places[:5]:\n    # place a hub here\n    pass\n`,
      solution: `# Level 2 · Loops\nplaces = city.sites()\n\nfor place in places[:5]:\n    city.place_hub(place)\n`,
    },
    {
      n: 3, concept: 'Sorting and choosing', task: 'Pick the five places that help the most families.', target: 0.8,
      starterCode: `# Level 3 · Sorting and choosing\nplaces = city.sites()\n\n# pick the places with the most families who can't easily reach a store\nbest = places\n\nfor place in best[:5]:\n    city.place_hub(place)\n`,
      solution: `# Level 3 · Sorting and choosing\nplaces = city.sites()\n\n# pick the places with the most families who can't easily reach a store\nbest = sorted(places, key=lambda p: p.families_without_car, reverse=True)\n\nfor place in best[:5]:\n    city.place_hub(place)\n`,
    },
  ],
};

// --- coverage (UI-side stand-in for engine/simulate.ts) --------------------
export function litSet(hubs: LngLat[]): Set<number> {
  const sources = [...stores.map((s) => s.at), ...hubs];
  const lit = new Set<number>();
  for (const r of residents) if (sources.some((s) => distM(r.at, s) < WALK_M)) lit.add(r.id);
  return lit;
}
export const baseline = litSet([]);

export interface RunResult {
  ok: boolean;
  hubs: Site[];
  hubLines: number[]; // 1-based line that placed each hub (for the line highlight)
  output: string[];
  error?: { line: number; message: string };
}

// ponytail: regex fake of Pyodide + simulate(), just enough to drive the UI. Replace with the real worker.
export function fakeRun(code: string): RunResult {
  const lines = code.split('\n');
  const typo = lines.findIndex((l) => /\bplase_hub|place_hbu|palce_hub\b/.test(l));
  if (typo >= 0) {
    const word = lines[typo].match(/city\.(\w+)/)?.[1] ?? '';
    return { ok: false, hubs: [], hubLines: [], output: [], error: { line: typo + 1, message: `Line ${typo + 1}: Python doesn't know the word \`${word}\`. Did you mean \`place_hub\`?` } };
  }
  const callLine = lines.findIndex((l) => /^\s*city\.place_hub\(/.test(l)) + 1;
  if (!callLine) return { ok: true, hubs: [], hubLines: [], output: ['No hubs placed yet. Try city.place_hub(...)'] };

  const loop = code.match(/\[:\s*(\d+)\s*\]/);
  let picks: Site[];
  if (!loop) {
    const named = code.match(/city\.site\("([^"]+)"\)/)?.[1];
    picks = sites.filter((s) => s.name === named).slice(0, 1);
  } else {
    const n = Math.min(Number(loop[1]), mission.maxPlacements);
    const sorted = /sorted\(/.test(code) ? [...sites].sort((a, b) => b.families_without_car - a.families_without_car) : sites;
    picks = sorted.slice(0, n);
  }
  return { ok: true, hubs: picks, hubLines: picks.map(() => callLine), output: [`Placed ${picks.length} hub${picks.length === 1 ? '' : 's'}: ${picks.map((p) => p.name).join(', ')}`] };
}
