// The "mission draft": the part of a mission Claude fills in. The server adds the rest
// (id, map box, the resident's quote, source, approved=false) and then runs the full checks.
// Written with zod/v4 because the SDK's structured-output helper reads v4 schemas.
// Number ranges are not in the schema (structured outputs drop them); validate.ts checks them.
import * as z from "zod/v4";
import { NEED_COLUMNS, SITE_KINDS, type Mission, type Neighborhood } from "@mcc/shared";

export const PARTNERS = [
  "Jones Valley Teaching Farm",
  "Shipt",
  "Jones Valley Teaching Farm and Shipt",
  "Ed Farm",
  "Firehouse Ministries",
  "Riders who lost Saturday buses",
  "Birmingham Public Library",
  "Neighborhood association",
] as const;

export function buildDraftSchema(neighborhoodIds: string[]) {
  const LevelDraft = z.object({
    number: z.number().int().describe("1, 2 or 4: the step on the learning ladder"),
    title: z.string(),
    concept: z.string().describe('"Calling a function", "Loops" or "Sorting and choosing"'),
    instructions: z.string().describe("Kid-friendly task text, 1-3 short sentences"),
    goalTarget: z.number().describe("Coverage share to reach, between 0.05 and 0.9"),
    maxPlacements: z.number().int().describe("How many things the student may place, 1-10"),
    starterCode: z.string().describe("Python the student starts from. Uses the city module. Not the full answer."),
    solution: z.string().describe("Python that completes the level. Never shown to students."),
    hints: z.object({
      nudge: z.string().describe("A question that points at the right spot, no code"),
      idea: z.string().describe("The idea needed, in plain words, without the answer line"),
      example: z.string().describe("A worked example on a DIFFERENT problem (for example water fountains in a park)"),
    }),
  });

  return z.object({
    supported: z.boolean().describe("true if this can be a 'place N things so more people can walk to one' mission"),
    unsupportedReason: z.string().describe('If supported is false, one kind sentence saying why. Otherwise "".'),
    title: z.string(),
    story: z.string().describe("2-4 sentences for kids aged 10-15. Kind, hopeful, no blame, no scary details."),
    partner: z.enum(PARTNERS),
    thing: z.string().describe('What the student places, singular, e.g. "pickup hub"'),
    neighborhood: neighborhoodIds.length ? z.enum(neighborhoodIds as [string, ...string[]]) : z.string(),
    siteKinds: z.array(z.enum(SITE_KINDS as [string, ...string[]])),
    needColumn: z.enum(NEED_COLUMNS as [string, ...string[]]),
    walkMinutes: z.number().int().describe("Walk limit in minutes, usually 10"),
    existingSources: z
      .enum(["stores", "none"])
      .describe('"stores" if grocery stores already do the job of the thing placed (food missions); "none" otherwise'),
    levels: z.array(LevelDraft),
  });
}

export type MissionDraft = z.infer<ReturnType<typeof buildDraftSchema>>;

/** Turn a draft into a full Mission. The server, not the model, sets id, box, quote and source. */
export function assembleMission(
  draft: MissionDraft,
  opts: { id: string; neighborhood: Neighborhood; residentText: string },
): Mission {
  return {
    id: opts.id,
    title: draft.title,
    story: draft.story,
    residentQuote: opts.residentText,
    partner: draft.partner,
    type: "coverage",
    area: { neighborhood: opts.neighborhood.id, bbox: opts.neighborhood.bbox },
    thing: draft.thing,
    siteKinds: [...new Set(draft.siteKinds)] as Mission["siteKinds"],
    needColumn: draft.needColumn as Mission["needColumn"],
    walkMinutes: draft.walkMinutes,
    existingSources: draft.existingSources,
    levels: draft.levels.map((l) => ({
      number: l.number,
      title: l.title,
      concept: l.concept,
      instructions: l.instructions,
      goal: { metric: "coverage" as const, target: l.goalTarget },
      maxPlacements: l.maxPlacements,
      starterCode: l.starterCode,
      solution: l.solution,
      hints: [l.hints.nudge, l.hints.idea, l.hints.example],
    })),
    source: { kind: "resident", text: opts.residentText },
    approved: false,
  };
}
