// Plain-word helpers: need labels, percentages, short flare labels, the proposal summary.
import type { Mission, NeedColumn } from "@mcc/shared";

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const num = (x: number) => Math.round(x).toLocaleString();

/** What the mission counts, as a plural noun phrase. */
export const NEED_LABEL: Record<NeedColumn, string> = {
  households: "households",
  households_no_car: "households without a car",
  kids: "children",
  seniors: "seniors",
  households_poverty: "low-income households",
  households_no_internet: "households with no home internet",
};

/** Plural of the mission's thing ("pickup hub" -> "pickup hubs"). */
export const plural = (thing: string, n: number) => (n === 1 ? thing : `${thing}s`);

/** Plain words for who is counted and what they are walking to. */
export function needWords(m: Mission): { who: string; place: string } {
  switch (m.needColumn) {
    case "households_no_car":
      return { who: "households with no car", place: "food" };
    case "households_no_internet":
      return { who: "households with no home internet", place: "free Wi-Fi" };
    case "households_poverty":
      return { who: "low-income households", place: "a warm place" };
    case "seniors":
      return { who: "seniors", place: "a warm place" };
    case "kids":
      return { who: "children", place: "food" };
    default:
      return { who: "households", place: "food" };
  }
}

/** Short label for a flare over a neighborhood, from the problem words. */
export function shortLabel(text: string, max = 24): string {
  const clean = text.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 8 ? cut.lastIndexOf(" ") : max) + "…";
}

/** True when the mission counts a stand-in group (like low-income households) and should say so. */
export function needsHonestyNote(m: Mission): boolean {
  return m.id === "warm-nights" || /unsheltered|sleep(ing)? outside|no public data/i.test(m.story);
}

export interface SummaryInput {
  mission: Mission;
  neighborhoodName: string;
  hubs: number;
  before: number;
  after: number;
  helped: number;
}

/** Three sentences, built from the numbers. No AI involved. */
export function makeSummary(s: SummaryInput): string {
  const { who, place } = needWords(s.mission);
  const things = plural(s.mission.thing, s.hubs);
  return [
    `I wrote Python that chose ${s.hubs} ${things} for ${s.neighborhoodName}.`,
    `Before, ${pct(s.before)} of ${who} were within a ${s.mission.walkMinutes}-minute walk of ${place}; with my ${things}, ${pct(s.after)} are, which is about ${num(s.helped)} more ${who}.`,
    `I hope ${s.mission.partner} can look at these places and decide if they are worth a closer look.`,
  ].join(" ");
}
