// SAMPLE DATA for the "City problems" concept preview. Posters and solvers are made up;
// the problems are drawn from reports/Birmingham Alabama city problems.md.

export interface Practice {
  id: string;
  title: string;
  skills: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  neighborhood: string;
  blurb: string;
  open: 'challenge' | 'mission' | null; // null = coming soon
  solvedPct: number;
}

export const practice: Practice[] = [
  { id: 'route-to-fresh-food', title: 'Route to Fresh Food', skills: ['Graphs', 'Dijkstra', 'Heaps'], difficulty: 'Medium', neighborhood: 'Downtown · Woodlawn', blurb: 'Find the shortest walk from a school to a grocery store on real streets.', open: 'challenge', solvedPct: 41 },
  { id: 'water-bill-check', title: 'Water Bill Check', skills: ['Arrays', 'Loops', 'Streaks'], difficulty: 'Easy', neighborhood: 'East Lake · citywide', blurb: 'Flag water bills that repeat the same amount 3+ months, so families can ask for a real meter read.', open: 'challenge', solvedPct: 63 },
  { id: 'open-bed', title: 'Open Bed', skills: ['Hash maps', 'Sorting', 'Greedy'], difficulty: 'Medium', neighborhood: 'Downtown', blurb: 'Give out tonight\'s shelter beds by priority and distance, with pets and family rooms.', open: 'challenge', solvedPct: 37 },
  { id: 'stray-dog-van', title: 'Stray-Dog Van Route', skills: ['Graphs', 'Greedy', 'Heuristics'], difficulty: 'Hard', neighborhood: 'Downtown · Woodlawn', blurb: 'Plan one animal-control van\'s trip through today\'s stray-dog reports on real streets.', open: 'challenge', solvedPct: 22 },
  { id: 'feed-the-block', title: 'Feed the Block', skills: ['Loops', 'Sorting', 'Greedy'], difficulty: 'Easy', neighborhood: 'West End', blurb: 'Place 5 pickup hubs so the most families can walk to food.', open: 'mission', solvedPct: 68 },
  { id: 'homework-hotspots', title: 'Homework Hotspots', skills: ['Loops', 'Sorting', 'Greedy'], difficulty: 'Easy', neighborhood: 'Ensley', blurb: 'Place free Wi-Fi study spots near homes with no internet.', open: 'mission', solvedPct: 59 },
  { id: 'warm-nights', title: 'Warm Nights', skills: ['Loops', 'Sorting', 'Greedy'], difficulty: 'Easy', neighborhood: 'Southside', blurb: 'Open warming stations within a short walk of the most households in poverty.', open: 'mission', solvedPct: 52 },
  { id: 'saturday-shuttle', title: 'Saturday Shuttle', skills: ['Loops', 'Sorting', 'Greedy'], difficulty: 'Easy', neighborhood: 'East Lake', blurb: 'Saturday buses ended in 2026. Place shuttle stops for families with no car.', open: 'mission', solvedPct: 47 },
  { id: 'farm-stand-route', title: 'Farm Stand Route', skills: ['Loops', 'Sorting', 'Greedy'], difficulty: 'Easy', neighborhood: 'Woodlawn', blurb: 'Pick weekly produce-truck stops for the side of the neighborhood it never reaches.', open: 'mission', solvedPct: 44 },
];

export interface Solution {
  id: string;
  author: string;
  school: string;
  approach: string;
  skills: string[];
  metric: string;
  votes: number;
  chosen?: boolean;
  submitted: string;
}

export interface CityProblem {
  id: string;
  title: string;
  postedBy: string;
  posterKind: 'Resident' | 'Neighborhood group' | 'Nonprofit' | 'City department';
  neighborhood: string;
  summary: string;
  details: string;
  data: string;
  skills: string[];
  status: 'Open' | 'Reviewing' | 'Solved';
  reward: string;
  due: string;
  solutions: Solution[];
}

export const cityProblems: CityProblem[] = [
  {
    id: 'storm-drains', title: 'Which storm drains should crews clear first?', postedBy: 'Collegeville Neighbors (sample)', posterKind: 'Neighborhood group', neighborhood: 'North Birmingham',
    summary: 'About a third of the city’s storm inlets need repair. We get one crew day a week. Help us pick the order.',
    details: 'Rank the clogged inlets in our neighborhood so one crew day clears the ones that flood the most homes and bus stops. Use the 311 reports and street elevation.',
    data: '311 drain reports (CSV), inlet locations, street elevation',
    skills: ['Sorting', 'Hash maps', 'Data cleaning'], status: 'Reviewing', reward: 'Interview with a Shipt engineering team', due: 'Dec 1',
    solutions: [
      { id: 's1', author: 'maya_codes', school: 'Woodlawn High', approach: 'Count 311 reports per inlet with a dict, weight by homes downhill, sort descending.', skills: ['Hash maps', 'Sorting'], metric: 'Top 10 inlets cover 64% of flooded homes', votes: 41, chosen: true, submitted: '2 days ago' },
      { id: 's2', author: 'dre.py', school: 'Ramsay High', approach: 'Cluster reports by block, then greedy route so the crew clears the most inlets per hour.', skills: ['Greedy', 'Graphs'], metric: '18 inlets in one crew day', votes: 33, submitted: '3 days ago' },
      { id: 's3', author: 'jkim', school: 'ASFA', approach: 'Merged duplicate reports by address before ranking; found 22% were repeats.', skills: ['Strings', 'Hash maps'], metric: 'Removed 140 duplicate reports', votes: 19, submitted: '4 days ago' },
    ],
  },
  {
    id: 'water-bills', title: 'Spot water bills that look wrong', postedBy: 'Resident, East Lake', posterKind: 'Resident', neighborhood: 'East Lake',
    summary: 'Neighbors keep getting the exact same round-number bill for months. Find the accounts that look estimated, not read.',
    details: 'Given 12 months of (anonymized) bill amounts, flag accounts whose bills repeat the same round number 3+ months in a row so residents know to ask for a meter read.',
    data: 'Anonymized bill history (sample CSV)',
    skills: ['Arrays', 'Sliding window'], status: 'Open', reward: 'Featured on the Magic City Code leaderboard', due: 'Dec 8',
    solutions: [
      { id: 's1', author: 'tobi', school: 'Parker High', approach: 'Sliding window of 3 months; flag when all equal and divisible by 10.', skills: ['Sliding window'], metric: 'Flags 312 of 4,000 accounts', votes: 12, submitted: '1 day ago' },
    ],
  },
  {
    id: 'bus-shelters', title: 'Where do new bus shelters help the most kids?', postedBy: 'Ensley parent group (sample)', posterKind: 'Neighborhood group', neighborhood: 'Ensley',
    summary: 'Kids wait for the school bus in the rain. We can fund 4 shelters. Which stops?',
    details: 'Pick 4 stops that cover the most students, counting how long each waits on average.',
    data: 'Bus stops, student counts per stop, average wait times',
    skills: ['Greedy', 'Sorting'], status: 'Open', reward: 'Interview with a Shipt engineering team', due: 'Dec 12',
    solutions: [],
  },
  {
    id: 'stray-routes', title: 'Plan a stray-dog pickup route', postedBy: 'Animal control volunteer (sample)', posterKind: 'Nonprofit', neighborhood: 'Woodlawn',
    summary: 'Stray animals are the #1 complaint to 311. Plan one van’s route through today’s reports.',
    details: 'Order today’s sightings into one route that starts and ends at the shelter and visits the newest, most-reported spots first.',
    data: 'Sighting reports with time + location, street graph',
    skills: ['Graphs', 'Heuristics'], status: 'Solved', reward: 'Interview with a Shipt engineering team', due: 'Nov 10',
    solutions: [
      { id: 's1', author: 'ari_s', school: 'Jackson-Olin High', approach: 'Nearest-neighbor tour, then 2-opt swaps to remove crossings.', skills: ['Graphs', 'Heuristics'], metric: '31% shorter than the old route', votes: 58, chosen: true, submitted: 'Nov 8' },
      { id: 's2', author: 'maya_codes', school: 'Woodlawn High', approach: 'Priority queue by report age, then shortest path between stops.', skills: ['Heaps', 'Dijkstra'], metric: 'Newest reports reached 40 min sooner', votes: 37, submitted: 'Nov 7' },
    ],
  },
];

export const leaders = [
  { name: 'maya_codes', school: 'Woodlawn High', points: 1240, chosen: 3 },
  { name: 'ari_s', school: 'Jackson-Olin High', points: 1110, chosen: 2 },
  { name: 'dre.py', school: 'Ramsay High', points: 860, chosen: 1 },
  { name: 'jkim', school: 'ASFA', points: 620, chosen: 0 },
  { name: 'tobi', school: 'Parker High', points: 410, chosen: 0 },
];
export const INTERVIEW_AT = 1000; // points; ponytail: fixed threshold, the real rule is a product decision
