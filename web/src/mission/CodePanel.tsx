// The right glass panel: the editor, the big Run button, hold-to-Compare, and the output
// (printed text, friendly Python errors and rule errors in plain words).
import { Editor } from "../code/Editor";

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
}

export const CodePanel = (p: CodePanelProps) => (
  <div className="panel-inner">
    <div className="panel-title">Your code <span className="muted small">Ctrl+Enter runs it</span></div>
    <div className="editor-wrap">
      <Editor value={p.code} onChange={p.onChange} highlightLine={p.highlightLine} errorLine={p.errorLine} onRun={p.onRun} />
    </div>
    <div className="run-row">
      <button className="run-btn" onClick={p.onRun} disabled={p.running || p.loading}>{p.loading ? "Python is loading…" : p.running ? "Running…" : "▶ Run"}</button>
      <button className={`compare-btn ${p.comparing ? "on" : ""}`} disabled={!p.canCompare} {...p.compareProps} title="Hold to see the city today (or hold B)">
        Compare <span className="small">(hold)</span>
      </button>
    </div>
    <div className="output" aria-live="polite">
      <div className="output-title">Output</div>
      {p.problems.map((m, i) => (
        <div key={i} className="out-error" role="alert">⚠ {m}</div>
      ))}
      {p.status && !p.problems.length && <div className="out-ok">✓ {p.status}</div>}
      {p.stdout && <pre>{p.stdout}</pre>}
      {!p.stdout && !p.problems.length && !p.status && <div className="muted">Press Run to see what happens.</div>}
    </div>
  </div>
);
