// Water Bill Check: data types and the checker. The checks run in order and stop at the first failure.
import type { TestRun } from '../../py/runner';
import type { Verdict } from '../types';

export interface BillsTest {
  id: string; name: string; visible: boolean;
  bills: Record<string, (number | null)[]>;
  geo: boolean; // accounts have map positions
  expected: string[];
}
export interface BillsData {
  accounts: Record<string, { lat: number; lon: number }>;
  tests: BillsTest[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const money = (x: number | null) => (x === null ? 'no bill' : `$${x.toFixed(2)}`);
const showBills = (b: (number | null)[]) => b.map((x, i) => `${MONTHS[i]} ${money(x)}`).join(', ');

/** The longest run of the same amount, as [start, length]. */
export function longestStreak(b: (number | null)[]): [number, number] {
  let best: [number, number] = [0, 0], start = 0;
  for (let i = 0; i < b.length; i++) {
    if (i === 0 || b[i] === null || b[i] !== b[i - 1]) start = i;
    if (b[i] !== null && i - start + 1 > best[1]) best = [start, i - start + 1];
  }
  return best;
}

export function checkBills(t: BillsTest, run: TestRun): Verdict {
  if (run.error) return { ok: false, kind: 'crash', title: 'Your code crashed', detail: run.error.message, line: run.error.line };
  if (run.timedOut) return { ok: false, kind: 'timeout', title: 'Time limit exceeded (3 s)', detail: 'Your code never finished. Is there a loop that never ends?' };
  const res = run.result;
  if (!res || res.type !== 'list' || !Array.isArray(res.value)) {
    return { ok: false, kind: 'type', title: 'Wrong return type', detail: `flag_estimated must return a list of account ids like ["A0012", "A0400"], but it returned ${res?.repr ?? 'nothing'} (${res?.type ?? 'None'}).` };
  }
  const got = new Set(res.value as string[]);
  const want = new Set(t.expected);
  const unknown = [...got].filter((a) => !(a in t.bills));
  if (unknown.length) return { ok: false, kind: 'wrong', title: 'That account isn\'t in this test', detail: `You returned "${unknown[0]}", which isn't one of the accounts you were given.` };

  const extra = [...got].filter((a) => !want.has(a)).sort();
  if (extra.length) {
    const [s, n] = longestStreak(t.bills[extra[0]]);
    return {
      ok: false, kind: 'wrong',
      title: `${extra.length} account${extra.length > 1 ? 's' : ''} flagged that look${extra.length > 1 ? '' : 's'} fine`,
      detail: `${extra[0]}: ${showBills(t.bills[extra[0]])}. ${n >= 2 ? `The longest run of the same amount is ${n} month${n > 1 ? 's' : ''} (from ${MONTHS[s]})` : 'No amount repeats in a row'}, and a flag needs 3 in a row.`,
    };
  }
  const missed = [...want].filter((a) => !got.has(a)).sort();
  if (missed.length) {
    const [s, n] = longestStreak(t.bills[missed[0]]);
    return {
      ok: false, kind: 'missing',
      title: `Missed ${missed.length} estimated bill${missed.length > 1 ? 's' : ''}`,
      detail: `${missed[0]} was billed ${money(t.bills[missed[0]][s])} for ${n} months in a row (${MONTHS[s]} to ${MONTHS[s + n - 1]}). That household should ask for a real meter read.`,
    };
  }
  const n = Object.keys(t.bills).length;
  return { ok: true, kind: 'pass', title: 'Passed', detail: n ? `Flagged ${want.size} of ${n.toLocaleString()} accounts${want.size ? ', each one a household that can ask for a real meter read' : ''}.` : 'No accounts, nothing to flag.' };
}
