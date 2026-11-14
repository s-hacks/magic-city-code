// The challenge coach (Sparks beside the code-challenge editor). Streams one reply: Claude when a
// key is set, otherwise (or on any error) a stored hint. Uses the same leak guard as the mission
// coach, so a reply that starts repeating the challenge's solution is cut off.
import type { ChallengeCoachInfo, ChallengeCoachRequest } from "@mcc/shared";
import { hintStep, streamGuarded, type CoachDeps, type ReplySource } from "./coach";
import { CHALLENGE_COACH_RULES, challengeContext, challengeUserMessage } from "./prompts/challengeCoach";
import { scrub, scrubCode } from "./scrub";

const MAX_HISTORY = 6;

/** What the student gets without Claude: the checker's message in plain words, then the teacher hint. */
export function challengeFallback(info: ChallengeCoachInfo, req: Pick<ChallengeCoachRequest, "action" | "verdict" | "hintsGiven">): string {
  const hint = info.hints[hintStep(req.hintsGiven)];
  const v = req.verdict;
  if (req.action === "explain-failure" && v && !v.ok) {
    return `The checker says: ${v.title}. ${v.detail}${v.line ? ` Look near line ${v.line}.` : ""} ${hint}`;
  }
  if (req.action === "explain-failure" && v?.ok) {
    return `That test passed: ${v.detail} Press Submit to run the hidden tests too: they include flooded streets, start = goal, and a store you can't reach.`;
  }
  return hint;
}

export async function runChallengeCoach(
  info: ChallengeCoachInfo,
  req: Omit<ChallengeCoachRequest, "challengeId">,
  write: (chunk: string) => void,
  deps: CoachDeps = {},
): Promise<ReplySource> {
  const step = hintStep(req.hintsGiven);
  const fallback = challengeFallback(info, req);
  const history = (req.history ?? []).slice(-MAX_HISTORY).map((t) => ({ role: t.role, text: t.role === "student" ? scrub(t.text) : t.text }));
  return streamGuarded(
    {
      system: [CHALLENGE_COACH_RULES, challengeContext(info)],
      user: challengeUserMessage({
        action: req.action,
        step,
        // Students sometimes type their name or address; scrub before it reaches the model.
        code: scrubCode(req.code ?? ""),
        verdict: req.verdict,
        flood: req.flood,
        history,
        question: req.question ? scrub(req.question) : undefined,
        teacherHint: info.hints[step],
      }),
      fallback,
      solution: info.solution,
      starterCode: info.starterCode,
    },
    write,
    deps,
  );
}
