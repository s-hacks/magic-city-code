// The Mission config: one JSON object for every mission, seeded or AI-made.
// The AI only ever fills this object. It never writes engine code.
import { z } from "zod";

export const SiteKindSchema = z.enum(["church", "school", "library", "community_center"]);
export const NeedColumnSchema = z.enum(["households", "households_no_car", "kids", "seniors"]);

export const GoalSchema = z.object({
  metric: z.literal("coverage"), // share of need within walkMinutes of food
  target: z.number().min(0.05).max(1), // e.g. 0.8 = light up 80%
});

/** One step on the learning ladder inside a mission. */
export const LevelSchema = z.object({
  number: z.number().int().min(1).max(5), // 1, 2, 4 in the build
  title: z.string(),
  concept: z.string(), // "Calling a function", "Loops", "Sorting and choosing"
  instructions: z.string(), // kid-friendly task text
  goal: GoalSchema,
  maxPlacements: z.number().int().min(1).max(10),
  starterCode: z.string(),
  solution: z.string(), // used by demo keys; never shown to students or the coach
  hints: z.array(z.string()).length(3), // nudge -> idea -> worked example on a different problem
});

export const MissionSchema = z.object({
  id: z.string(),
  title: z.string(),
  story: z.string(), // kid-friendly framing
  residentQuote: z.string(), // the resident's words, scrubbed of personal details
  partner: z.string(), // e.g. "Jones Valley Teaching Farm"
  type: z.literal("coverage"),
  area: z.object({
    neighborhood: z.string(), // Neighborhood.id
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
  thing: z.string(), // "pickup hub"
  siteKinds: z.array(SiteKindSchema).min(1),
  needColumn: NeedColumnSchema,
  walkMinutes: z.number().min(3).max(30), // default 10
  levels: z.array(LevelSchema).min(1),
  source: z.object({ kind: z.enum(["seed", "resident"]), text: z.string() }),
  approved: z.boolean(), // an adult approved it before students see it
});

export type Goal = z.infer<typeof GoalSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type Mission = z.infer<typeof MissionSchema>;
