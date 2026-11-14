// The right glass panel (UI prototype look): the editor, the big Run button,
// hold-to-compare, the output (printed text, friendly Python errors and rule errors in
// plain words, the success line with next-level / proposal buttons), and Sparks at the bottom.
import type { ReactNode } from "react";
import { Editor } from "../code/Editor";
import { Play } from "../app/icons";

export interface CodePanelProps {
  code: string;
  onChange(code: string): void;
  highlightLine: number | null;
  errorLine: number | null;
  onRun(): void;
  running: boolean;
  loading: boolean; // Python still starting
  canCompare: boolean;
  compareProps: Record<string, unknown>;
  comparing: boolean;
  stdout: string;
  problems: string[]; // plain-word errors
  status: string; // one line, e.g. "Placed 5 hubs"
  success?: string; // "You lit up 82% of West End!"
  nextLevel?: number; // 1-based number of the level just unlocked
  onNext(): void;
  onProposal?: () => void;
  coach: ReactNode; // Sparks
}

export const CodePanel = (p: CodePanelProps) => {
  const isError = p.problems.length > 0;
  const empty = !p.stdout && !isError && !p.status;
  return (
    <>
      <div className="code-head">
        <span className="eyebrow">Your code · Python</span>
        <span className="tiny">Click a site on the map to add it · Ctrl+Enter runs</span>
      </div>
      <div className="code-body">
        <Editor value={p.code} onChange={p.onChange} highlightLine={p.highlightLine} errorLine={p.errorLine} onRun={p.onRun} />
      </div>
      <div className="actions">
        <button className={`btn primary run ${p.running ? "busy" : ""}`} onClick={p.onRun} disabled={p.running || p.loading} title="Run (R)">
          <Play /> {p.loading ? "Python is loading…" : p.running ? "Running…" : "Run"}
        </button>
        <button className="btn ghost" disabled={!p.canCompare} {...p.compareProps} aria-pressed={p.comparing} title="Hold to see the city today (or hold B)">
          Hold to compare
        </button>
      </div>
      <div className={`output ${isError ? "is-error" : ""}`} aria-live="polite">
        <span className="eyebrow">Output</span>
        {p.problems.map((m, i) => (
          <div key={i} className="out-line" role="alert">⚠ {m}</div>
        ))}
        {p.status && !isError && <div className="out-line">› {p.status}</div>}
        {p.stdout && <pre className="out-pre">{p.stdout}</pre>}
        {empty && <div className="out-line muted">{p.loading ? "Python is waking up… Run turns on when it is ready." : "Press Run to see what your code does."}</div>}
        {p.success && !isError && (
          <>
            <div className="out-line out-success">✦ {p.success}</div>
            <div className="row">
              {p.nextLevel && <button className="btn primary next" onClick={p.onNext}>Level {p.nextLevel} unlocked →</button>}
              {p.onProposal && <button className={`btn ${p.nextLevel ? "ghost" : "primary"} next`} onClick={p.onProposal}>Make a proposal</button>}
            </div>
          </>
        )}
      </div>
      {p.coach}
    </>
  );
};
