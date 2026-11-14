// Open Bed: give out tonight's shelter beds fairly, by priority and distance. About 400 people
// sleep outside in Birmingham on a given night and the micro-shelters are full. People and bed
// counts are made up; shelters sit at real community buildings in Downtown Birmingham.
import { bedsCoachInfo } from '@mcc/shared';
import type { Challenge } from '../types';
import base from '../common/base.py?raw';
import specific from './harness.py?raw';
import { checkBeds, type BedsData, type BedsTest } from './check';
import { createBedsViz } from './viz';

const { starterCode, solution } = bedsCoachInfo;

export const bedsChallenge: Challenge<BedsData, BedsTest> = {
  id: 'open-bed',
  title: 'Open Bed',
  difficulty: 'Medium',
  neighborhood: 'Downtown',
  tags: ['Hash maps', 'Sorting', 'Greedy'],
  starterCode,
  solution,
  harness: `${base}\n${specific}`,
  legend: [['violet', 'shelter'], ['gold', 'got a bed'], ['red', 'waitlist'], ['orange', 'wrong answer']],
  ghostLabel: 'answer key',
  loading: 'Loading tonight\'s shelters…',
  intro: 'and watch each person get a bed, in priority order',
  accepted: 'Every open bed went to the person the rules say should get it.',

  async load() {
    const raw = await fetch('/data/open_bed.json').then((r) => r.text());
    return { raw, data: JSON.parse(raw) };
  },
  tests: (d) => d.tests,
  payload: (tests) => ({ tests: tests.map((t) => ({ id: t.id })) }),
  check: (t, run) => checkBeds(t, run),
  createViz: createBedsViz,

  Description: () => (
    <>
      <p>
        About <strong>400 people</strong> sleep outside in Birmingham on a given night, and the city's new micro-shelters are already full.
        On a freezing night, outreach workers have to decide fast who gets which open bed.
      </p>
      <p>Write <code>assign_beds(shelters, people)</code> to give out tonight's beds by these rules:</p>
      <ol>
        <li><strong>Highest priority first.</strong> Same priority: whoever arrived first.</li>
        <li>Each person gets the <strong>closest</strong> shelter that still has a bed of the kind they need, and allows pets if they have one. <code>city.distance(person, shelter)</code> gives meters.</li>
        <li>If nothing fits, they go on the waitlist: <code>None</code>.</li>
      </ol>
      <h4>Input</h4>
      <ul>
        <li><code>shelters</code>: <code>{'{"id", "name", "beds": {"men": 3, "women": 2, "family": 1}, "pets", "lat", "lon"}'}</code></li>
        <li><code>people</code>: <code>{'{"id", "needs": "men" | "women" | "family", "pet", "priority": 1-10, "arrived", "lat", "lon"}'}</code></li>
      </ul>
      <h4>Return</h4>
      <ul>
        <li><code>{'{person id: shelter id or None}'}</code> for every person.</li>
      </ul>
      <h4>Example</h4>
      <pre>{`# Sample case 1: Shelter A has 1 men's + 1 women's bed, no pets.
# Shelter B has 1 men's bed + 1 family room, pets ok.
assign_beds(shelters, people)
# -> {"P02": "SA",   # priority 9, men's bed: A is closest
#     "P03": None,   # women's bed + a dog: A has no pets, B has no women's bed
#     "P04": "SB",   # family room
#     "P01": "SB",   # A's men's bed went to P02
#     "P05": None}   # no men's beds left`}</pre>
      <p className="tiny">Time limit 3 s per test · hidden tests: every bed taken, a priority tie, 60 people, nobody needing a bed. People and beds are made up; shelters sit at real community buildings.</p>
    </>
  ),
};
