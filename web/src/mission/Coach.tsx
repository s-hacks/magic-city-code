// Hints and "Ask Sparks". Hints are revealed one at a time (nudge, idea, worked example on
// a different problem). Sparks streams a short reply from /api/coach; if the server is
// away, Sparks shares the next written hint instead. Sparks never writes the answer.
import { useEffect, useRef, useState } from "react";
import type { Mission } from "@mcc/shared";
import { streamCoach, toPublicMission } from "./api";

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
  const [given, setGiven] = useState(0); // hints revealed with the Hint button (0..3)
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    const el = listRef.current;
    if (el && bubbles.length) el.scrollTop = el.scrollHeight;
  }, [bubbles]);

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
        {
          missionId: mission.id,
          // Only a mission the server may not have (not a seed) is sent, with solutions removed.
          mission: mission.source.kind === "seed" ? undefined : toPublicMission(mission),
          levelIndex,
          code,
          lastError,
          lastCoverage: lastError ? undefined : lastCoverage,
          question: q || undefined,
          hintsGiven: Math.min(given, 2),
        },
        setLast,
        AbortSignal.any([ctl.signal, AbortSignal.timeout(15000)]),
      );
    } catch {
      if (!ctl.signal.aborted) {
        setLast(nextHint()); // server away or slow: use the written hint
        setGiven((g) => Math.min(g + 1, level.hints.length));
      }
    }
    setBusy(false);
  }

  return (
    <section className="coach" aria-label="Hints and Sparks">
      <div className="coach-head">
        <span className="spark" aria-hidden="true">✦</span> Sparks the coach
      </div>
      <div className="bubbles" aria-live="polite" ref={listRef}>
        {bubbles.length === 0 && <p className="muted small">Stuck? Ask Sparks, or show a hint. Sparks gives nudges, not answers.</p>}
        {bubbles.map((b, i) => (
          <div key={i} className={`bubble ${b.who}`}>
            <span className="who">{b.who === "hint" ? "Hint" : b.who === "you" ? "You" : "Sparks"}</span>
            <span className="txt">{b.text || "…"}</span>
          </div>
        ))}
      </div>
      <div className="coach-row">
        <input
          value={question}
          maxLength={300}
          placeholder="Ask Sparks a question…"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          aria-label="Question for Sparks"
        />
        <button className="chip strong" onClick={ask} disabled={busy}>Ask Sparks</button>
        <button className="chip" onClick={showHint} disabled={given >= level.hints.length}>Hint {Math.min(given + 1, level.hints.length)}/{level.hints.length}</button>
      </div>
    </section>
  );
}
