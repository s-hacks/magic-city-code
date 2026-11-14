// Sparks the coach: streams one short hint. Claude writes it when a key is set; otherwise (or on
// any error) we send the level's stored hint. The level's solution is never sent to Claude, and a
// guard stops the stream if the reply starts repeating solution lines anyway.
import Anthropic from "@anthropic-ai/sdk";
import type { CoachRequest } from "@mcc/shared";
import { describeError, FALLBACK_BETA, getClaude } from "./claude";
import { COACH_MODEL } from "./config";
import { COACH_RULES, coachUserMessage, levelContext, type CoachLevel, type CoachMission } from "./prompts/coach";
import { scrub } from "./scrub";

/** If no text arrives from Claude within this time, the stored hint is sent instead. */
export const FIRST_TOKEN_DEADLINE_MS = 8000;
import { leaksSolution, solutionLines } from "./validate";

const GENERIC_HINTS = [
  "Read your code one line at a time. Which line is supposed to put something on the map?",
  "Think about what city.place_hub needs inside its ( ). It wants one place from your list.",
  "Here's the same idea on a different problem: to put water fountains in a park, you would get the list of benches, then add a fountain at each one you pick. Try that pattern with your places.",
];

export function hintStep(hintsGiven: number): number {
  return Math.max(0, Math.min(2, Math.floor(hintsGiven || 0)));
}

/** The stored hint for this step, or a generic one if the stored hint would give the answer away. */
export function fallbackHint(level: CoachLevel, hintsGiven: number): string {
  const step = hintStep(hintsGiven);
  const stored = level.hints[step];
  if (stored && stored.trim() && !leaksSolution(stored, level.solution ?? "", level.starterCode)) return stored;
  return GENERIC_HINTS[step];
}

/** Hold text back until a line or sentence ends, and stop if it starts repeating the solution. */
export function createLeakGuard(solution: string, starterCode: string) {
  const lines = solutionLines(solution, starterCode);
  let sent = "";
  let pending = "";
  let blocked = false;
  const check = (seg: string): string => {
    if (!seg) return "";
    const flat = (sent + seg).replace(/\s+/g, " ");
    if (lines.some((l) => flat.includes(l))) {
      blocked = true;
      return "";
    }
    sent += seg;
    return seg;
  };
  return {
    push(text: string): string {
      if (blocked) return "";
      pending += text;
      // Last newline or sentence end followed by a space.
      const m = /[\s\S]*(\n|[.!?]["')]?\s)/.exec(pending);
      if (!m) {
        if (pending.length <= 400) return "";
        const all = pending;
        pending = "";
        return check(all);
      }
      const cut = m[0].length;
      const seg = pending.slice(0, cut);
      pending = pending.slice(cut);
      return check(seg);
    },
    end(): string {
      const seg = pending;
      pending = "";
      return blocked ? "" : check(seg);
    },
    get blocked() {
      return blocked;
    },
    get sentAnything() {
      return sent.trim().length > 0;
    },
  };
}

export interface CoachDeps {
  claude?: Anthropic | null;
  signal?: AbortSignal;
  firstTokenMs?: number;
}

/** Streams a hint through `write`. Returns where it came from. */
export async function runCoach(
  req: Omit<CoachRequest, "missionId" | "mission">,
  /** The server's stored copy when it has one; otherwise the browser's copy (no solutions). */
  mission: CoachMission,
  write: (chunk: string) => void,
  deps: CoachDeps = {},
): Promise<{ source: "ai" | "fallback"; note?: string }> {
  const levelIndex = Math.max(0, Math.min(mission.levels.length - 1, Math.floor(req.levelIndex || 0)));
  const level = mission.levels[levelIndex];
  const step = hintStep(req.hintsGiven);
  const claude = deps.claude === undefined ? getClaude() : deps.claude;

  if (!claude) {
    write(fallbackHint(level, step));
    return { source: "fallback", note: "no Claude key" };
  }

  const guard = createLeakGuard(level.solution ?? "", level.starterCode);
  // Our own abort: fires when the student leaves, or when no text arrives in time.
  const abort = new AbortController();
  const onClientAbort = () => abort.abort();
  deps.signal?.addEventListener("abort", onClientAbort);
  let gotText = false;
  let firstTokenTimedOut = false;
  const firstTokenTimer = setTimeout(() => {
    if (gotText) return;
    firstTokenTimedOut = true;
    abort.abort();
  }, deps.firstTokenMs ?? FIRST_TOKEN_DEADLINE_MS);
  try {
    const stream = claude.beta.messages.stream(
      {
        model: COACH_MODEL,
        max_tokens: 4096,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [
          { type: "text", text: COACH_RULES, cache_control: { type: "ephemeral" } },
          { type: "text", text: levelContext(mission, level), cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: coachUserMessage({
              step,
              // Students sometimes type their name or address; scrub before it reaches the model.
              code: scrub(req.code ?? ""),
              lastError: req.lastError,
              lastCoverage: req.lastCoverage,
              question: req.question ? scrub(req.question) : undefined,
              teacherHint: fallbackHint(level, step),
            }),
          },
        ],
      },
      { signal: abort.signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        gotText = true;
        const safe = guard.push(event.delta.text);
        if (safe) write(safe);
        if (guard.blocked) {
          stream.abort();
          break;
        }
      }
    }
    if (guard.blocked) {
      if (guard.sentAnything) write(" Let's keep the rest for you to figure out!");
      else write(fallbackHint(level, step));
      return { source: guard.sentAnything ? "ai" : "fallback", note: "reply repeated solution code; stopped" };
    }

    const final = await stream.finalMessage();
    const tail = guard.end();
    if (tail) write(tail);
    // Check why the model stopped. A refusal or an empty reply gets the stored hint instead.
    if (final.stop_reason === "refusal" || !guard.sentAnything) {
      if (!guard.sentAnything) write(fallbackHint(level, step));
      return { source: guard.sentAnything ? "ai" : "fallback", note: `stop_reason ${final.stop_reason}` };
    }
    return { source: "ai" };
  } catch (err) {
    if (deps.signal?.aborted) return { source: "ai", note: "client went away" };
    if (firstTokenTimedOut && !guard.sentAnything) {
      write(fallbackHint(level, step));
      return { source: "fallback", note: "no reply within the first-token deadline" };
    }
    // Anything already streamed stays; otherwise the student still gets a hint.
    if (!guard.sentAnything) write(fallbackHint(level, step));
    return { source: "fallback", note: describeError(err) };
  } finally {
    clearTimeout(firstTokenTimer);
    deps.signal?.removeEventListener("abort", onClientAbort);
  }
}
