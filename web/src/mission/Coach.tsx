// Sparks bar at the bottom of the code panel (UI prototype look): one bubble at a time,
// plus "Ask Sparks", the next hint, and a small question box.
// Hints and "Ask Sparks". Hints are revealed one at a time (nudge, idea, worked example on
// a different problem). Sparks streams a short reply from /api/coach; if the server is
// away, Sparks shares the next written hint instead. Sparks never writes the answer.
import { useEffect, useRef, useState } from "react";
import type { Mission } from "@mcc/shared";
import { streamCoach } from "./api";
import { Spark } from "../app/icons";

interface Bubble {
  who: "hint" | "you" | "sparks";
  text: string;
}

export interface CoachProps {
  mission: Mission;
  levelIndex: number;
  code: string;
  lastError?: string;
  lastCoverage?: number;
}

export function Coach({ mission, levelIndex, code, lastError, lastCoverage }: CoachProps) {
  const level = mission.levels[levelIndex];
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [given, setGiven] = useState(0); // how many hints/coach replies so far (0..3)
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const nextHint = () => level.hints[Math.min(given, level.hints.length - 1)];

  function showHint() {
    if (given >= level.hints.length) return;
    setBubbles((b) => [...b, { who: "hint", text: nextHint() }]);
    setGiven(given + 1);
  }

  async function ask() {
    if (busy) return;
    const q = question.trim();
    setQuestion("");
    setBusy(true);
    setBubbles((b) => [...(q ? [...b, { who: "you" as const, text: q }] : b), { who: "sparks", text: "" }]);
    const ctl = new AbortController();
    abort.current = ctl;
    const setLast = (text: string) =>
      setBubbles((b) => {
        const copy = b.slice();
        copy[copy.length - 1] = { who: "sparks", text };
        return copy;
      });
    try {
      await streamCoach(
        { mission, levelIndex, code, lastError, lastCoverage, question: q || undefined, hintsGiven: Math.min(given, 2) },
        setLast,
        ctl.signal,
      );
    } catch {
      if (!ctl.signal.aborted) setLast(nextHint()); // server away: use the written hint
    }
    setGiven((g) => Math.min(g + 1, level.hints.length));
    setBusy(false);
  }

  // One bubble at a time: the latest reply or hint (a question you typed shows above it).
  const last = bubbles[bubbles.length - 1];
  const asked = last?.who === "sparks" && bubbles[bubbles.length - 2]?.who === "you" ? bubbles[bubbles.length - 2].text : null;
  const text = last ? last.text || "…" : `Hi, I'm Sparks. ${firstSentence(level.instructions)} Press Run when you're ready.`;

  return (
    <section className="sparks" aria-label="Sparks the coach">
      <Spark />
      <div className="sparks-body">
        {asked && <p className="asked">You: {asked}</p>}
        <p className="bubble" key={bubbles.length} aria-live="polite">
          {last?.who === "hint" && <span className="who">Hint {given}/{level.hints.length} · </span>}
          {text}
        </p>
        <div className="coach-row">
          <input
            value={question}
            maxLength={300}
            placeholder="Ask Sparks a question…"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            aria-label="Question for Sparks"
          />
          <button className="link-btn" onClick={ask} disabled={busy}>Ask Sparks</button>
          <button className="link-btn" onClick={showHint} disabled={given >= level.hints.length}>
            {given >= level.hints.length ? "No more hints" : `Hint ${given + 1}/${level.hints.length}`}
          </button>
        </div>
      </div>
    </section>
  );
}

function firstSentence(text: string): string {
  const plain = text.replace(/`/g, "");
  const m = /^(.+?[.!?])(\s|$)/.exec(plain);
  return m ? m[1] : plain;
}
