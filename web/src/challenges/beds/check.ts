// Open Bed: data types and the checker. People are checked in the order the rules serve them,
// so the first wrong answer is the one that caused the rest.
import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';

export type BedKind = 'men' | 'women' | 'family';
export interface Shelter { id: string; name: string; lat: number; lon: number; beds: Record<BedKind, number>; pets: boolean }
export interface Person { id: string; needs: BedKind; pet: boolean; priority: number; arrived: number; lat: number; lon: number }
export interface BedsTest {
  id: string; name: string; visible: boolean;
  shelters: Shelter[]; people: Person[];
  expected: Record<string, string | null>;
}
export interface BedsData { tests: BedsTest[] }

const BED: Record<BedKind, string> = { men: "a men's bed", women: "a women's bed", family: 'a family room' };
export const serveOrder = (people: Person[]) => [...people].sort((a, b) => b.priority - a.priority || a.arrived - b.arrived);
const who = (p: Person) => `${p.id} (priority ${p.priority}, needs ${BED[p.needs]}${p.pet ? ', has a pet' : ''})`;

export function checkBeds(t: BedsTest, run: TestRun): Verdict {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: 'Your code never finished. Is there a loop that never ends?' };
  const res = run.result;
  if (!res || res.type !== 'dict' || !res.value || typeof res.value !== 'object') {
    return { ok: false, kind: 'type', title: 'Wrong return type', detail: `assign_beds must return a dict like {"P01": "SA", "P02": None}, but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  }
  const got = res.value as Record<string, string | null>;
  const name = (id: string | null) => (id === null ? 'the waitlist (None)' : t.shelters.find((s) => s.id === id)?.name ?? `"${id}"`);
  const extra = Object.keys(got).find((id) => !(id in t.expected));
  if (extra) return { ok: false, kind: 'wrong', title: 'Unknown person', detail: `Your dict has "${extra}", but nobody with that id is in tonight's list.` };
  const bad = Object.values(got).find((s) => s !== null && !t.shelters.some((x) => x.id === s));
  if (bad !== undefined) return { ok: false, kind: 'wrong', title: 'Unknown shelter', detail: `You assigned someone to "${bad}". Use a shelter's "id", like "${t.shelters[0]?.id ?? 'SA'}", or None.` };

  for (const p of serveOrder(t.people)) {
    if (!(p.id in got)) return { ok: false, kind: 'missing', title: 'Someone was left out', detail: `${p.id} isn't in your answer. Every person needs an entry, even if it's None.` };
    const want = t.expected[p.id], gave = got[p.id];
    if (want === gave) continue;
    const s = t.shelters.find((x) => x.id === gave);
    let why = '';
    if (want === null) why = `No shelter still has ${BED[p.needs]}${p.pet ? ' that allows pets' : ''} when it's ${p.id}'s turn, so ${p.id} goes on the waitlist.`;
    else if (gave === null) why = `${name(want)} still has ${BED[p.needs]}${p.pet ? ' and allows pets' : ''} when it's ${p.id}'s turn.`;
    else if (s && !s.pets && p.pet) why = `${s.name} doesn't allow pets.`;
    else why = `${name(want)} is the closest shelter that still has ${BED[p.needs]}${p.pet ? ' and allows pets' : ''} when it's ${p.id}'s turn. Remember: higher priority goes first, and beds run out.`;
    return { ok: false, kind: 'wrong', title: `${p.id} got the wrong answer`, detail: `${who(p)} should get ${name(want)}, but you gave ${name(gave)}. ${why}` };
  }
  const housed = Object.values(t.expected).filter(Boolean).length;
  const n = t.people.length;
  return { ok: true, kind: 'pass', title: 'Passed', detail: n ? `${housed} of ${n} people have a bed tonight${n - housed ? `; ${n - housed} on the waitlist` : ''}.` : 'Nobody needs a bed tonight.' };
}
