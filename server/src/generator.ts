// Turns a resident's problem into a playable mission.
// Path: scrub personal details -> ask Claude for a mission draft (structured output) -> build and
// check the full mission -> if checks fail, ask once more with the errors -> if that fails too,
// use the closest seed mission (or a built-in template). With no key, the keyword sorter decides.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { GenerateRequest, GenerateResponse, Mission, Neighborhood, ProblemCard } from "@mcc/shared";
import { loadCity, neighborhoodList, siteCounts, type CityData } from "./city";
import { classifyProblem, detectNeighborhood, type Classification } from "./classify";
import { describeError, FALLBACK_BETA, getClaude } from "./claude";
import { GENERATOR_MODEL } from "./config";
import { assembleMission, buildDraftSchema } from "./draft";
import { GENERATOR_RULES, generatorUserMessage, neighborhoodBlock } from "./prompts/generator";
import { scrub } from "./scrub";
import { newId, type Store } from "./store";
import { buildTemplateMission, themeSpec, type ThemeSpec } from "./templates";
import { validateMission } from "./validate";

export const MAX_PROBLEM_CHARS = 2000;

export interface GenerateOutcome {
  response: GenerateResponse;
  usedAI: boolean; // a mission or "unsupported" answer came from Claude
  attempts: number; // Claude calls made
  notes: string[]; // why a fallback was used, for logs and the try script
}

export interface GenerateDeps {
  store: Store;
  city?: CityData;
  /** Pass null to force the offline path. Defaults to the shared client (null without a key). */
  claude?: Anthropic | null;
}

export async function generateMission(req: GenerateRequest, deps: GenerateDeps): Promise<GenerateOutcome> {
  const city = deps.city ?? loadCity();
  const hoods = neighborhoodList(city);
  const rawText = req.text.slice(0, MAX_PROBLEM_CHARS);
  const text = scrub(rawText, { keepWords: hoods.map((n) => n.name) });
  const required = req.neighborhood ? (hoods.find((n) => n.id === req.neighborhood) ?? null) : null;
  const mentioned = detectNeighborhood(rawText, hoods);
  const claude = deps.claude === undefined ? getClaude() : deps.claude;
  const notes: string[] = [];
  if (req.neighborhood && !required) notes.push(`requested neighborhood "${req.neighborhood}" is unknown; ignored`);

  let attempts = 0;
  if (claude) {
    const ai = await generateWithClaude(claude, { text, required, hoods, city });
    attempts = ai.attempts;
    notes.push(...ai.notes);
    if (ai.kind === "mission") {
      return finish(deps.store, { mission: ai.mission, text, source: "ai", usedAI: true, attempts, notes });
    }
    if (ai.kind === "unsupported") {
      return unsupported(deps.store, { reason: ai.reason, text, hood: required ?? mentioned, usedAI: true, attempts, notes });
    }
    // ai.kind === "failed": fall through to the offline path.
  } else {
    notes.push("AI off (no key or switched off): used the keyword fallback");
  }

  const classification = classifyProblem(text);
  if (!classification.supported) {
    return unsupported(deps.store, { reason: classification.reason, text, hood: required ?? mentioned, usedAI: false, attempts, notes });
  }
  const mission = fallbackMission({ classification, text, target: required ?? mentioned, city, store: deps.store, notes });
  return finish(deps.store, { mission, text, source: "fallback", usedAI: false, attempts, notes });
}

// ---------------------------------------------------------------------------------------------
// Claude path

type AiResult =
  | { kind: "mission"; mission: Mission; attempts: number; notes: string[] }
  | { kind: "unsupported"; reason: string; attempts: number; notes: string[] }
  | { kind: "failed"; attempts: number; notes: string[] };

async function generateWithClaude(
  claude: Anthropic,
  ctx: { text: string; required: Neighborhood | null; hoods: Neighborhood[]; city: CityData },
): Promise<AiResult> {
  const schema = buildDraftSchema(ctx.hoods.map((n) => n.id));
  // The helper turns the Zod schema into the JSON schema structured outputs expects.
  const format = betaZodOutputFormat(schema);
  const notes: string[] = [];
  let previousErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await claude.beta.messages.create({
        model: GENERATOR_MODEL,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: format.schema } },
        // Stable rules first, then the neighborhood list; both cached. The resident's words go last.
        system: [
          { type: "text", text: GENERATOR_RULES, cache_control: { type: "ephemeral" } },
          { type: "text", text: neighborhoodBlock(ctx.hoods), cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: generatorUserMessage({ residentText: ctx.text, requiredNeighborhood: ctx.required, previousErrors }),
          },
        ],
      });
    } catch (err) {
      // Network, auth or rate-limit trouble: a second try won't help the demo. Fall back now.
      notes.push(`attempt ${attempt}: ${describeError(err)}`);
      return { kind: "failed", attempts: attempt, notes };
    }

    notes.push(
      `attempt ${attempt}: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out, ` +
        `cache read ${response.usage.cache_read_input_tokens ?? 0}, cache write ${response.usage.cache_creation_input_tokens ?? 0}`,
    );
    // Always check why the model stopped before reading the reply.
    if (response.stop_reason === "refusal") {
      notes.push(`attempt ${attempt}: Claude declined (${response.stop_details?.category ?? "no category"})`);
      return {
        kind: "unsupported",
        reason: "This problem can't be turned into a kids' coding mission.",
        attempts: attempt,
        notes,
      };
    }
    if (response.stop_reason === "max_tokens") {
      previousErrors = ["Your reply was cut off. Keep every text field short."];
      notes.push(`attempt ${attempt}: reply cut off at max_tokens`);
      continue;
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      previousErrors = ["Your reply was not valid JSON."];
      notes.push(`attempt ${attempt}: reply was not JSON`);
      continue;
    }
    const draft = schema.safeParse(json);
    if (!draft.success) {
      previousErrors = draft.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      notes.push(`attempt ${attempt}: draft did not match the schema`);
      continue;
    }
    if (!draft.data.supported) {
      return {
        kind: "unsupported",
        reason: draft.data.unsupportedReason.trim() || "This problem needs a new kind of mission.",
        attempts: attempt,
        notes,
      };
    }

    const hood = ctx.required ?? ctx.hoods.find((n) => n.id === draft.data.neighborhood) ?? null;
    if (!hood) {
      previousErrors = [`neighborhood "${draft.data.neighborhood}" is not in the list`];
      notes.push(`attempt ${attempt}: unknown neighborhood`);
      continue;
    }
    const mission = assembleMission(draft.data, { id: newId("mission"), neighborhood: hood, residentText: ctx.text });
    const checked = validateMission(mission, ctx.city);
    if (checked.ok) return { kind: "mission", mission: checked.mission, attempts: attempt, notes };
    previousErrors = checked.errors;
    notes.push(`attempt ${attempt}: failed checks: ${checked.errors.slice(0, 3).join("; ")}`);
  }
  return { kind: "failed", attempts: 2, notes };
}

// ---------------------------------------------------------------------------------------------
// Offline path: closest seed mission, re-pointed at the resident's neighborhood, or a template.

export function fallbackMission(opts: {
  classification: Extract<Classification, { supported: true }>;
  text: string;
  target: Neighborhood | null;
  city: CityData;
  store: Store;
  notes: string[];
}): Mission {
  const { classification, text, target, city, store, notes } = opts;
  const spec = themeSpec(classification.theme);
  const hoods = neighborhoodList(city);
  const id = newId("mission");

  // Closest seed: the theme's own seed first (e.g. feed-the-block), then same need group,
  // then same neighborhood, then the same "thing".
  const seeds = store
    .seedMissions()
    .filter((m) => m.id === spec.seedId || m.needColumn === spec.needColumn)
    .sort((a, b) => seedScore(b, spec, target) - seedScore(a, spec, target));

  for (const seed of seeds) {
    const seedHood = hoods.find((n) => n.id === seed.area.neighborhood) ?? null;
    const tries: Neighborhood[] = [];
    if (target) tries.push(target);
    if (seedHood && seedHood.id !== target?.id) tries.push(seedHood);
    for (const hood of tries) {
      const candidate = retarget(seed, { id, hood, fromName: seedHood?.name, text });
      const checked = validateMission(candidate, city);
      if (checked.ok) {
        notes.push(`fallback: seed mission "${seed.id}" in ${hood.name}`);
        return checked.mission;
      }
    }
  }

  // No seed fits: build from the template, in the target neighborhood, then the theme's usual
  // neighborhood, then the first one whose data passes the checks.
  const preferred = [target, hoods.find((n) => n.id === spec.defaultNeighborhood) ?? null].filter(
    (n): n is Neighborhood => n !== null,
  );
  const order = [...preferred, ...hoods.filter((n) => !preferred.some((p) => p.id === n.id))];
  const build = (hood: Neighborhood) =>
    buildTemplateMission({ theme: classification.theme, neighborhood: hood, residentText: text, id, siteCounts: siteCounts(city, hood.bbox) });
  for (const hood of order) {
    const m = build(hood);
    if (validateMission(m, city).ok) {
      notes.push(`fallback: built-in "${spec.title}" template in ${hood.name}`);
      return m;
    }
  }
  notes.push(`fallback: template in ${order[0].name} (data checks did not pass anywhere)`);
  return build(order[0]);
}

function seedScore(m: Mission, spec: ThemeSpec, target: Neighborhood | null): number {
  let s = 0;
  if (m.id === spec.seedId) s += 8;
  if (m.needColumn === spec.needColumn) s += 4;
  if (target && m.area.neighborhood === target.id) s += 2;
  if (m.thing.toLowerCase() === spec.thing.toLowerCase()) s += 1;
  return s;
}

function retarget(seed: Mission, o: { id: string; hood: Neighborhood; fromName?: string; text: string }): Mission {
  const swap = (s: string) => (o.fromName && o.fromName !== o.hood.name ? s.split(o.fromName).join(o.hood.name) : s);
  return {
    ...seed,
    id: o.id,
    title: swap(seed.title),
    story: swap(seed.story),
    residentQuote: o.text,
    area: { neighborhood: o.hood.id, bbox: o.hood.bbox },
    levels: seed.levels.map((l) => ({ ...l, instructions: swap(l.instructions) })),
    source: { kind: "resident", text: o.text },
    approved: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Saving the result

function finish(
  store: Store,
  o: { mission: Mission; text: string; source: "ai" | "fallback"; usedAI: boolean; attempts: number; notes: string[] },
): GenerateOutcome {
  store.saveMission(o.mission);
  const problem = store.saveProblem(card(o.text, o.mission.area.neighborhood, "mission", o.mission.id));
  return {
    response: { status: "ok", mission: o.mission, problem, source: o.source },
    usedAI: o.usedAI,
    attempts: o.attempts,
    notes: o.notes,
  };
}

function unsupported(
  store: Store,
  o: { reason: string; text: string; hood: Neighborhood | null; usedAI: boolean; attempts: number; notes: string[] },
): GenerateOutcome {
  const problem = store.saveProblem(card(o.text, o.hood?.id ?? null, "needs_new_type"));
  return {
    response: { status: "unsupported", reason: o.reason, problem },
    usedAI: o.usedAI,
    attempts: o.attempts,
    notes: o.notes,
  };
}

function card(text: string, neighborhood: string | null, status: ProblemCard["status"], missionId?: string): ProblemCard {
  return {
    id: newId("problem"),
    text,
    neighborhood,
    status,
    ...(missionId ? { missionId } : {}),
    createdAt: new Date().toISOString(),
  };
}
