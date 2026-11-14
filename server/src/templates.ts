// Ready-made missions built from a theme and a neighborhood, used when Claude is not available and
// no seed mission fits. Themes match the five showcase missions in docs/showcase-examples.md.
// Levels follow the build's learning ladder: 1 calling a function, 2 loops, 4 sorting and choosing.
// Goal targets here are rough; the hand-checked seed missions are always preferred.
import type { Level, Mission, Neighborhood, NeedColumn, SiteKind } from "@mcc/shared";
import type { Theme } from "./classify";

export interface ThemeSpec {
  seedId: string; // the matching seed mission in web/public/data/missions/
  defaultNeighborhood: string;
  title: string;
  thing: string;
  things: string;
  partner: string;
  siteKinds: SiteKind[];
  needColumn: NeedColumn;
  who: string; // "families without a car"
  sortKey: "families_without_car" | "families_nearby";
  placements: number;
  story: (hood: string) => string;
}

const KIND_WORD: Record<SiteKind, string> = {
  church: "church",
  school: "school",
  library: "library",
  community_center: "community center",
};
const KIND_PLURAL: Record<SiteKind, string> = {
  church: "churches",
  school: "schools",
  library: "libraries",
  community_center: "community centers",
};
const NUMBER_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export const THEMES: Record<Theme, ThemeSpec> = {
  food: {
    seedId: "feed-the-block",
    defaultNeighborhood: "west-end",
    title: "Feed the Block",
    thing: "pickup hub",
    things: "pickup hubs",
    partner: "Jones Valley Teaching Farm and Shipt",
    siteKinds: ["church", "school", "library"],
    needColumn: "households_no_car",
    who: "families without a car",
    sortKey: "families_without_car",
    placements: 5,
    story: (h) =>
      `${h} has no grocery store close by, and many families don't have a car. Grocery pickup hubs at churches, schools and libraries could bring food within walking distance. Your code chooses where they go.`,
  },
  farmstand: {
    seedId: "farm-stand-route",
    defaultNeighborhood: "woodlawn",
    title: "Farm Stand Route",
    thing: "farm-stand stop",
    things: "farm-stand stops",
    partner: "Jones Valley Teaching Farm",
    siteKinds: ["church", "school", "library"],
    needColumn: "households_no_car",
    who: "families without a car",
    sortKey: "families_without_car",
    placements: 4,
    story: (h) =>
      `A produce truck brings fresh fruit and vegetables to ${h} once a week, but it can only make four stops. Your code picks the stops so more families without a car can walk to fresh food.`,
  },
  transit: {
    seedId: "saturday-shuttle",
    defaultNeighborhood: "east-lake",
    title: "Saturday Shuttle",
    thing: "Saturday shuttle stop",
    things: "Saturday shuttle stops",
    partner: "Riders who lost Saturday buses",
    siteKinds: ["church", "school", "library"],
    needColumn: "households_no_car",
    who: "families without a car",
    sortKey: "families_without_car",
    placements: 5,
    story: (h) =>
      `The bus no longer runs on Saturdays, so families in ${h} without a car can't get to the store on their day off. A shuttle van could make a few stops. Your code picks where the stops go.`,
  },
  homework: {
    seedId: "homework-hotspots",
    defaultNeighborhood: "ensley",
    title: "Homework Hotspots",
    thing: "Wi-Fi study spot",
    things: "Wi-Fi study spots",
    partner: "Ed Farm",
    siteKinds: ["library", "school", "community_center", "church"],
    needColumn: "households_no_internet",
    who: "families with no internet at home",
    sortKey: "families_nearby",
    placements: 5,
    story: (h) =>
      `Some kids in ${h} can't get online at home to do homework. Free Wi-Fi study spots could help. Your code chooses where they go so more families without internet can walk to one.`,
  },
  kids: {
    seedId: "close-to-play",
    defaultNeighborhood: "ensley",
    title: "Close to Play",
    thing: "after-school spot",
    things: "after-school spots",
    partner: "Ed Farm",
    siteKinds: ["school", "library", "church"],
    needColumn: "kids",
    who: "kids",
    sortKey: "families_nearby",
    placements: 5,
    story: (h) =>
      `Kids in ${h} need safe places to go after school. Your code picks where to open after-school spots so more kids can walk to one.`,
  },
  warming: {
    seedId: "warm-nights",
    defaultNeighborhood: "southside",
    title: "Warm Nights",
    thing: "warming station",
    things: "warming stations",
    partner: "Firehouse Ministries",
    siteKinds: ["library", "community_center", "church"],
    needColumn: "households_poverty",
    who: "low-income households",
    sortKey: "families_nearby",
    placements: 5,
    story: (h) =>
      `On cold nights, people in ${h} need a warm place nearby. There is no public data on where people without homes sleep, so this mission counts low-income households instead. Your code picks where to open warming stations.`,
  },
  seniors: {
    seedId: "neighbors-helping-elders",
    defaultNeighborhood: "west-end",
    title: "Neighbors Helping Elders",
    thing: "senior help stop",
    things: "senior help stops",
    partner: "Neighborhood association",
    siteKinds: ["church", "library", "community_center"],
    needColumn: "seniors",
    who: "seniors",
    sortKey: "families_nearby",
    placements: 5,
    story: (h) =>
      `Many older neighbors in ${h} have a hard time getting around. Help stops could bring groceries and medicine closer. Your code picks where they go.`,
  },
};

export function themeSpec(theme: Theme): ThemeSpec {
  return THEMES[theme] ?? THEMES.food;
}

/**
 * Levels for a theme. `codeKind` is the site kind the code asks for (city.sites(kind=...));
 * null means the code asks for every allowed site (city.sites()).
 */
export function buildLevels(spec: ThemeSpec, codeKind: SiteKind | null): Level[] {
  const n = spec.placements;
  const nWord = NUMBER_WORD[n] ?? String(n);
  const call = codeKind ? `city.sites(kind="${codeKind}")` : "city.sites()";
  const one = codeKind ? KIND_WORD[codeKind] : "place";
  const many = codeKind ? KIND_PLURAL[codeKind] : "places";
  return [
    {
      number: 1,
      title: `Your first ${spec.thing}`,
      concept: "Calling a function",
      instructions: `Get the list of ${many}, then call city.place_hub to put one ${spec.thing} at the first ${one} on the list.`,
      goal: { metric: "coverage", target: 0.1 },
      maxPlacements: 1,
      starterCode: `# Get the list of places that could host a ${spec.thing}\nplaces = ${call}\n\n# Put one ${spec.thing} at the first place on the list\n# city.place_hub(...)\n`,
      solution: `places = ${call}\ncity.place_hub(places[0])\n`,
      hints: [
        "Look at the last comment. Which function puts something on the map, and what goes inside its ( )?",
        "A list starts counting at 0. So places[0] means the first place on the list.",
        "Here is the same idea with a different problem: to put a water fountain at the first bench in a park, you could write spot = benches[0] and then park.add_fountain(spot).",
      ],
    },
    {
      number: 2,
      title: `${nWord[0].toUpperCase()}${nWord.slice(1)} ${spec.things}`,
      concept: "Loops",
      instructions: `One is not enough. Use a for loop to place a ${spec.thing} at each of the first ${nWord} ${many}.`,
      goal: { metric: "coverage", target: 0.3 },
      maxPlacements: n,
      starterCode: `places = ${call}\n\n# Repeat for each of the first ${nWord} places\nfor place in places[:${n}]:\n    # put a ${spec.thing} at this place\n    pass\n`,
      solution: `places = ${call}\nfor place in places[:${n}]:\n    city.place_hub(place)\n`,
      hints: [
        `The loop already visits ${nWord} places. What should happen to each one inside the loop?`,
        "Swap the word pass for the line that places a hub, and give it the loop's variable.",
        "Same idea, different problem: to water every plant in a row you could write for plant in row: then, indented under it, water(plant). The indented line runs once for each plant.",
      ],
    },
    {
      number: 4,
      title: "Pick the best spots",
      concept: "Sorting and choosing",
      instructions: `Not every spot helps the same number of people. Sort the places so the ones near the most ${spec.who} come first, then place ${spec.things} at the top ${nWord}.`,
      goal: { metric: "coverage", target: 0.5 },
      maxPlacements: n,
      starterCode: `places = ${call}\n\n# Sort so the places near the most ${spec.who} come first\nbest = sorted(places, key=lambda p: p.${spec.sortKey})\n\nfor place in best[:${n}]:\n    city.place_hub(place)\n`,
      solution: `places = ${call}\nbest = sorted(places, key=lambda p: p.${spec.sortKey}, reverse=True)\nfor place in best[:${n}]:\n    city.place_hub(place)\n`,
      hints: [
        "Run it and look at the score. Are the first places on your sorted list the ones with the most people nearby, or the fewest?",
        "sorted() puts small numbers first. There is a way to ask it to put the biggest numbers first instead.",
        "Same idea, different problem: to pick the three tallest trees for a treehouse you could write sorted(trees, key=lambda t: t.height, reverse=True)[:3]. reverse=True puts the tallest first.",
      ],
    },
  ];
}

export function buildTemplateMission(opts: {
  theme: Theme;
  neighborhood: Neighborhood;
  residentText: string;
  id: string;
  /** How many sites of each kind are in the neighborhood, if the data is loaded. */
  siteCounts?: Partial<Record<SiteKind, number>> | null;
}): Mission {
  const spec = themeSpec(opts.theme);
  // Ask for one kind in code only if that kind alone has enough sites; otherwise ask for all.
  const codeKind = opts.siteCounts
    ? (spec.siteKinds.find((k) => (opts.siteCounts?.[k] ?? 0) >= spec.placements) ?? null)
    : spec.siteKinds[0];
  return {
    id: opts.id,
    title: `${spec.title}: ${opts.neighborhood.name}`,
    story: spec.story(opts.neighborhood.name),
    residentQuote: opts.residentText,
    partner: spec.partner,
    type: "coverage",
    area: { neighborhood: opts.neighborhood.id, bbox: opts.neighborhood.bbox },
    thing: spec.thing,
    siteKinds: spec.siteKinds,
    needColumn: spec.needColumn,
    walkMinutes: 10,
    levels: buildLevels(spec, codeKind),
    source: { kind: "resident", text: opts.residentText },
    approved: false,
  };
}
