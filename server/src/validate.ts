// Checks a mission before anyone can play it: it matches the shared schema, its neighborhood
// is real, the area has data, the levels make sense, and the code looks like student Python.
// Data checks are skipped (not failed) when a data file has not been built yet.
import { MissionSchema, type Mission } from "@mcc/shared";
import { areasIn, findNeighborhood, neighborhoodList, sitesIn, type CityData } from "./city";

export const MIN_CANDIDATE_SITES = 3;

export type ValidationResult = { ok: true; mission: Mission; warnings: string[] } | { ok: false; errors: string[] };

export function validateMission(input: unknown, city: CityData): ValidationResult {
  const parsed = MissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "mission"}: ${i.message}`),
    };
  }
  const mission = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Neighborhood exists, and the box matches the real one.
  const hood = city.neighborhoods
    ? findNeighborhood(city, mission.area.neighborhood)
    : neighborhoodList(city).find((n) => n.id === mission.area.neighborhood) ?? null;
  if (!hood) {
    errors.push(`area.neighborhood: "${mission.area.neighborhood}" is not a known neighborhood`);
  } else {
    const [minLon, minLat, maxLon, maxLat] = mission.area.bbox;
    if (!(minLon < maxLon && minLat < maxLat)) errors.push("area.bbox: box is empty or upside down");

    // The area has data: at least one block group and enough candidate sites.
    const areas = areasIn(city, hood);
    if (areas === null) warnings.push("areas.json missing: skipped the block-group check");
    else if (areas.length === 0) errors.push(`area: no Census block groups found in ${hood.name}`);

    if (areas && areas.length > 0 && !areas.some((a) => typeof (a as unknown as Record<string, unknown>)[mission.needColumn] === "number")) {
      warnings.push(`areas.json has no "${mission.needColumn}" numbers yet: scores will be zero until the data is rebuilt`);
    }

    const sites = sitesIn(city, mission.area.bbox, mission.siteKinds);
    if (sites === null) warnings.push("sites.json missing: skipped the candidate-site check");
    else if (sites.length < MIN_CANDIDATE_SITES) {
      errors.push(
        `siteKinds: only ${sites.length} ${mission.siteKinds.join("/")} sites in ${hood.name}; need at least ${MIN_CANDIDATE_SITES}`,
      );
    } else {
      for (const level of mission.levels) {
        if (level.maxPlacements > sites.length) {
          errors.push(`level ${level.number}: maxPlacements ${level.maxPlacements} is more than the ${sites.length} sites available`);
        }
        // If the answer code asks for one kind of site, there must be enough of that kind.
        for (const kind of kindsUsed(level.solution)) {
          const count = sites.filter((s) => s.kind === kind).length;
          if (!mission.siteKinds.includes(kind as Mission["siteKinds"][number])) {
            errors.push(`level ${level.number}: code asks for kind="${kind}", which is not in siteKinds`);
          } else if (count < level.maxPlacements) {
            errors.push(
              `level ${level.number}: code asks for kind="${kind}" but ${hood.name} has only ${count}; it needs ${level.maxPlacements}. Use another kind or city.sites()`,
            );
          }
        }
      }
    }
  }

  if (new Set(mission.siteKinds).size !== mission.siteKinds.length) errors.push("siteKinds: has duplicates");

  // Levels: numbers go up, placement limits and goals are sane, code looks like it uses `city`.
  let lastNumber = 0;
  mission.levels.forEach((level, i) => {
    const tag = `levels[${i}] (level ${level.number})`;
    if (level.number <= lastNumber) errors.push(`${tag}: level numbers must go up`);
    lastNumber = level.number;
    if (level.maxPlacements < 1 || level.maxPlacements > 10) errors.push(`${tag}: maxPlacements must be 1-10`);
    if (level.goal.target <= 0 || level.goal.target > 1) errors.push(`${tag}: goal.target must be between 0 and 1`);
    if (!level.starterCode.trim()) errors.push(`${tag}: starterCode is empty`);
    else if (!level.starterCode.includes("city.")) errors.push(`${tag}: starterCode must use the city module (city.)`);
    if (!level.solution.includes("city.place_hub")) errors.push(`${tag}: solution must call city.place_hub`);
    if (!looksLikePython(level.starterCode)) errors.push(`${tag}: starterCode does not look like Python`);
    if (!looksLikePython(level.solution)) errors.push(`${tag}: solution does not look like Python`);
    if (level.hints.some((h) => !h.trim())) errors.push(`${tag}: every hint needs text`);
    if (level.hints.some((h) => leaksSolution(h, level.solution, level.starterCode))) {
      errors.push(`${tag}: a hint gives away the solution code`);
    }
    for (const field of ["title", "concept", "instructions"] as const) {
      if (!level[field].trim()) errors.push(`${tag}: ${field} is empty`);
    }
  });

  for (const field of ["title", "story", "thing", "partner"] as const) {
    if (!mission[field].trim()) errors.push(`${field}: is empty`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, mission, warnings };
}

/** Site kinds named in code, e.g. city.sites(kind="church") -> ["church"]. */
export function kindsUsed(code: string): string[] {
  return [...new Set([...code.matchAll(/kind\s*=\s*["']([a-z_]+)["']/g)].map((m) => m[1]))];
}

/** A light check that text is Python-ish: balanced brackets, no braces-and-semicolons JS style. */
export function looksLikePython(code: string): boolean {
  if (!code.trim()) return false;
  if (/\bfunction\s*\(|=>|;\s*$|\bconst\s|\blet\s|\bvar\s/m.test(code)) return false;
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const line of code.split("\n")) {
    const noComment = line.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""').replace(/#.*$/, "");
    for (const ch of noComment) {
      if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
      else if (ch in pairs) {
        if (stack.pop() !== pairs[ch]) return false;
      }
    }
  }
  return stack.length === 0;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/** Solution lines that carry real logic: not blank, not comments, not already in the starter code. */
export function solutionLines(solution: string, starterCode = ""): string[] {
  const starter = new Set(starterCode.split("\n").map(normalize));
  return solution
    .split("\n")
    .map(normalize)
    .filter((l) => l.length >= 12 && !l.startsWith("#") && !starter.has(l));
}

/** True if the text contains any meaningful line of the solution word for word. */
export function leaksSolution(text: string, solution: string, starterCode = ""): boolean {
  const flat = normalize(text);
  return solutionLines(solution, starterCode).some((line) => flat.includes(line));
}
