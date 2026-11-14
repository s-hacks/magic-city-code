import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Editor, { type EditorHandle } from '../code/Editor';
import { applyTheme, makeStyle } from '../map/style';
import { runPython, setup, type TestRun } from '../py/runner';
import type { BaseTest, Challenge, Verdict, Viz } from '../challenges/types';
import type { ThemeName } from '../theme';
import { BIRMINGHAM } from '../data/mock';
import { Mark } from './Mission';

interface Row<T> { test: T; run: TestRun | null; verdict: Verdict | null }
const REPLAY_SECONDS = 6;
const store = { // per-viewer draft; storage may be unavailable
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export default function ChallengePage<D, T extends BaseTest>({ ch, theme, onHome, onList, onTheme }: { ch: Challenge<D, T>; theme: ThemeName; onHome: () => void; onList: () => void; onTheme: () => void }) {
  const mapBox = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const viz = useRef<Viz<T> | null>(null);
  const editor = useRef<EditorHandle>(null);
  const [data, setData] = useState<D | null>(null);
  const [py, setPy] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState<false | 'run' | 'submit'>(false);
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<'run' | 'submit' | null>(null);
  const [fails, setFails] = useState(0);
  const [ghost, setGhost] = useState(false);
  const [k, setK] = useState(0);
  const [len, setLen] = useState(0);
  const [playing, setPlaying] = useState(false);
  const draftKey = `draft:${ch.id}`;

  // --- load data + map + python ---------------------------------------------
  useEffect(() => {
    const m = new maplibregl.Map({ container: mapBox.current!, style: makeStyle(theme), center: BIRMINGHAM, zoom: 13.4, pitch: 45, bearing: -15, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.current = m;
    const mapReady = new Promise((r) => m.on('load', r));
    let alive = true;
    ch.load().then(async ({ data, raw }) => {
      await mapReady;
      if (!alive) return;
      viz.current = ch.createViz(m, data);
      setData(data);
      setup(ch.id, ch.harness, raw).then(() => alive && setPy('ready'), () => alive && setPy('failed'));
    });
    return () => { alive = false; viz.current?.destroy(); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch]);

  useEffect(() => { if (map.current?.loaded()) applyTheme(map.current, theme); }, [theme]);

  const visible = data ? ch.tests(data).filter((t) => t.visible) : [];

  // Draw a test (and its replay, if it ran) on the map.
  const showRow = useCallback((row: Row<T>) => {
    if (!viz.current) return;
    editor.current?.mark(null, 'run');
    const n = viz.current.show(row.test, row.run, row.verdict);
    viz.current.ghost(false);
    setGhost(false);
    setLen(n); setK(0);
    setPlaying(!!row.run);
    if (row.run && n === 0) finish(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (row: Row<T> | undefined) => {
    viz.current?.finish();
    setPlaying(false);
    if (row?.verdict?.line) editor.current?.mark(row.verdict.line, 'error');
    else editor.current?.mark(null, 'run');
  };

  // first view: visible test 1, nothing run yet
  useEffect(() => {
    if (data && !rows.length) showRow({ test: visible[0], run: null, verdict: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // --- replay loop -------------------------------------------------------------
  const kRef = useRef(0);
  kRef.current = k;
  const rowRef = useRef<Row<T> | undefined>(undefined);
  rowRef.current = rows[sel];
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const step = Math.max(1, Math.ceil(len / (REPLAY_SECONDS * 60)));
    const tick = () => {
      const next = Math.min(len, kRef.current + step);
      const line = viz.current!.seek(next);
      editor.current?.mark(line || null, 'run', false); // no scrolling mid-replay: it made the editor jump
      setK(next);
      if (next >= len) finish(rowRef.current);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, len]);

  const scrub = (v: number) => {
    setPlaying(false);
    setK(v);
    const line = viz.current!.seek(v);
    if (v >= len) finish(rows[sel]);
    else editor.current?.mark(line || null, 'run');
  };

  // --- run / submit ----------------------------------------------------------------
  const [queued, setQueued] = useState<'run' | 'submit' | null>(null);
  const execute = async (kind: 'run' | 'submit') => {
    if (py === 'loading') { setQueued(kind); return; } // run as soon as Python is ready
    if (!data || busy || py !== 'ready' || !editor.current) return;
    const code = editor.current.getCode();
    store.set(draftKey, code);
    const tests = kind === 'submit' ? ch.tests(data) : ch.tests(data).filter((t) => t.visible);
    setBusy(kind); setPlaying(false);
    editor.current.mark(null, 'run');
    let runs: TestRun[] | 'killed';
    try {
      runs = await runPython(code, ch.payload(tests, data));
    } catch (e) {
      runs = tests.map((t) => ({ id: t.id, events: [], result: null, error: { line: 0, message: String(e) }, timedOut: false, ms: 0 }));
    }
    if (runs === 'killed') runs = [{ id: tests[0].id, events: [], result: null, error: null, timedOut: true, ms: 0 }];

    // check in order, stop at the first failure
    const out: Row<T>[] = [];
    let failed = -1;
    tests.forEach((t, i) => {
      const run = failed < 0 ? runs[i] ?? null : null;
      const verdict = run ? ch.check(t, run, data) : null;
      if (verdict && !verdict.ok && failed < 0) failed = i;
      out.push({ test: t, run, verdict });
    });
    setRows(out); setMode(kind); setBusy(false);
    if (kind === 'submit' && failed >= 0) setFails((f) => f + 1);
    // replay the failing test, or the first visible one
    const pick = failed >= 0 ? failed : 0;
    setSel(pick);
    showRow(out[pick]);
  };

  useEffect(() => {
    if (py === 'ready' && queued) { setQueued(null); execute(queued); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [py, queued]);

  // demo keys: R run, S submit, 1 load solution, 0 reset
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('.cm-editor, input, textarea') || e.metaKey || e.ctrlKey || e.altKey) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); execute('run'); }
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'r') execute('run');
      if (key === 's') execute('submit');
      if (key === '1') editor.current?.setCode(ch.solution);
      if (key === '0') editor.current?.setCode(ch.starterCode);
      if (key === ' ' && len) { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', down, true); // capture, so ⌘↵ runs before the editor inserts a newline
    return () => window.removeEventListener('keydown', down, true);
  });

  const cur = rows[sel];
  const accepted = mode === 'submit' && rows.length > 0 && rows.every((r) => r.verdict?.ok);
  const passed = rows.filter((r) => r.verdict?.ok).length;

  return (
    <div className="challenge">
      <header className="cbar">
        <button className="brand link" onClick={onHome} title="Home (H)"><Mark /> Magic City Code</button>
        <button className="btn ghost small back-btn" onClick={onList}>← All challenges</button>
        <div className="ctitle">
          {ch.title}
          <span className={`diff ${ch.difficulty.toLowerCase()}`}>{ch.difficulty}</span>
        </div>
        <button className="icon-btn" onClick={onTheme} title="Projector mode (D)" aria-label="Toggle projector mode">{theme === 'night' ? '☀' : '☾'}</button>
      </header>

      <section className="cleft">
        <article className="card desc">
          <p className="eyebrow grad-text">{ch.neighborhood}</p>
          <h1>{ch.title}</h1>
          <div className="tags">{ch.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
          {data ? <ch.Description data={data} /> : <p className="muted">Loading Birmingham streets…</p>}
        </article>

        <div className="card code">
          <div className="code-head">
            <span className="eyebrow">Python</span>
            <span className="row">
              <button className="link-btn quiet" onClick={() => editor.current?.setCode(ch.starterCode)}>Reset</button>
            </span>
          </div>
          <div className="code-body"><Editor ref={editor} initial={store.get(draftKey) ?? ch.starterCode} /></div>
          <div className="actions">
            <span className="tiny status">{py === 'loading' ? <><i className="spin" /> {queued ? `Loading Python… will ${queued} when ready` : 'Loading Python…'}</> : py === 'failed' ? 'Python failed to load. Check your connection.' : '⌘↵ to run'}</span>
            <button className="btn ghost" disabled={!!busy || py === 'failed'} onClick={() => execute('run')} title="Run visible tests (R)">
              {busy === 'run' ? <i className="spin" /> : '▶'} Run
            </button>
            <button className="btn submit" disabled={!!busy || py === 'failed'} onClick={() => execute('submit')} title="Submit: all tests (S)">
              {busy === 'submit' ? <i className="spin" /> : null} Submit
            </button>
          </div>
        </div>
      </section>

      <section className="cright">
        <div className="cmap">
          <div ref={mapBox} className="cmap-canvas" />
          <div className="map-legend">
            <span><i className="sw blue" /> explored</span>
            <span><i className="sw gold" /> your route</span>
            {ghost && <span><i className="sw ghost" /> best route</span>}
          </div>
          {len > 0 && (
            <div className="timeline glass">
              <button className="icon-btn solid" onClick={() => (k >= len ? (scrub(0), setPlaying(true)) : setPlaying((p) => !p))} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <input type="range" min={0} max={len} value={k} onChange={(e) => scrub(Number(e.target.value))} aria-label="Replay timeline" />
              <span className="tiny mono">{k.toLocaleString()} / {len.toLocaleString()} steps</span>
            </div>
          )}
        </div>

        <div className="results card">
          <div className="results-head">
            <span className="eyebrow">{mode === 'submit' ? 'Submission' : 'Test results'}</span>
            {rows.length > 0 && <span className={`score ${accepted ? 'ok' : ''}`}>{accepted ? 'Accepted' : `${passed} / ${rows.length} passed`}</span>}
            {fails >= 2 && cur?.verdict && !cur.verdict.ok && (
              <button className="btn ghost small" aria-pressed={ghost} onClick={() => { viz.current?.ghost(!ghost); setGhost(!ghost); }}>
                {ghost ? 'Hide' : 'Compare with'} best route
              </button>
            )}
          </div>
          <div className="test-tabs" role="tablist">
            {(rows.length ? rows : visible.map((t) => ({ test: t, run: null, verdict: null }))).map((r, i) => (
              <button
                key={r.test.id} role="tab" aria-selected={rows.length > 0 && i === sel}
                className={`test-tab ${r.verdict ? (r.verdict.ok ? 'ok' : 'bad') : ''}`}
                disabled={!rows.length || (!r.run && !r.verdict)}
                onClick={() => { setSel(i); showRow(r); }}
              >
                <i className="dot" /> {r.test.visible ? `Case ${i + 1}` : `Hidden ${i + 1}`}
              </button>
            ))}
          </div>
          {cur ? (
            <div className={`verdict ${cur.verdict?.ok ? 'ok' : cur.verdict ? 'bad' : ''}`}>
              <div className="verdict-title">{cur.verdict ? cur.verdict.title : 'Not run (an earlier test failed)'}</div>
              {cur.verdict && <div className="verdict-detail">{cur.verdict.detail}</div>}
              <div className="tiny">{cur.test.visible || cur.verdict ? cur.test.name : 'Hidden test'}{cur.run ? ` · ${cur.run.ms} ms · ${(cur.run.events.length / 3).toLocaleString()} steps` : ''}</div>
            </div>
          ) : (
            <p className="muted small-p">Press <strong>Run</strong> to try the two sample cases and watch your code explore the streets. <strong>Submit</strong> also runs hidden tests.</p>
          )}
          {accepted && <div className="accepted">All {rows.length} tests passed. Every kid on this list can find their way to fresh food.</div>}
        </div>
      </section>
    </div>
  );
}
