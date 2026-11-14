// A keyword sorter used when Claude is not available (no key, no Wi-Fi) or when its answer
// cannot be used. It decides which kind of coverage mission a problem fits, or that it fits none.
import type { Neighborhood } from "@mcc/shared";

export type Theme = "food" | "farmstand" | "transit" | "homework" | "kids" | "warming" | "seniors";

export type Classification =
  | { supported: true; theme: Theme; matched: string[] }
  | { supported: false; reason: string; matched: string[] };

interface Rule {
  theme: Theme | "unsupported";
  weight: number;
  words: RegExp;
}

const RULES: Rule[] = [
  { theme: "food", weight: 1, words: /\b(grocer(y|ies)|food|store|supermarket|hungry|fruit|vegetables?|eat|meals?)\b/gi },
  { theme: "farmstand", weight: 2, words: /\b(produce|farm ?stand|mobile market|market truck|produce truck|truck|farmers'? market)\b/gi },
  { theme: "transit", weight: 2, words: /\b(bus|buses|shuttle|transit|saturday service)\b/gi },
  { theme: "transit", weight: 1, words: /\b(rides?|no car|don'?t have a car|without a car)\b/gi },
  { theme: "homework", weight: 2, words: /\b(homework|wi-?fi|internet|online|study|computer)\b/gi },
  { theme: "kids", weight: 1, words: /\b(kids?|children|child|play|playground|after[- ]school|students?|teens?|youth)\b/gi },
  { theme: "warming", weight: 2, words: /\b(cold nights?|cold|freezing|get warm|warm(ing)? (up|place|station|center)s?|warm|heat(ing)?|shelter|sleep(ing)? outside)\b/gi },
  { theme: "seniors", weight: 1, words: /\b(seniors?|elderly|elders?|grand(ma|pa|mother|father|parents?)|older (folks|people|neighbors)|aging|retired|retirees?)\b/gi },
  {
    theme: "unsupported",
    weight: 3,
    words:
      /\b(water bill|bills?|potholes?|street ?lights?|noise|loud|taxes|trash|garbage|police|crime|shooting|landlord|rent|sewer|flood(ing)?|stray dogs?|speeding|parking|permit|tickets?|lawsuit)\b/gi,
  },
];

// When scores tie, the more specific theme wins.
const TIE_ORDER: Theme[] = ["homework", "warming", "farmstand", "transit", "food", "seniors", "kids"];

export function classifyProblem(text: string): Classification {
  const scores: Record<string, number> = { unsupported: 0 };
  const matched: string[] = [];
  for (const rule of RULES) {
    const hits = text.match(rule.words) ?? [];
    if (!hits.length) continue;
    scores[rule.theme] = (scores[rule.theme] ?? 0) + hits.length * rule.weight;
    matched.push(...hits.map((h) => h.toLowerCase()));
  }
  let best: Theme | null = null;
  for (const t of TIE_ORDER) {
    const s = scores[t] ?? 0;
    if (s > 0 && (best === null || s > (scores[best] ?? 0))) best = t;
  }
  if (best === null || scores.unsupported >= (scores[best] ?? 0)) {
    return {
      supported: false,
      reason:
        scores.unsupported === 0
          ? "This problem doesn't look like a 'place things so more people can walk to one' mission yet, so it needs a new kind of mission."
          : "This sounds like a problem about bills, repairs or safety. Placing helpful spots on a map can't fix it, so it needs a new kind of mission.",
      matched,
    };
  }
  return { supported: true, theme: best, matched };
}

/** Find a neighborhood named in the text ("in Ensley", "West End"), if any. */
export function detectNeighborhood(text: string, hoods: Neighborhood[]): Neighborhood | null {
  const lower = text.toLowerCase();
  let found: Neighborhood | null = null;
  for (const n of hoods) {
    if (lower.includes(n.name.toLowerCase()) && (!found || n.name.length > found.name.length)) found = n;
  }
  return found;
}
