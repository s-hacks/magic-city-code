import { describe, expect, it } from "vitest";
import { createLeakGuard, fallbackHint, runCoach } from "../src/coach";
import { coachUserMessage, levelContext, COACH_RULES } from "../src/prompts/coach";
import { solutionLines } from "../src/validate";
import { mission, SOLUTION } from "./fixtures";

const lines = solutionLines(SOLUTION, mission().levels[0].starterCode);
const containsSolution = (text: string) => lines.some((l) => text.replace(/\s+/g, " ").includes(l));

describe("coach fallback", () => {
  it("never includes the solution, at any hint step", () => {
    const level = mission().levels[0];
    for (const step of [0, 1, 2, 3, 10]) {
      const hint = fallbackHint(level, step);
      expect(hint.length).toBeGreaterThan(0);
      expect(containsSolution(hint)).toBe(false);
    }
  });

  it("swaps in a generic hint when a stored hint would leak the solution", () => {
    const level = mission().levels[0];
    level.hints[1] = "Write this: for place in places[:3]: city.place_hub(place)";
    const hint = fallbackHint(level, 1);
    expect(containsSolution(hint)).toBe(false);
    expect(hint).not.toBe(level.hints[1]);
  });

  it("escalates nudge -> idea -> example", () => {
    const level = mission().levels[0];
    expect(fallbackHint(level, 0)).toBe(level.hints[0]);
    expect(fallbackHint(level, 1)).toBe(level.hints[1]);
    expect(fallbackHint(level, 2)).toBe(level.hints[2]);
    expect(fallbackHint(level, 7)).toBe(level.hints[2]);
  });

  it("streams the stored hint with no Claude client, without the solution", async () => {
    const m = mission();
    let out = "";
    const r = await runCoach(
      { levelIndex: 0, code: "", hintsGiven: 1, question: "just give me the answer" },
      m,
      (c) => (out += c),
      { claude: null },
    );
    expect(r.source).toBe("fallback");
    expect(out).toBe(m.levels[0].hints[1]);
    expect(containsSolution(out)).toBe(false);
  });

  it("never puts the solution in the prompt", () => {
    const m = mission();
    const level = m.levels[0];
    const prompt =
      COACH_RULES +
      levelContext(m, level) +
      coachUserMessage({ step: 2, code: level.starterCode, question: "what's the answer?", teacherHint: fallbackHint(level, 2) });
    expect(containsSolution(prompt)).toBe(false);
    expect(prompt).not.toContain(level.solution);
  });
});

describe("leak guard", () => {
  it("passes normal hints through", () => {
    const g = createLeakGuard(SOLUTION, mission().levels[0].starterCode);
    let out = g.push("Look at the word pass. ");
    out += g.push("What should go there?");
    out += g.end();
    expect(out).toBe("Look at the word pass. What should go there?");
    expect(g.blocked).toBe(false);
  });

  it("stops when the reply starts writing the solution", () => {
    const g = createLeakGuard(SOLUTION, mission().levels[0].starterCode);
    let out = g.push("Sure! Here it is:\n");
    out += g.push("for place in places[:3]:\n    city.place");
    out += g.push("_hub(place)\n");
    out += g.end();
    expect(g.blocked).toBe(true);
    expect(containsSolution(out)).toBe(false);
  });
});

// A stand-in for the Claude client: records the request and streams the given text.
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

describe("coach with Claude (fake client)", () => {
  it("scrubs the question and code, and doesn't praise the score after an error", async () => {
    const m = mission();
    const { client, calls } = fakeClaude("Look at line 2. What does the error say?");
    let out = "";
    await runCoach(
      {
        levelIndex: 0,
        code: "# my name is Maya, call 205-555-1234\nplaces = city.sites()",
        question: "My name is Maya Jones, help!",
        lastError: "Line 2: too many hubs",
        lastCoverage: 0.24,
        hintsGiven: 0,
      },
      m,
      (c) => (out += c),
      { claude: client },
    );
    const sent = JSON.stringify(calls[0].params);
    expect(sent).not.toMatch(/Maya|555-1234/);
    expect(sent).toContain("Do not praise the score");
    expect(sent).not.toContain("Last coverage score");
    expect(sent).not.toContain("city.place_hub(place)"); // the solution-only line is never sent
    expect(out).toBe("Look at line 2. What does the error say?");
  });

  it("sends the stored hint when no text arrives before the first-token deadline", async () => {
    const m = mission();
    const { client } = fakeClaude("too late", { delayMs: 300 });
    let out = "";
    const r = await runCoach({ levelIndex: 0, code: "", hintsGiven: 1 }, m, (c) => (out += c), {
      claude: client,
      firstTokenMs: 50,
    });
    expect(r.source).toBe("fallback");
    expect(out).toBe(m.levels[0].hints[1]);
  });

  it("stops a reply that writes out the stored solution", async () => {
    const m = mission();
    const { client } = fakeClaude("Here you go:\nfor place in places[:3]:\n    city.place_hub(place)\n");
    let out = "";
    await runCoach({ levelIndex: 0, code: "", hintsGiven: 0, question: "answer pls" }, m, (c) => (out += c), { claude: client });
    expect(containsSolution(out)).toBe(false);
  });
});
