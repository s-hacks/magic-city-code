import { useEffect, useRef, useState, type RefObject } from 'react';
import Editor, { type EditorHandle } from '../code/Editor';
import type { LayerGroup } from '../map/style';
import type { ThemeName } from '../theme';
import { HOUSEHOLDS_PER_DOT, mission, residents } from '../data/mock';

export interface RunState {
  status: 'idle' | 'running' | 'done' | 'error';
  before: number;
  after: number | null;
  goal: boolean;
  output: string[];
  coach: string | null;
}

interface Props {
  level: number;
  unlocked: number;
  run: RunState;
  compare: boolean;
  hidden: Set<LayerGroup>;
  theme: ThemeName;
  editorRef: RefObject<EditorHandle | null>;
  onLevel: (i: number) => void;
  onRun: () => void;
  onCompare: (on: boolean) => void;
  onToggle: (g: LayerGroup) => void;
  onHome: () => void;
  onBack: () => void;
  onTheme: () => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const families = (x: number) => Math.round(x * residents.length * HOUSEHOLDS_PER_DOT).toLocaleString();

export default function Mission(p: Props) {
  const lv = mission.levels[p.level];
  const [hintAt, setHintAt] = useState({ level: p.level, i: -1 }); // hints reset when the level changes
  const hint = hintAt.level === p.level ? hintAt.i : -1;
  const setHint = (f: (h: number) => number) => setHintAt({ level: p.level, i: f(hint) });

  const shown = p.compare || p.run.after === null ? p.run.before : p.run.after;
  const coach = p.run.coach ?? (hint >= 0 ? mission.hints[hint] : `Hi, I'm Sparks. ${lv.task} Press Run when you're ready.`);

  return (
    <>
      <header className="topbar">
        <div className="row center">
          <button className="brand link" onClick={p.onHome} title="Home (H)"><Mark /> Magic City Code</button>
          <button className="btn ghost small back-btn" onClick={p.onBack}>← All challenges</button>
        </div>
        <nav className="levels" aria-label="Levels">
          <span className="crumb">{mission.neighborhood}</span>
          {mission.levels.map((l, i) => (
            <button key={l.n} className="pill" aria-current={i === p.level} disabled={i >= p.unlocked} onClick={() => p.onLevel(i)}>
              {i >= p.unlocked ? <Lock /> : null} Level {l.n}
            </button>
          ))}
          <button className="icon-btn" onClick={p.onTheme} title="Projector mode (D)" aria-label="Toggle projector mode">
            {p.theme === 'night' ? <Sun /> : <Moon />}
          </button>
        </nav>
      </header>

      <aside className="glass panel mission-panel" aria-label="Mission">
        <p className="eyebrow">Mission · {lv.concept}</p>
        <h2 className="title">{mission.title}</h2>
        <blockquote className="quote">
          “{mission.story}”
          <cite>— a neighbor in {mission.neighborhood}</cite>
        </blockquote>

        <div className="goal">
          <span className="goal-label">Goal</span>
          <span>{lv.task} Light up <strong>{pct(lv.target)}</strong> of {mission.neighborhood}.</span>
        </div>

        <Meter value={shown} target={lv.target} goal={p.run.goal && !p.compare} />
        <div className="score" aria-live="polite">
          <span className="score-num"><CountUp value={shown} /></span>
          <span className="score-sub">
            lit · {families(shown)} families
            {p.run.after !== null && <span className="delta">{pct(p.run.before)} → {pct(p.run.after)}</span>}
          </span>
        </div>
        {p.compare && <p className="compare-note">Showing the city as it is today</p>}

        <p className="partner">With {mission.partner}</p>
      </aside>

      <section className="glass panel code-panel" aria-label="Your code">
        <div className="code-head">
          <span className="eyebrow">Your code · Python</span>
          <span className="tiny">Click a site on the map to add it</span>
        </div>
        <div className="code-body">
          <Editor ref={p.editorRef} initial={lv.starterCode} />
        </div>
        <div className="actions">
          <button className={`btn primary run ${p.run.status === 'running' ? 'busy' : ''}`} onClick={p.onRun} title="Run (R)">
            <Play /> {p.run.status === 'running' ? 'Running…' : 'Run'}
          </button>
          <button
            className="btn ghost" aria-pressed={p.compare} title="Hold to compare (B)"
            onPointerDown={() => p.onCompare(true)} onPointerUp={() => p.onCompare(false)} onPointerLeave={() => p.onCompare(false)}
          >
            Hold to compare
          </button>
        </div>
        <div className={`output ${p.run.status === 'error' ? 'is-error' : ''}`} aria-live="polite">
          <span className="eyebrow">Output</span>
          {p.run.output.length ? p.run.output.map((l, i) => <div key={i} className="out-line">{p.run.status === 'error' ? '⚠ ' : '› '}{l}</div>) : <div className="out-line muted">Press Run to see what your code does.</div>}
          {p.run.goal && p.level + 1 < mission.levels.length && (
            <button className="btn primary next" onClick={() => p.onLevel(p.level + 1)}>Level {p.level + 2} unlocked →</button>
          )}
        </div>
        <div className="sparks">
          <Spark />
          <p className="bubble" key={coach}>{coach}</p>
          {!p.run.coach && <button className="link-btn" onClick={() => setHint((h) => (h + 1) % mission.hints.length)}>{hint < 0 ? 'Ask Sparks' : 'Another hint'}</button>}
        </div>
      </section>

      <footer className="legend glass" aria-label="Map layers — click to show or hide">
        <Chip g="residents" {...p}>
          <i className="sw ash" /> far from food <i className="sw accent" /> within a {mission.walkMinutes}-min walk
        </Chip>
        <Chip g="stores" {...p}><i className="sw store" /> Grocery stores</Chip>
        <Chip g="sites" {...p}><i className="sw ring" /> Hub sites</Chip>
        <Chip g="hubs" {...p}><i className="sw beam" /> Your hubs</Chip>
        <Chip g="shelters" {...p}><i className="sw shelter" /> Shelters</Chip>
        <Chip g="streets" {...p}>Streets</Chip>
        <Chip g="buildings" {...p}>Buildings</Chip>
      </footer>
    </>
  );
}

function Chip({ g, hidden, onToggle, children }: { g: LayerGroup; children: React.ReactNode } & Pick<Props, 'hidden' | 'onToggle'>) {
  return <button className="chip" aria-pressed={!hidden.has(g)} onClick={() => onToggle(g)}>{children}</button>;
}

// Skyline that fills with light left → right; the torch (Vulcan) lights at the goal.
const BARS = [34, 52, 40, 70, 46, 88, 60, 100, 74, 50, 82, 44, 64, 38, 56, 30];
function Meter({ value, target, goal }: { value: number; target: number; goal: boolean }) {
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label="City lit">
      <div className="skyline">
        {BARS.map((h, i) => (
          <span key={i} className={(i + 0.5) / BARS.length <= value ? 'on' : ''} style={{ height: `${h}%`, transitionDelay: `${i * 40}ms` }} />
        ))}
        <span className="target" style={{ left: `${target * 100}%` }} title={`Goal ${pct(target)}`} />
      </div>
      <Torch lit={goal} />
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min((now - t0) / 900, 1);
      const x = a + (value - a) * (1 - Math.pow(1 - k, 3));
      setV(x); from.current = x;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{pct(v)}</>;
}

// --- icons ----------------------------------------------------------------
export const Mark = () => (
  <svg className="mark" viewBox="0 0 24 24" aria-hidden><path d="M12 2c2.5 3 4 5.2 4 7.5A4 4 0 0 1 12 13.5 4 4 0 0 1 8 9.5C8 7.2 9.5 5 12 2Z" fill="var(--accent)" /><rect x="10.5" y="14.5" width="3" height="7.5" rx="1" fill="currentColor" /></svg>
);
const Torch = ({ lit }: { lit: boolean }) => (
  <svg className={`torch ${lit ? 'lit' : ''}`} viewBox="0 0 24 36" aria-label={lit ? 'Goal reached' : 'Goal not reached yet'}>
    <path d="M12 2c3 3.6 5 6.4 5 9.2A5 5 0 0 1 12 16a5 5 0 0 1-5-4.8C7 8.4 9 5.6 12 2Z" className="flame" />
    <path d="M7 17h10l-2 5h-6z" fill="currentColor" /><rect x="10.5" y="22" width="3" height="12" rx="1" fill="currentColor" />
  </svg>
);
const Spark = () => (
  <svg className="spark" viewBox="0 0 32 32" aria-hidden><path d="M16 2l3 10 10 4-10 4-3 10-3-10-10-4 10-4z" fill="var(--accent)" /><circle cx="16" cy="16" r="3" fill="var(--bg)" /></svg>
);
const Play = () => <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>;
const Lock = () => <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" /><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>;
const Sun = () => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><circle cx="12" cy="12" r="4.5" fill="currentColor" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round">{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${a} 12 12)`} />)}</g></svg>;
const Moon = () => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" /></svg>;
