// Checks the challenge coach: its fallback never holds the solution, it explains a failing test in
// plain words, the prompt carries the code and test result but not the solution, and a reply that
// starts repeating the solution is cut off (with a fake Claude client).
import { describe, expect, it } from "vitest";
import { routeCoachInfo } from "@mcc/shared";
import { challengeFallback, runChallengeCoach } from "../src/challengeCoach";
import { solutionLines } from "../src/validate";

const info = routeCoachInfo;
const lines = solutionLines(info.solution, info.starterCode);
const leaks = (text: string) => lines.some((l) => text.replace(/\s+/g, " ").includes(l));
const failing = { ok: false, title: "Route ends in the wrong place", detail: "It should end at Publix (corner 6228) but ends at corner 7974.", testName: "Avondale Elementary School -> Publix" };

function fakeClaude(text: string, opts: { delayMs?: number } = {}) {
  const calls: { params: any }[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: any, reqOpts: { signal?: AbortSignal }) {
          calls.push({ params });
          let aborted = false;
          reqOpts.signal?.addEventListener("abort", () => (aborted = true));
          return {
            abort() {
              aborted = true;
            },
            async *[Symbol.asyncIterator]() {
              if (opts.delayMs) {
                await new Promise((r) => setTimeout(r, opts.delayMs));
                if (aborted) throw new Error("aborted");
              }
              for (const piece of text.match(/.{1,7}/gs) ?? []) {
                yield { type: "content_block_delta", delta: { type: "text_delta", text: piece } };
              }
            },
            async finalMessage() {
              return { stop_reason: "end_turn", content: [] };
            },
          };
        },
      },
    },
  };
  return { client: client as any, calls };
}

describe("challenge coach", () => {
  it("falls back to hints that never hold the solution, escalating by step", () => {
    for (const step of [0, 1, 2, 9]) {
      const text = challengeFallback(info, { action: "hint", hintsGiven: step });
      expect(text.length).toBeGreaterThan(20);
      expect(leaks(text)).toBe(false);
    }
    expect(challengeFallback(info, { action: "hint", hintsGiven: 0 })).toBe(info.hints[0]);
    expect(challengeFallback(info, { action: "hint", hintsGiven: 5 })).toBe(info.hints[2]);
  });

  it("explains a failing test with the checker's words when Claude is off", async () => {
    let out = "";
    const r = await runChallengeCoach(info, { action: "explain-failure", code: info.starterCode, verdict: failing, hintsGiven: 0 }, (c) => (out += c), { claude: null });
    expect(r.source).toBe("fallback");
    expect(out).toContain("Route ends in the wrong place");
    expect(out).toContain("corner 6228");
  });

  it("sends the numbered code, the test result and the chat, but never the solution", async () => {
    const { client, calls } = fakeClaude("Look at line 11: you return [start] right away. What should the loop build first?");
    let out = "";
    const r = await runChallengeCoach(
      info,
      { action: "explain-failure", code: info.starterCode, verdict: failing, history: [{ role: "student", text: "why?" }], question: "what is wrong", hintsGiven: 1 },
      (c) => (out += c),
      { claude: client },
    );
    expect(r.source).toBe("ai");
    expect(out).toContain("line 11");
    const sent = JSON.stringify(calls[0].params);
    expect(sent).toContain("Route ends in the wrong place");
    expect(sent).toContain(" 11| ");
    expect(sent).toContain("Student: why?");
    expect(leaks(sent)).toBe(false);
  });

  it("cuts off a reply that starts writing the solution", async () => {
    const { client } = fakeClaude("Sure, here it is:\n" + info.solution);
    let out = "";
    await runChallengeCoach(info, { action: "chat", code: "", question: "just give me the code", hintsGiven: 0 }, (c) => (out += c), { claude: client });
    expect(leaks(out)).toBe(false);
  });
});
