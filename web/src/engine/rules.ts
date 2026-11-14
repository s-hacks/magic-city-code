// The mission's rules, checked one action at a time, with friendly messages for kids.
// A broken rule never crashes the run: that action is skipped and we explain why.
// Rules: the site must exist, be an allowed kind, be inside the mission area,
// not be used twice, and the level has a maximum number of hubs.
import type { Action, CityData, Level, Mission, PlacedHub, RuleError } from "@mcc/shared";
import { inBbox } from "./geo";
import { siteIndex, sitePosition } from "./prepare";

export interface RuleCheck {
  placed: PlacedHub[];
  errors: RuleError[];
}

const KIND_WORDS: Record<string, string> = {
  church: "church",
  school: "school",
  library: "library",
  community_center: "community center",
};

function kindWord(kind: string): string {
  return KIND_WORDS[kind] ?? kind;
}

function plural(kind: string): string {
  const word = kindWord(kind);
  if (word.endsWith("y")) return word.slice(0, -1) + "ies"; // library -> libraries
  if (word.endsWith("ch")) return word + "es"; // church -> churches
  return word + "s";
}

function withLine(line: number | undefined, message: string): string {
  return line === undefined ? message : `Line ${line}: ${message}`;
}

export function checkActions(mission: Mission, level: Level, actions: Action[], data: CityData): RuleCheck {
  const sites = siteIndex(data);
  const placed: PlacedHub[] = [];
  const errors: RuleError[] = [];
  const used = new Set<string>();
  const thing = mission.thing;
  let extraHubs = 0;
  let firstExtra: Action | null = null;

  for (const action of actions) {
    const siteId = action?.siteId;
    const line = action?.line;
    const site = typeof siteId === "string" ? sites.get(siteId) : undefined;

    if (site === undefined) {
      errors.push({
        code: "unknown_site",
        message: withLine(line, `I can't find a place called "${String(siteId)}". Try picking one from city.sites().`),
        line,
        siteId: typeof siteId === "string" ? siteId : undefined,
      });
      continue;
    }
    if (!mission.siteKinds.includes(site.kind)) {
      const allowed = mission.siteKinds.map(plural).join(" or ");
      errors.push({
        code: "wrong_kind",
        message: withLine(line, `${site.name} is a ${kindWord(site.kind)}. In this mission a ${thing} can only go at ${allowed}.`),
        line,
        siteId: site.id,
      });
      continue;
    }
    if (!inBbox(sitePosition(site), mission.area.bbox)) {
      errors.push({
        code: "outside_area",
        message: withLine(line, `${site.name} is outside the mission area. Pick a place inside the box on the map.`),
        line,
        siteId: site.id,
      });
      continue;
    }
    if (used.has(site.id)) {
      errors.push({
        code: "duplicate",
        message: withLine(line, `You already put a ${thing} at ${site.name}. Each place can only have one, so try a different spot.`),
        line,
        siteId: site.id,
      });
      continue;
    }
    if (placed.length >= level.maxPlacements) {
      extraHubs++;
      if (firstExtra === null) firstExtra = action;
      continue;
    }
    used.add(site.id);
    placed.push({
      siteId: site.id,
      name: site.name,
      kind: site.kind,
      lat: site.lat,
      lon: site.lon,
      line,
      order: placed.length,
    });
  }

  if (firstExtra !== null) {
    const max = level.maxPlacements;
    const tried = max + extraHubs;
    const usedText = max === 1 ? "I used only the first one." : `I used the first ${max}.`;
    errors.push({
      code: "too_many",
      message: withLine(
        firstExtra.line,
        `You tried to place ${tried} ${thing}s, but this level allows only ${max}. ${usedText}`,
      ),
      line: firstExtra.line,
      siteId: firstExtra.siteId,
    });
  }
  return { placed, errors };
}
