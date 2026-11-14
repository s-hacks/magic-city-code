import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Arrow, type StageProps } from '../Landing';
import { loop } from '../facts';
import './loop.css';

// Canvas coordinate space (SVG viewBox and node % positions share it).
const W = 600, H = 760, NW = 250, NH = 150;
const pos = loop.map((_, i) => ({ x: i % 2 ? 450 : 150, y: 680 - 120 * i })); // bottom to top, zig-zag
// Edge i: out of the top port of node i, into the inner side port of node i+1.
const edges = pos.slice(0, -1).map((a, i) => {
  const b = pos[i + 1];
  const x0 = a.x, y0 = a.y - NH / 2;
  const x1 = b.x > a.x ? b.x - NW / 2 : b.x + NW / 2, y1 = b.y;
  return { d: `M${x0},${y0} C${x0},${y1} ${x0 + (x1 - x0) * 0.35},${y1} ${x1},${y1}`, x0, y0, x1, y1 };
});

const facts: Record<(typeof loop)[number]['id'], string[]> = {
  report: ['Saved to the problem board via POST /api/problems.', 'Names, phone numbers and addresses are stripped before the AI sees it.'],
  generate: ['Structured outputs: the reply always matches the Zod mission schema.', 'Server checks the neighborhood and data; retries once, then falls back to the closest seed mission.'],
  code: ['Pyodide in a Web Worker with a `city` helper module.', 'A 5-second limit: a bad loop cannot freeze the page.'],
  simulate: ['student Python → actions → simulate(mission, actions) → metrics + animation data.', 'Before/after is free: run once with no actions, once with yours.'],
  light: ['Coverage = households without a car within a 10-minute walk of a hub.', 'Up to 5 hubs; the goal is a target share, e.g. 0.8.'],
  propose: ['Map picture, before/after numbers, the student’s code, a three-sentence summary.', 'Labelled: a student proposal from public data, a starting point, not an engineering study.'],
};

const PER_EDGE = 1400; // ms a packet spends on one edge
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Loop({ active, go }: StageProps) {
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);
  const dots = useRef<SVGGElement>(null);

  // Packets: rAF along the bezier paths; a node pulses as one arrives.
  useEffect(() => {
    const g = dots.current;
    if (!g) return;
    const lens = paths.current.map((p) => p?.getTotalLength() ?? 0);
    const n = edges.length;
    const at = (u: number) => {
      const e = Math.floor(u), t = u - e; // ease in-out per edge
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      return paths.current[e]?.getPointAtLength(k * lens[e]);
    };
    const packets = Array.from(g.children) as SVGGElement[];
    const place = (u: number[]) => packets.forEach((pk, j) => Array.from(pk.children).forEach((c, k) => {
      const uu = u[j] - k * 0.045;
      const p = uu >= 0 && uu < n ? at(uu) : null;
      c.setAttribute('opacity', p ? String(1 - k / 4) : '0');
      if (p) { c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y)); }
    }));
    if (reduced()) { place([1.5, 3.5]); return; }
    if (!active) return;
    const pulse = (i: number) => { const el = nodes.current[i]; if (!el) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); };
    const last = [-1, -1];
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // n edges + 1 beat of rest at the top; two packets half a cycle apart
      const g = [0, 1].map((j) => ((now - t0) / PER_EDGE + (j * (n + 1)) / 2) % (n + 1));
      g.forEach((v, j) => { const e = Math.floor(v); if (e !== last[j]) { pulse(e); last[j] = e; } }); // e = node just left / reached
      place(g);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => {
    if (!playing || !active) return;
    const id = setInterval(() => setSel((s) => (s + 1) % loop.length), 2200);
    return () => clearInterval(id);
  }, [playing, active]);

  const step = loop[sel];
  const hot = (i: number) => hover === i || hover === i + 1 || (playing && sel === i + 1);

  return (
    <div className="lp-wrap lc" data-paused={!active || undefined}>
      <div className="lc-grid">
        <header className="lc-head">
          <span className="lp-eyebrow lp-in">How it works</span>
          <h2 className="lp-h2 lp-in" style={{ '--d': 1 } as CSSProperties}>One loop, from a neighbor’s complaint to a kid’s proposal.</h2>
          <p className="lp-lede lp-in" style={{ '--d': 2 } as CSSProperties}>
            Student code never draws anything. It returns a list of actions; one pure engine scores them and the map shows the result.
          </p>
        </header>

        <div className="lc-canvas lp-in" style={{ '--d': 2 } as CSSProperties}>
          <span className="lc-cue lc-cue-up" aria-hidden>↑ data flows up</span>
          <span className="lc-cue lc-cue-down" aria-hidden>↓ read top to bottom</span>
          <svg className="lc-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden>
            <defs>
              <radialGradient id="lc-pk"><stop offset="0" stopColor="var(--accent-2)" /><stop offset=".45" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
            </defs>
            {edges.map((e, i) => (
              <g key={i} className={`lc-edge${hot(i) ? ' hot' : ''}`}>
                <path d={e.d} className="lc-edge-base" />
                <path d={e.d} className="lc-edge-flow" ref={(el) => { paths.current[i] = el; }} />
                <circle cx={e.x0} cy={e.y0} r="5" className="lc-port" />
                <circle cx={e.x1} cy={e.y1} r="5" className="lc-port" />
              </g>
            ))}
            <g ref={dots}>
              {[0, 1].map((j) => (
                <g key={j}>{[11, 8, 6, 4].map((r, k) => <circle key={k} r={r} fill="url(#lc-pk)" opacity="0" />)}</g>
              ))}
            </g>
          </svg>
          <ol className="lc-nodes">
            {loop.map((s, i) => (
              <li key={s.id} className="lc-li" style={{ left: `${((pos[i].x - NW / 2) / W) * 100}%`, top: `${((pos[i].y - NH / 2) / H) * 100}%` }}>
                <button
                  ref={(el) => { nodes.current[i] = el; }}
                  className={`lc-node${sel === i ? ' sel' : ''}`}
                  aria-pressed={sel === i}
                  aria-controls="lc-detail"
                  onClick={() => { setSel(i); setPlaying(false); }}
                  onFocus={() => setSel(i)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="lc-node-top">
                    <span className="lc-ico">{icons[s.id]}</span>
                    <span className="lc-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lc-title">{s.title}</span>
                  </span>
                  <span className="lc-mini" aria-hidden>{minis[s.id]}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="lc-side">
          <div id="lc-detail" className="lc-detail lp-card" aria-live="polite">
            <div key={sel} className="lc-detail-in">
              <span className="lc-detail-n lp-mono">Step {sel + 1} of {loop.length}</span>
              <h3 className="lc-detail-t">{step.title}</h3>
              <p className="lc-detail-b">{step.body}</p>
              <ul className="lc-facts">{facts[step.id].map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          </div>
          <div className="lc-ctrl lp-in" style={{ '--d': 4 } as CSSProperties}>
            <button className="lp-btn ghost" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
              {playing ? <><PauseIco /> Pause</> : <><PlayIco /> Play the loop</>}
            </button>
            <button className="lp-btn primary" onClick={() => go('play')}>Run the loop yourself <Arrow /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

const sv = (d: ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const icons: Record<string, ReactNode> = {
  report: sv(<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>),
  generate: sv(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" /></>),
  code: sv(<><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" /></>),
  simulate: sv(<><path d="M4 7h7M4 12h7M4 17h7" /><path d="M14 12h6M17 9l3 3-3 3" /></>),
  light: sv(<><path d="M4 21V10l4-2v13M8 21V5l6-2v18M14 21V9l6 2v10" /><circle cx="17" cy="15" r="1" fill="currentColor" /></>),
  propose: sv(<><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h4" /></>),
};

const minis: Record<string, ReactNode> = {
  report: <span className="m-quote">“No grocery store near West End<i className="m-caret" />”</span>,
  generate: <span className="m-think">{[92, 70, 82].map((w, i) => <i key={i} style={{ width: `${w}%`, '--i': i } as CSSProperties} />)}<b>mission.json<em>…</em></b></span>,
  code: (
    <span className="m-code">
      <i><b>for</b> p <b>in</b> best[:5]:</i>
      <i>  city.place_hub(p)</i>
      <i className="m-dim"># ran in 41 ms</i>
    </span>
  ),
  simulate: <span className="m-json"><i>[&#123;place_hub: "site_12"&#125;]</i><i className="m-arrow">→ &#123;coverage: <b>0.82</b>&#125;</i></span>,
  light: <span className="m-grid">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--i': (i * 7) % 24 } as CSSProperties} />)}</span>,
  propose: <span className="m-doc"><i /><i /><i /><b>SENT</b></span>,
};

const PlayIco = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 2l9 5-9 5z" fill="currentColor" /></svg>;
const PauseIco = () => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor" /></svg>;
