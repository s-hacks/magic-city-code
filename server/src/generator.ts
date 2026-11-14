// Turns a resident's problem into a playable mission.
// Path: scrub personal details -> ask Claude for a mission draft (structured output) -> build and
// check the full mission -> if checks fail, ask once more with the errors -> if that fails too,
// use the closest seed mission (or a built-in template). With no key, the keyword sorter decides.
// Every AI-made, re-targeted or template mission is then calibrated: its answer code is run in
// real Python and scored with the real engine, and each level's goal is set from that score.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { GenerateRequest, GenerateResponse, Mission, Neighborhood, ProblemCard, SiteKind } from "@mcc/shared";
import { calibrateMission } from "./calibrate/calibrate";
import { getSandbox, type PythonSandbox } from "./calibrate/sandbox";
import { engineData, loadCity, neighborhoodList, siteCounts, sitesIn, type CityData } from "./city";
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
/** The whole Claude part of one generate request (both attempts) must finish within this. */
export const GENERATE_DEADLINE_MS = 25_000;
/** Don't start a new attempt with less time than this left. */
const MIN_ATTEMPT_MS = 4_000;

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
  /** Python sandbox for calibration. Pass null to skip calibration. Defaults to the shared one. */
  sandbox?: PythonSandbox | null;
  /** Overall deadline for the Claude attempts, in ms. */
  deadlineMs?: number;
}

type Checked = { ok: true; mission: Mission } | { ok: false; errors: string[] };

/** Validate, then (unless skipped) calibrate goal targets from real Python + engine runs. */
async function checkMission(mission: Mission, city: CityData, sandbox: PythonSandbox | null, notes: string[]): Promise<Checked> {
  const checked = validateMission(mission, city);
  if (!checked.ok) return checked;
  if (!sandbox) return checked;
  const cal = await calibrateMission(checked.mission, engineData(city), sandbox);
  if (!cal.ok) return { ok: false, errors: cal.errors };
  if ("skipped" in cal) notes.push(`calibration skipped: ${cal.skipped}`);
  else notes.push(`calibrated in ${cal.ms} ms: targets ${cal.levels.map((l) => l.target).join(", ")}`);
  return { ok: true, mission: cal.mission };
}

export async function generateMission(req: GenerateRequest, deps: GenerateDeps): Promise<GenerateOutcome> {
  const city = deps.city ?? loadCity();
  const hoods = neighborhoodList(city);
  const rawText = req.text.slice(0, MAX_PROBLEM_CHARS);
  const text = scrub(rawText, { keepWords: hoods.map((n) => n.name) });
  const required = req.neighborhood ? (hoods.find((n) => n.id === req.neighborhood) ?? null) : null;
  const mentioned = detectNeighborhood(rawText, hoods);
  const claude = deps.claude === undefined ? getClaude() : deps.claude;
  const sandbox = deps.sandbox === undefined ? getSandbox() : deps.sandbox;
  const notes: string[] = [];
  if (req.neighborhood && !required) notes.push(`requested neighborhood "${req.neighborhood}" is unknown; ignored`);

  let attempts = 0;
  if (claude) {
    const ai = await generateWithClaude(claude, {
      text,
      required,
      hoods,
      city,
      sandbox,
      deadline: Date.now() + (deps.deadlineMs ?? GENERATE_DEADLINE_MS),
    });
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
  const mission = await fallbackMission({ classification, text, target: required ?? mentioned, city, store: deps.store, notes, sandbox });
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
  ctx: {
    text: string;
    required: Neighborhood | null;
    hoods: Neighborhood[];
    city: CityData;
    sandbox: PythonSandbox | null;
    deadline: number; // Date.now() value after which we stop asking Claude
  },
): Promise<AiResult> {
  const schema = buildDraftSchema(ctx.hoods.map((n) => n.id));
  // The helper turns the Zod schema into the JSON schema structured outputs expects.
  const format = betaZodOutputFormat(schema);
  const notes: string[] = [];
  let previousErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = ctx.deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) {
      notes.push(`attempt ${attempt}: skipped, generate deadline reached`);
      return { kind: "failed", attempts: attempt - 1, notes };
    }
    let response: Anthropic.Beta.BetaMessage;
    const timer = new AbortController();
    const timeout = setTimeout(() => timer.abort(), remaining);
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
      },
      // No SDK retries here: the deadline covers everything, and the fallback is instant.
      { signal: timer.signal, maxRetries: 0 },
      );
    } catch (err) {
      if (timer.signal.aborted) {
        notes.push(`attempt ${attempt}: generate deadline reached; using the fallback`);
        return { kind: "failed", attempts: attempt, notes };
      }
      // Network, auth or rate-limit trouble: a second try won't help the demo. Fall back now.
      notes.push(`attempt ${attempt}: ${describeError(err)}`);
      return { kind: "failed", attempts: attempt, notes };
    } finally {
      clearTimeout(timeout);
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
    const checked = await checkMission(mission, ctx.city, ctx.sandbox, notes);
    if (checked.ok) return { kind: "mission", mission: checked.mission, attempts: attempt, notes };
    previousErrors = checked.errors;
    notes.push(`attempt ${attempt}: failed checks: ${checked.errors.slice(0, 3).join("; ")}`);
  }
  return { kind: "failed", attempts: 2, notes };
}

// ---------------------------------------------------------------------------------------------
// Offline path: closest seed mission, re-pointed at the resident's neighborhood, or a template.

export async function fallbackMission(opts: {
  classification: Extract<Classification, { supported: true }>;
  text: string;
  target: Neighborhood | null;
  city: CityData;
  store: Store;
  notes: string[];
  sandbox: PythonSandbox | null;
}): Promise<Mission> {
  const { classification, text, target, city, store, notes, sandbox } = opts;
  const spec = themeSpec(classification.theme);
  const hoods = neighborhoodList(city);
  const id = newId("mission");
  const hoodOf = (m: Mission) => hoods.find((n) => n.id === m.area.neighborhood) ?? null;

  // Closest seed: the theme's own seed first (e.g. feed-the-block), then same need group,
  // then same neighborhood, then the same "thing".
  const seed =
    store
      .seedMissions()
      .filter((m) => m.id === spec.seedId || m.needColumn === spec.needColumn)
      .sort((a, b) => seedScore(b, spec, target) - seedScore(a, spec, target))[0] ?? null;
  const seedHood = seed ? hoodOf(seed) : null;

  const template = (hood: Neighborhood) =>
    buildTemplateMission({ theme: classification.theme, neighborhood: hood, residentText: text, id, siteCounts: siteCounts(city, hood.bbox) });

  // Candidates in order. A seed in its own neighborhood is already calibrated by hand;
  // a re-targeted seed or a template gets calibrated here.
  type Candidate = { label: string; mission: Mission; calibrate: boolean };
  const candidates: Candidate[] = [];
  if (target && seed && seedHood?.id !== target.id) {
    candidates.push({ label: `seed "${seed.id}" moved to ${target.name}`, mission: retarget(seed, { id, hood: target, fromName: seedHood?.name, text, city }), calibrate: true });
  }
  if (target && !(seed && seedHood?.id === target.id)) {
    candidates.push({ label: `built-in "${spec.title}" template in ${target.name}`, mission: template(target), calibrate: true });
  }
  if (seed && seedHood) {
    candidates.push({ label: `seed "${seed.id}" in ${seedHood.name}`, mission: retarget(seed, { id, hood: seedHood, text }), calibrate: false });
  }
  const preferred = hoods.find((n) => n.id === spec.defaultNeighborhood) ?? null;
  const rest = [preferred, ...hoods].filter((n, i, all): n is Neighborhood => !!n && n.id !== target?.id && all.findIndex((x) => x?.id === n.id) === i);
  for (const hood of rest) candidates.push({ label: `built-in "${spec.title}" template in ${hood.name}`, mission: template(hood), calibrate: true });

  for (const c of candidates) {
    const checked = await checkMission(c.mission, city, c.calibrate ? sandbox : null, notes);
    if (checked.ok) {
      notes.push(`fallback: ${c.label}`);
      return checked.mission;
    }
    notes.push(`fallback skipped ${c.label}: ${checked.errors.slice(0, 2).join("; ")}`);
  }
  const last = candidates[0];
  notes.push(`fallback: ${last.label} (no candidate passed every check)`);
  return last.mission;
}

function seedScore(m: Mission, spec: ThemeSpec, target: Neighborhood | null): number {
  let s = 0;
  if (m.id === spec.seedId) s += 8;
  if (m.needColumn === spec.needColumn) s += 4;
  if (target && m.area.neighborhood === target.id) s += 2;
  if (m.thing.toLowerCase() === spec.thing.toLowerCase()) s += 1;
  return s;
}

function retarget(
  seed: Mission,
  o: { id: string; hood: Neighborhood; fromName?: string; text: string; city?: CityData },
): Mission {
  // Sites the seed names in quotes (e.g. city.place_hub("West End Branch Library")) don't exist
  // in another neighborhood, so swap each for a site of the same kind in the new one.
  const siteSwaps = o.city && o.fromName && o.fromName !== o.hood.name ? namedSiteSwaps(seed, o.hood, o.city) : [];
  const swap = (s: string) => {
    for (const [from, to] of siteSwaps) s = s.split(from).join(to);
    return o.fromName && o.fromName !== o.hood.name ? s.split(o.fromName).join(o.hood.name) : s;
  };
  return {
    ...seed,
    id: o.id,
    title: swap(seed.title),
    story: swap(seed.story),
    residentQuote: o.text,
    area: { neighborhood: o.hood.id, bbox: o.hood.bbox },
    levels: seed.levels.map((l) => ({
      ...l,
      title: swap(l.title),
      instructions: swap(l.instructions),
      starterCode: swap(l.starterCode),
      solution: swap(l.solution),
      hints: l.hints.map(swap),
    })),
    source: { kind: "resident", text: o.text },
    approved: false,
  };
}

/** Pairs [old site name, new site name] for every site the seed's code names in quotes. */
function namedSiteSwaps(seed: Mission, hood: Neighborhood, city: CityData): [string, string][] {
  const sites = city.sites ?? [];
  const named = new Set<string>();
  for (const l of seed.levels) {
    for (const m of `${l.starterCode}\n${l.solution}`.matchAll(/["']([^"'\n]{3,80})["']/g)) named.add(m[1]);
  }
  const inNewHood = sitesIn(city, hood.bbox, seed.siteKinds as SiteKind[]) ?? [];
  const used = new Set<string>();
  const swaps: [string, string][] = [];
  for (const name of named) {
    const old = sites.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!old) continue; // a kind like "church", not a site name
    const pick =
      inNewHood.find((s) => s.kind === old.kind && !used.has(s.id)) ?? inNewHood.find((s) => !used.has(s.id));
    if (!pick) continue;
    used.add(pick.id);
    swaps.push([name, pick.name]);
  }
  // Longest names first so "West End Branch Library" is replaced before "West End".
  return swaps.sort((a, b) => b[0].length - a[0].length);
}

// ---------------------------------------------------------------------------------------------
// Saving the result

function finish(
  store: Store,
  o: { mission: Mission; text: string; source: "ai" | "fallback"; usedAI: boolean; attempts: number; notes: string[] },
): GenerateOutcome {
  store.saveMission(o.mission);
  // The card says "mission" only after an adult approves it (POST /api/missions/:id/approve).
  const problem = store.saveProblem(card(o.text, o.mission.area.neighborhood, "new"));
  store.linkMissionToProblem(o.mission.id, problem.id);
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
