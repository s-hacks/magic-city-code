// Every number here is sourced from reports/Birmingham Alabama city problems.md
// or docs/implementation-plan.md. Do not invent figures.

export const city = {
  povertyRate: 24.7, // %, nearly double the metro's
  foodDesertShare: 70, // % of residents living in food deserts
  busOnTime: 58, // % bus on-time rate
  homicides: { y2024: 152, y2025: 88, y2026q3: 34 }, // 2026 = through Q3
  homicidesSamePoint: { y2024: 129, y2026: 34 }, // through Q3
  unsheltered: 400, // about, at any time
  homelessStudents: { y2025: 649, y2026: 777 },
  rentIncrease: 26, // % 2023–25
  renterBurden: 43, // % of renters spending > half their income on housing
  waterCallsPerDay: 4000,
  waterUnbilledShare: 50, // about half of water unbilled or leaked
  stormInlets: 27000,
  stormInletsNeedRepair: 9000, // about a third
  demolitionsSince2018: 2500,
};

export const homelessCounts = [
  { group: 'Chronically homeless', y2025: 506, y2026: 220 },
  { group: 'Youth 18–24', y2025: 136, y2026: 67 },
  { group: 'Veterans', y2025: 136, y2026: 74 },
  { group: 'Families', y2025: 92, y2026: 34 },
];

export const problems = [
  { id: 'water', name: 'Water utility', fact: '4,000+ calls a day; about half of water unbilled or leaked', trend: 'Worsening' },
  { id: 'housing', name: 'Homelessness', fact: '~400 unsheltered; 777 homeless students', trend: 'Counts down, visibility up' },
  { id: 'crime', name: 'Violent crime', fact: '34 homicides through Q3 2026 vs 129 in 2024', trend: 'Sharply improving' },
  { id: 'neglect', name: 'Neighborhood neglect', fact: 'Strays top 311; ~2,500 demolitions since 2018', trend: 'Flat' },
  { id: 'transit', name: 'Roads & transit', fact: '1 in 3 of 27,000 storm inlets need repair; buses 58% on time', trend: 'Paving budget cut' },
  { id: 'food', name: 'Food access', fact: '24.7% poverty; ~70% of residents in food deserts', trend: 'Slow improvement' },
] as const;

export const missions = [
  { id: 'feed-the-block', title: 'Feed the Block', kind: 'Coverage', place: 'West End', partner: 'Jones Valley Teaching Farm · Shipt', task: 'Place 5 grocery pickup hubs so the most families without a car live within a 10‑minute walk.', status: 'Playable' },
  { id: 'catch-the-bus', title: 'Catch the Bus', kind: 'Route', place: 'Ensley', partner: 'Ed Farm', task: 'Improve one bus route within a fixed budget.', status: 'Next' },
  { id: 'open-bed', title: 'Open Bed', kind: 'Match', place: 'Downtown', partner: 'Firehouse Ministries', task: 'Match people to open shelter beds (made-up data only).', status: 'Next' },
] as const;

export const levels = [
  { n: 1, concept: 'Calling a function', target: 25, code: 'church = city.site("Greater Hope Church")\ncity.place_hub(church)' },
  { n: 2, concept: 'Loops', target: 60, code: 'places = city.sites()\n\nfor place in places[:5]:\n    city.place_hub(place)' },
  { n: 3, concept: 'Sorting and choosing', target: 80, code: 'places = city.sites()\nbest = sorted(places,\n    key=lambda p: p.families_without_car,\n    reverse=True)\n\nfor place in best[:5]:\n    city.place_hub(place)' },
] as const;

export const partners = [
  { name: 'Ed Farm', role: 'The platform' },
  { name: 'Jones Valley Teaching Farm', role: 'Food mission' },
  { name: 'Firehouse Ministries', role: 'Shelter mission' },
  { name: 'Birmingham Promise', role: 'Student portfolio' },
] as const;

// The one loop (implementation-plan §1, §4)
export const loop = [
  { id: 'report', title: 'A resident reports', body: '“No grocery store near West End.” Typed in plain words.' },
  { id: 'generate', title: 'Claude writes the mission', body: 'AI fills a mission config: a place on the map, a goal, a score, starter code. It never writes engine code.' },
  { id: 'code', title: 'A student writes Python', body: 'A few lines in the browser. It runs in a sandboxed worker with a 5‑second limit.' },
  { id: 'simulate', title: 'simulate() scores it', body: 'Code only produces a list of actions. One pure function applies them: same inputs, same outputs.' },
  { id: 'light', title: 'The city lights up', body: 'Residents who can now reach what they need turn from ash to molten. The score is how much of the city is lit.' },
  { id: 'propose', title: 'A proposal goes back', body: 'One click makes a page with the student’s numbers, addressed to the resident and a partner.' },
] as const;
