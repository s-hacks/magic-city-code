// The city problem workspace: a small Python project in the browser.
//   /problems/:id/solve              your own copy of the problem's starter project (saved in this browser)
//   /problems/:id/solutions/:sid     a submitted solution, read-only, for the poster and other coders
// Left: the collapsible file tree (and the problem brief). Middle: open-file tabs and the
// editor (README.md shows as a preview). Bottom: Output (print and errors) and Tests.
// Run executes main.py (or the open .py file); Run tests runs every tests/test_*.py.
// Submit re-runs the problem's own tests on your code and sends the project to the server.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CityProblem, CitySolution, Project, TestSummary } from "@mcc/shared";
import { PROJECT_LIMITS } from "@mcc/shared";
import { Mark } from "../app/icons";
import { useApp } from "../mission/AppContext";
import FileTree from "../workspace/FileTree";
import Markdown from "../workspace/Markdown";
import ProjectEditor, { type ProjectEditorHandle } from "../workspace/ProjectEditor";
import { cityApi, explain, hasVoted } from "../workspace/api";
import {
  addFile, addFolder, baseName, draftKey, firstFile, hasFile, langOf, local, projectBytes, remove, rename, setContent, withOfficialTests,
} from "../workspace/project";
import { HARD_LIMIT_MS, pythonLoadError, runProject, testProject, usePyStatus, type Outcome, type PyError, type TestsResult } from "../workspace/pyProject";
import { hintFor } from "../workspace/hints";
import "../workspace/workspace.css";
import MapPreview, { type MapState } from "../workspace/MapPreview";
import type { MapLayer } from "../workspace/mapData";

type Line = { kind: "out" | "err" | "info" | "ok" | "bad"; text: string; error?: PyError };
interface Draft { project: Project; savedAt: string }

const NEW_FILE_TEXT: Record<string, string> = {
  python: "",
  markdown: "# Notes\n",
  csv: "",
  json: "{}\n",
  text: "",
};

export default function WorkspacePage({ mode }: { mode: "solve" | "review" }) {
  const { id = "", sid = "" } = useParams();
  const nav = useNavigate();
  const { dayMode, toggleDay } = useApp();
  const py = usePyStatus();
  const editor = useRef<ProjectEditorHandle>(null);
  const readOnly = mode === "review";

  const [problem, setProblem] = useState<CityProblem | null>(null);
  const [solution, setSolution] = useState<CitySolution | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, boolean>>({});
  const [side, setSide] = useState<"files" | "problem">("files");
  const [panel, setPanel] = useState<"output" | "tests">("output");
  const [panelH, setPanelH] = useState(() => Math.round(window.innerHeight * 0.3));
  const [lines, setLines] = useState<Line[]>([]);
  const [tests, setTests] = useState<(TestsResult & { official: boolean }) | null>(null);
  const [busy, setBusy] = useState<false | "run" | "tests">(false);
  const [lastError, setLastError] = useState<PyError | null>(null);
  // The live map: open on wide screens; in solve mode it re-runs main.py as you type.
  const [mapOpen, setMapOpen] = useState(() => local.get("mcc.ws.map", window.innerWidth >= 1100));
  const [live, setLive] = useState(() => local.get("mcc.ws.live", true));
  const [mapLayers, setMapLayers] = useState<MapLayer[]>([]);
  const [mapRun, setMapRun] = useState<{ project: Project | null; ok: boolean } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [votes, setVotes] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);

  // --- load the problem, then the draft / starter / submitted project ------------------------
  useEffect(() => {
    let live = true;
    cityApi.get(id).then(
      (p) => {
        if (!live) return;
        setProblem(p);
        let proj: Project | undefined;
        if (mode === "review") {
          const s = p.solutions.find((x) => x.id === sid) ?? null;
          setSolution(s);
          setVotes(s?.votes ?? null);
          proj = s?.project;
          if (!s) setLoadErr("We couldn't find that solution.");
          cityApi.canReview(p.id).then((ok) => live && setCanReview(ok));
        } else {
          proj = local.get<Draft | null>(draftKey(p.id), null)?.project ?? p.starter;
        }
        if (proj) {
          setProject(proj);
          const first = firstFile(proj);
          const entry = proj.entry ?? "main.py";
          const open = [first, hasFile(proj, entry) ? entry : null].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
          setTabs(open);
          setActive(first);
        }
      },
      (e) => live && setLoadErr(explain(e)),
    );
    return () => { live = false; };
  }, [id, sid, mode]);

  // --- autosave the draft (solve mode) --------------------------------------------------------
  useEffect(() => {
    if (readOnly || !project || !problem) return;
    const t = setTimeout(() => {
      local.set(draftKey(problem.id), { project, savedAt: new Date().toISOString() } satisfies Draft);
      setSaved("Saved");
    }, 400);
    return () => clearTimeout(t);
  }, [project, problem, readOnly]);

  const file = project?.files.find((f) => f.path === active) ?? null;
  const isMd = !!file && langOf(file.path) === "markdown";
  const showPreview = isMd && (preview[file.path] ?? true);

  // Files that differ from the starter, and files with a failing test or the last error.
  const changed = useMemo(() => {
    if (!problem || !project || readOnly) return undefined;
    const base = new Map(problem.starter.files.map((f) => [f.path, f.content]));
    return new Set(project.files.filter((f) => base.get(f.path) !== f.content).map((f) => f.path));
  }, [problem, project, readOnly]);
  const flagged = useMemo(() => {
    const s = new Set<string>();
    if (lastError?.file) s.add(lastError.file);
    tests?.results.forEach((r) => !r.ok && s.add(r.file));
    return s;
  }, [lastError, tests]);

  // --- opening, closing and marking files ------------------------------------------------------
  const [pendingMark, setPendingMark] = useState<{ path: string; line: number; kind: "run" | "error" } | null>(null);
  const open = useCallback((path: string, line?: number | null, kind: "run" | "error" = "error") => {
    setTabs((t) => (t.includes(path) ? t : [...t, path]));
    setActive(path);
    if (line) {
      setPreview((p) => ({ ...p, [path]: false }));
      setPendingMark({ path, line, kind });
    }
  }, []);
  useEffect(() => {
    if (!active || showPreview) return;
    const raf = requestAnimationFrame(() => {
      if (pendingMark?.path === active) { editor.current?.mark(pendingMark.line, pendingMark.kind); setPendingMark(null); }
      else if (lastError?.file === active && lastError.line) editor.current?.mark(lastError.line, "error");
      else editor.current?.mark(null, "run");
    });
    return () => cancelAnimationFrame(raf);
  }, [active, showPreview, pendingMark, lastError]);

  const closeTab = (path: string) => {
    setTabs((t) => {
      const i = t.indexOf(path);
      const next = t.filter((x) => x !== path);
      if (path === active) setActive(next[Math.min(i, next.length - 1)] ?? null);
      return next;
    });
  };

  // --- tree edits -------------------------------------------------------------------------------
  const onCreate = (kind: "file" | "dir", path: string) => {
    setProject((p) => (p ? (kind === "dir" ? addFolder(p, path) : addFile(p, path, NEW_FILE_TEXT[langOf(path)] ?? "")) : p));
    if (kind === "file") open(path);
  };
  const onRename = (from: string, to: string) => {
    editor.current?.rename(from, to);
    const move = (p: string) => (p === from || p.startsWith(from + "/") ? to + p.slice(from.length) : p);
    setProject((p) => (p ? rename(p, from, to) : p));
    setTabs((t) => t.map(move));
    setActive((a) => (a ? move(a) : a));
  };
  const onDelete = (path: string, kind: "file" | "dir") => {
    if (!window.confirm(kind === "dir" ? `Delete the folder ${path}/ and everything in it?` : `Delete ${path}?`)) return;
    const gone = (p: string) => p === path || p.startsWith(path + "/");
    setProject((p) => (p ? remove(p, path) : p));
    setTabs((t) => {
      const next = t.filter((x) => !gone(x));
      setActive((a) => (a && gone(a) ? next[0] ?? null : a));
      return next;
    });
    editor.current?.drop(path);
  };
  const onEdit = useCallback((path: string, text: string) => {
    setProject((p) => (p ? setContent(p, path, text) : p));
    setSaved(null);
  }, []);

  const startOver = () => {
    if (!problem || !window.confirm("Start over from the starter project? Your changes in this browser will be lost.")) return;
    editor.current?.clear();
    setProject(problem.starter);
    const first = firstFile(problem.starter);
    setTabs(first ? [first] : []);
    setActive(first);
    setLines([]);
    setTests(null);
    setLastError(null);
  };

  // --- run / test -------------------------------------------------------------------------------
  // Run runs main.py, or the open .py file when it is a script of its own (has a __main__ block).
  const ownScript = !!file && langOf(file.path) === "python" && /if\s+__name__\s*==\s*["']__main__["']/.test(file.content);
  const entry = ownScript && file ? file.path : project?.entry ?? "main.py";
  const runnable = !!project && hasFile(project, entry);

  const out = (l: Line) => setLines((ls) => (ls.length > 2000 ? [...ls.slice(-1500), l] : [...ls, l]));
  const stream = (s: "out" | "err", text: string) => out({ kind: s, text });

  const timeoutLine = (): Line => ({ kind: "bad", text: `Stopped after ${HARD_LIMIT_MS / 1000} seconds. Is there a loop that never ends? Python is restarting…` });

  /** Run the entry file. A live run (quiet) doesn't switch panels or jump to the error. */
  const run = async (quiet = false) => {
    if (!project || busy || py === "failed" || !runnable) return;
    const ran = project;
    setBusy("run");
    if (!quiet) setPanel("output");
    setLastError(null);
    setLines([{ kind: "info", text: `▶ python ${entry}${quiet ? "  (live)" : ""}` }]);
    const o = await runProject({ ...ran, entry }, stream);
    setBusy(false);
    if (o.kind !== "done") {
      setMapRun({ project: ran, ok: false });
      return out(o.kind === "timeout" ? timeoutLine() : { kind: "bad", text: `Python stopped: ${o.message}` });
    }
    setMapLayers(o.result.map ?? []);
    setMapRun({ project: ran, ok: o.result.ok });
    if (o.result.ok) out({ kind: "ok", text: `✓ Finished in ${o.result.ms} ms` });
    else if (o.result.error) {
      setLastError(o.result.error);
      out({ kind: "bad", text: `${o.result.error.type}: ${o.result.error.message}`, error: o.result.error });
      if (!quiet && o.result.error.file && o.result.error.line) open(o.result.error.file, o.result.error.line);
    }
  };

  const runTests = async (official = readOnly): Promise<Outcome<TestsResult> | null> => {
    if (!project || !problem || busy || py === "failed") return null;
    setBusy("tests");
    setPanel("tests");
    setLastError(null);
    const target = official ? withOfficialTests(project, problem.starter) : project;
    setLines([{ kind: "info", text: `▶ run tests${official ? " (the problem's own tests)" : ""}` }]);
    const o = await testProject(target, stream);
    setBusy(false);
    if (o.kind === "done") {
      setTests({ ...o.result, official });
      out({ kind: o.result.passed === o.result.total && o.result.total ? "ok" : "bad", text: `${o.result.passed} of ${o.result.total} tests passed` });
    } else {
      setTests(null);
      out(o.kind === "timeout" ? timeoutLine() : { kind: "bad", text: `Python stopped: ${o.message}` });
      setPanel("output");
    }
    return o;
  };

  // ⌘↵ run, ⌘⇧↵ tests, ⌘S save now
  const keys = useRef({ run, runTests });
  keys.current = { run, runTests };

  // Live map: run main.py once Python is ready, then again ~0.9 s after each edit stops.
  // A change made while a run is going waits for it, then runs once more.
  const liveOn = mapOpen && (readOnly || live);
  const stale = !!project && mapRun?.project !== project;
  useEffect(() => {
    if (!liveOn || !stale || py !== "ready" || busy) return;
    const t = setTimeout(() => void keys.current.run(true), mapRun ? 900 : 0);
    return () => clearTimeout(t);
  }, [liveOn, stale, py, busy, project, mapRun]);
  // Remember the reader's own choices only (not the default picked from the window width).
  const toggleMap = (on: boolean) => { setMapOpen(on); local.set("mcc.ws.map", on); };
  const toggleLive = (on: boolean) => { setLive(on); local.set("mcc.ws.live", on); };
  const mapState: MapState = busy === "run" ? "running" : !mapRun ? "idle" : stale ? "stale" : mapRun.ok ? "ok" : "error";
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) void keys.current.runTests(); else void keys.current.run(); }
      if (e.key.toLowerCase() === "s") { e.preventDefault(); setSaved("Saved"); }
    };
    window.addEventListener("keydown", down, true);
    return () => window.removeEventListener("keydown", down, true);
  }, []);

  // --- bottom panel resize ----------------------------------------------------------------------
  const drag = (e: RPE<HTMLDivElement>) => {
    const startY = e.clientY;
    const startH = panelH;
    const move = (ev: PointerEvent) => setPanelH(Math.max(96, Math.min(window.innerHeight * 0.7, startH - (ev.clientY - startY))));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // --- review actions ---------------------------------------------------------------------------
  const vote = async () => {
    if (!problem || !solution || hasVoted(solution.id)) return;
    try { setVotes(await cityApi.vote(problem.id, solution.id)); } catch (e) { setToast(explain(e)); }
  };
  const choose = async () => {
    if (!problem || !solution || !window.confirm(`Choose ${solution.author}'s solution? This marks the problem solved and gives them ${300} points.`)) return;
    setChoosing(true);
    try {
      const p = await cityApi.choose(problem.id, solution.id);
      setProblem(p);
      setSolution(p.solutions.find((s) => s.id === solution.id) ?? solution);
      setToast(`Chosen. ${solution.author} earns 300 points.`);
    } catch (e) {
      setToast(explain(e));
    } finally {
      setChoosing(false);
    }
  };

  // --- render -----------------------------------------------------------------------------------
  const back = () => nav(`/problems/${id}`);
  if (loadErr || (problem && mode === "review" && solution && !solution.project)) {
    return (
      <div className="hub">
        <div className="center-card glass ws-missing">
          <h2>{loadErr ?? "This sample solution has a write-up but no code"}</h2>
          {!loadErr && solution && <p className="muted">{solution.approach}</p>}
          <div className="row">
            {loadErr && <button className="btn ghost" onClick={() => window.location.reload()}>Try again</button>}
            <button className="btn primary" onClick={() => (problem ? back() : nav("/challenges?tab=city"))}>← Back to the problem</button>
          </div>
        </div>
      </div>
    );
  }

  const pyLabel = py === "loading" ? "Loading Python…" : py === "failed" ? `Python failed to load${pythonLoadError() ? `: ${pythonLoadError()}` : ""}` : "Python ready";
  const solved = problem?.status === "Solved";

  return (
    <div className="ws" data-side={side} data-map={mapOpen ? "open" : undefined}>
      <header className="cbar ws-bar">
        <button className="brand link" onClick={() => nav("/")} title="Home"><Mark /> Magic City Code</button>
        <div className="ctitle ws-crumbs">
          <button className="crumb link-btn quiet" onClick={() => nav("/challenges?tab=city")}>City problems /</button>
          <button className="crumb link-btn quiet ws-crumb-title" onClick={back}>{problem?.title ?? "…"}</button>
          {mode === "review" && solution && <span className="crumb-tail">/ {solution.author}’s solution</span>}
          {problem && <span className={`state ${problem.status.toLowerCase()}`}>{problem.status}</span>}
        </div>
        {mode === "solve" ? (
          <>
            <button className="btn ghost small" onClick={startOver} title="Go back to the starter project">Start over</button>
            <button className="btn ghost" disabled={!!busy || py === "failed" || !runnable} onClick={() => run()} title={`Run ${entry} (⌘↵)`}>
              {busy === "run" ? <i className="spin" /> : "▶"} Run <span className="ws-entry">{baseName(entry)}</span>
            </button>
            <button className="btn ghost" disabled={!!busy || py === "failed"} onClick={() => runTests(false)} title="Run every tests/test_*.py (⌘⇧↵)">
              {busy === "tests" ? <i className="spin" /> : "✓"} Run tests
            </button>
            <button className="btn submit" disabled={!project || solved} onClick={() => setSubmitOpen(true)} title={solved ? "This problem is already solved" : "Send your project to the poster"}>Submit</button>
          </>
        ) : (
          <>
            <button className="btn ghost small" onClick={vote} disabled={!solution || hasVoted(solution.id)} title="Upvote (10 points for the author)">▲ {votes ?? 0}</button>
            <button className="btn ghost" disabled={!!busy || py === "failed" || !runnable} onClick={() => run()} title={`Run ${entry} (⌘↵)`}>
              {busy === "run" ? <i className="spin" /> : "▶"} Run <span className="ws-entry">{baseName(entry)}</span>
            </button>
            <button className="btn ghost" disabled={!!busy || py === "failed"} onClick={() => runTests(true)} title="Run the problem's own tests on this code (⌘⇧↵)">
              {busy === "tests" ? <i className="spin" /> : "✓"} Run the problem’s tests
            </button>
            {solution?.chosen ? (
              <span className="badge">✓ Chosen by poster</span>
            ) : canReview && !solved ? (
              <button className="btn submit" disabled={choosing} onClick={choose}>{choosing ? <i className="spin" /> : null} Choose this solution</button>
            ) : null}
          </>
        )}
        <button className="btn ghost small" aria-pressed={mapOpen} onClick={() => toggleMap(!mapOpen)} title="Show or hide the live map">◉ Map</button>
        <button className="icon-btn" onClick={toggleDay} title="Projector mode (D)" aria-label="Toggle projector mode">{dayMode ? "☾" : "☀"}</button>
      </header>

      <aside className="card ws-side">
        <div className="ws-side-tabs" role="tablist">
          <button role="tab" aria-selected={side === "files"} onClick={() => setSide("files")}>Files</button>
          <button role="tab" aria-selected={side === "problem"} onClick={() => setSide("problem")}>{mode === "review" ? "Solution" : "Problem"}</button>
        </div>
        {side === "files" && project && (
          <FileTree
            project={project}
            active={active}
            readOnly={readOnly}
            changed={changed}
            flagged={flagged}
            onOpen={(p) => open(p)}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={onDelete}
            title={readOnly ? "Submitted project" : "Your project"}
          />
        )}
        {side === "problem" && problem && (
          <div className="ws-brief">
            {mode === "review" && solution ? (
              <>
                <p className="eyebrow">Solution</p>
                <h3>{solution.author} <span className="tiny">· {solution.school}</span></h3>
                <p>{solution.approach}</p>
                <p className="metric">{solution.metric}</p>
                {solution.tests && <TestBadge t={solution.tests} label="When sent" />}
                <div className="tags">{solution.skills.map((s) => <span key={s} className="tag">{s}</span>)}</div>
                <hr />
              </>
            ) : null}
            <p className="eyebrow">{problem.neighborhood} · {problem.postedBy}</p>
            <h3>{problem.title}</h3>
            <p>{problem.details}</p>
            <dl>
              <dt>Data</dt><dd>{problem.data}</dd>
              <dt>Reward</dt><dd className="gold-text">★ {problem.reward}</dd>
              <dt>Due</dt><dd>{problem.due}</dd>
            </dl>
            <div className="tags">{problem.skills.map((s) => <span key={s} className="tag">{s}</span>)}</div>
          </div>
        )}
        {!project && !loadErr && <p className="tiny ws-pad"><i className="spin" /> Loading the project…</p>}
      </aside>

      <main className="ws-main">
        <section className="card ws-code">
          <div className="ws-tabs" role="tablist" aria-label="Open files">
            {tabs.map((t) => (
              <div key={t} role="tab" aria-selected={t === active} className={`ws-tab${t === active ? " active" : ""}${flagged.has(t) ? " flagged" : ""}`} onClick={() => setActive(t)} title={t}>
                <span>{baseName(t)}</span>
                {changed?.has(t) && <i className="ft-dot" />}
                <button className="ws-tab-x" aria-label={`Close ${baseName(t)}`} onClick={(e) => { e.stopPropagation(); closeTab(t); }}>×</button>
              </div>
            ))}
            <span className="ws-tabs-fill" />
            {isMd && file && (
              <button className="btn ghost small ws-md-toggle" onClick={() => setPreview((p) => ({ ...p, [file.path]: !showPreview }))}>
                {showPreview ? (readOnly ? "Show source" : "Edit") : "Preview"}
              </button>
            )}
          </div>
          <div className="ws-path tiny">{file ? file.path.split("/").join("  ›  ") : "No file open"}{readOnly && file ? "  · read-only" : ""}</div>
          <div className="ws-editor">
            {file && showPreview && <div className="ws-preview desc"><Markdown source={file.content} /></div>}
            {/* The editor stays mounted (hidden under the preview) so each file keeps its undo history. */}
            {file && (
              <div className="ws-cm" hidden={showPreview}>
                <ProjectEditor ref={editor} path={file.path} doc={file.content} readOnly={readOnly} onChange={onEdit} />
              </div>
            )}
            {!file && project && <div className="ws-empty muted">Pick a file on the left to open it.</div>}
          </div>
          <div className="ws-status tiny">
            <span className={`ws-py ${py}`}>{py === "loading" ? <i className="spin" /> : <i className="dot" />} {pyLabel}</span>
            <span>{project ? `${project.files.length} files · ${(projectBytes(project) / 1024).toFixed(1)} KB` : ""}</span>
            {!readOnly && <span>{saved ?? "Saving…"} in this browser</span>}
            <span className="ws-keys">⌘↵ run · ⌘⇧↵ tests</span>
          </div>
        </section>

        <div className="ws-resize" onPointerDown={drag} role="separator" aria-orientation="horizontal" aria-label="Resize the output panel" />

        <section className="card ws-panel" style={{ height: panelH }}>
          <div className="ws-panel-head" role="tablist">
            <button role="tab" aria-selected={panel === "output"} onClick={() => setPanel("output")}>Output</button>
            <button role="tab" aria-selected={panel === "tests"} onClick={() => setPanel("tests")}>
              Tests {tests && <span className={`score ${tests.passed === tests.total && tests.total ? "ok" : "bad"}`}>{tests.passed}/{tests.total}</span>}
            </button>
            <span className="ws-tabs-fill" />
            {panel === "output" && lines.length > 0 && <button className="link-btn quiet" onClick={() => setLines([])}>Clear</button>}
          </div>
          {panel === "output" ? (
            <div className="ws-out mono" role="log" aria-live="polite">
              {lines.length === 0 && <span className="muted">Press Run to run {baseName(entry)}. What it prints shows up here.</span>}
              {lines.map((l, i) => (
                <div key={i} className={`ws-line ${l.kind}`}>
                  {l.text}
                  {l.error && <ErrorDetail error={l.error} onOpen={open} />}
                </div>
              ))}
            </div>
          ) : (
            <div className="ws-tests">
              {!tests && <p className="muted">Press <strong>Run tests</strong> to run every <code>test_*.py</code> file. Each <code>test_</code> function passes if nothing goes wrong inside it.</p>}
              {tests && (
                <>
                  <p className="tiny">{tests.official ? "The problem’s own tests" : "Your project’s tests"} · {tests.ms} ms</p>
                  {tests.total === 0 && <p className="muted">No tests found. Test files are named <code>test_something.py</code> and hold functions named <code>test_…</code>.</p>}
                  {tests.results.map((r) => (
                    <button key={r.name} className={`ws-test ${r.ok ? "ok" : "bad"}`} onClick={() => open(r.file, r.line, r.ok ? "run" : "error")}>
                      <span className="ws-test-mark">{r.ok ? "✓" : "✗"}</span>
                      <span className="ws-test-name">{r.name.split("::").pop()}<small>{r.file}{r.line ? `:${r.line}` : ""}</small></span>
                      {!r.ok && r.message && <span className="ws-test-msg">{r.message}</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </section>
      </main>

      {mapOpen && project && (
        <MapPreview
          project={project}
          layers={mapLayers}
          theme={dayMode ? "day" : "night"}
          state={mapState}
          live={readOnly ? null : live}
          onLive={toggleLive}
          onClose={() => toggleMap(false)}
        />
      )}

      {submitOpen && problem && project && (
        <SubmitDialog
          problem={problem}
          project={project}
          runOfficial={() => runTests(true)}
          onClose={() => setSubmitOpen(false)}
          onSent={(s) => { setSubmitOpen(false); nav(`/problems/${problem.id}?sent=${encodeURIComponent(s.id)}`); }}
        />
      )}
      {toast && <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>{toast}</div>}
    </div>
  );
}

function ErrorDetail({ error, onOpen }: { error: PyError; onOpen: (path: string, line?: number | null) => void }) {
  const hint = hintFor(error);
  return (
    <div className="ws-err">
      {error.file && (
        <button className="link-btn ws-err-loc" onClick={() => onOpen(error.file!, error.line)}>
          {error.file}{error.line ? `, line ${error.line}` : ""} →
        </button>
      )}
      {hint && <div className="ws-hint">💡 {hint}</div>}
      {error.trace && <pre className="ws-trace">{error.trace}</pre>}
    </div>
  );
}

function TestBadge({ t, label }: { t: TestSummary; label: string }) {
  const all = t.total > 0 && t.passed === t.total;
  return <p className={`ws-testbadge ${all ? "ok" : "bad"}`}>{label}: {t.passed}/{t.total} of the problem’s tests passed</p>;
}

/** The submit form. Opening it re-runs the problem's own tests on the student's code. */
function SubmitDialog({ problem, project, runOfficial, onClose, onSent }: {
  problem: CityProblem;
  project: Project;
  runOfficial: () => Promise<Outcome<TestsResult> | null>;
  onClose: () => void;
  onSent: (s: CitySolution) => void;
}) {
  const me = local.get<{ author: string; school: string }>("mcc.solver", { author: "", school: "" });
  const [check, setCheck] = useState<"running" | TestSummary | "failed">("running");
  const [skills, setSkills] = useState<string[]>(problem.skills);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runOfficial().then((o) => {
      if (o?.kind !== "done") return setCheck("failed");
      setCheck({ passed: o.result.passed, total: o.result.total, results: o.result.results.slice(0, 50).map((r) => ({ name: r.name, ok: r.ok, ...(r.message ? { message: r.message.slice(0, 300) } : {}) })) });
    });
  }, [runOfficial]);

  const bytes = projectBytes(project);
  const tooBig = bytes > PROJECT_LIMITS.maxProjectBytes || project.files.length > PROJECT_LIMITS.maxFiles;

  const send = async (f: FormData) => {
    const author = String(f.get("author") ?? "").trim();
    const school = String(f.get("school") ?? "").trim();
    local.set("mcc.solver", { author, school });
    setSending(true);
    setErr(null);
    try {
      const sol = await cityApi.submit(problem, {
        author,
        school,
        approach: String(f.get("approach") ?? "").trim(),
        metric: String(f.get("metric") ?? "").trim(),
        skills,
        project,
        ...(typeof check === "object" ? { tests: check } : {}),
      });
      onSent(sol);
    } catch (e) {
      setErr(explain(e));
      setSending(false);
    }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <form className="glass modal ws-submit" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void send(new FormData(e.currentTarget)); }}>
        <h2>Submit your solution</h2>
        <p className="muted">for “{problem.title}”. {problem.postedBy} will read your write-up, open your project and run it.</p>

        <div className={`ws-check ${check === "running" ? "" : typeof check === "object" && check.total > 0 && check.passed === check.total ? "ok" : "bad"}`}>
          {check === "running" && <><i className="spin" /> Running the problem’s own tests on your code…</>}
          {check === "failed" && <>The tests couldn’t finish (see Output). You can still send it, and the poster will see that.</>}
          {typeof check === "object" && (
            <>
              <strong>{check.passed} of {check.total} tests pass.</strong>{" "}
              {check.passed === check.total ? "Nice work." : "You can still send it. The poster sees the score, and you can send a better one later."}
            </>
          )}
        </div>

        <div className="row two">
          <label className="field"><span>First name or nickname</span><input name="author" required maxLength={20} defaultValue={me.author} placeholder="maya_codes" autoComplete="off" /></label>
          <label className="field"><span>School or group</span><input name="school" required maxLength={60} defaultValue={me.school} placeholder="Woodlawn High" /></label>
        </div>
        <label className="field"><span>Your approach</span><textarea name="approach" required rows={4} maxLength={1200} placeholder="I counted 311 reports per inlet with a dictionary, then…" /></label>
        <label className="field"><span>Your result, in one line</span><input name="metric" required maxLength={140} placeholder="Top 10 inlets cover 64% of flooded homes" /></label>
        <div className="field">
          <span>Skills you used</span>
          <div className="skill-filter ws-skills">
            {[...new Set([...problem.skills, "Loops", "Dictionaries", "Sorting", "Functions", "Testing"])].map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={skills.includes(s)} onClick={() => setSkills((k) => (k.includes(s) ? k.filter((x) => x !== s) : [...k, s]))}>{s}</button>
            ))}
          </div>
        </div>
        <p className="tiny">Sends all {project.files.length} files ({(bytes / 1024).toFixed(1)} KB). Leave out your full name, address and phone number. We remove them if we spot them.</p>
        {tooBig && <p className="ws-why">This project is over the limit ({PROJECT_LIMITS.maxFiles} files, {PROJECT_LIMITS.maxProjectBytes / 1000} KB). Remove some files first.</p>}
        {err && <p className="ws-why" role="alert">{err}</p>}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn submit" disabled={sending || check === "running" || tooBig || skills.length === 0}>{sending ? <i className="spin" /> : null} Send solution</button>
        </div>
      </form>
    </div>
  );
}
