import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKE } from 'react';
import { Link } from 'react-router-dom';
import type { StageProps } from '../Landing';
import { Arrow } from '../Landing';
import { levels } from '../facts';
import { baseline, distM, fakeRun, litSet, mission, residents, sites, stores, type LngLat, type RunResult } from '../../data/mock';
import './play.css';

const N = residents.length;
const WALK = mission.walkMeters;
const basePct = Math.round((baseline.size / N) * 100);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- projection: meters around the mission center, rotated and squashed for a tilted view
const [C0, C1] = mission.center;
const COS = Math.cos((C1 * Math.PI) / 180);
const ROT = -0.35, TILT = 0.6;
function proj([lng, lat]: LngLat): [number, number] {
  const x = (lng - C0) * 111_320 * COS, y = (lat - C1) * 111_320;
  return [x * Math.cos(ROT) - y * Math.sin(ROT), -(x * Math.sin(ROT) + y * Math.cos(ROT)) * TILT];
}
const resP = residents.map((r) => proj(r.at));
const bounds = resP.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);

// --- tiny Python tokenizer
const TOK = /(#.*)|("[^"]*")|\b(for|in|lambda|True|False|None|def|return|if|else)\b|\b(\d+)\b|(\w+)(?=\()|(\w+)|(\s+|.)/g;
const CLS = ['', 'c', 's', 'k', 'n', 'f', 'i', ''];
function tokens(line: string) {
  const out: { t: string; c: string }[] = [];
  for (const m of line.matchAll(TOK)) out.push({ t: m[0], c: CLS[m.slice(1).findIndex(Boolean) + 1] });
  return out;
}

interface Anim { start: number; hubs: { p: LngLat; at: number }[]; ign: Float64Array; end: number }

export default function Play({ active, go }: StageProps) {
  const [level, setLevel] = useState(2);
  const [n, setN] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [done, setDone] = useState(false);
  const [compare, setCompare] = useState(false);
  const code = levels[level].code;
  const typing = n < code.length;

  const autoRun = useRef(false);
  const played = useRef(false);
  const anim = useRef<Anim | null>(null);
  const compareRef = useRef(false);
  const doneTimer = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { compareRef.current = compare; }, [compare]);

  const run = useCallback((i: number) => {
    const r = fakeRun(mission.levels[i].solution);
    const now = performance.now(), rm = reduced();
    const hubs = r.hubs.map((h, k) => ({ p: h.at, at: rm ? now : now + k * 350 }));
    const ign = new Float64Array(N).fill(Infinity);
    let end = now;
    for (const h of hubs) for (const res of residents) {
      if (baseline.has(res.id)) continue;
      const d = distM(res.at, h.p);
      if (d < WALK) {
        const t = rm ? now : h.at + 350 + d * 0.9;
        if (t < ign[res.id]) { ign[res.id] = t; end = Math.max(end, t); }
      }
    }
    anim.current = { start: now, hubs, ign, end };
    setResult(r);
    setDone(false);
    clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => setDone(true), end - now + 300);
  }, []);

  const select = (i: number, auto = false) => {
    autoRun.current = auto;
    anim.current = null;
    clearTimeout(doneTimer.current);
    setLevel(i);
    setResult(null);
    setDone(false);
    setN(reduced() ? levels[i].code.length : 0);
  };

  // typing, ~12ms/char; paused while the stage is hidden
  useEffect(() => {
    if (!active) return;
    if (n < code.length) {
      const t = setTimeout(() => setN(n + 1), 12);
      return () => clearTimeout(t);
    }
    if (autoRun.current) { autoRun.current = false; run(level); }
  }, [active, n, code, level, run]);

  // auto-play once
  useEffect(() => {
    if (active && !played.current) { played.current = true; select(2, true); }
  }, [active]);

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  // canvas loop
  useEffect(() => {
    if (!active) return;
    const cv = canvasRef.current!, wrap = wrapRef.current!, ctx = cv.getContext('2d')!;
    const css = getComputedStyle(cv);
    const col = (v: string) => css.getPropertyValue(v).trim();
    const ASH = col('--ash'), ACC = col('--accent'), HOT = col('--accent-2'), TXT = col('--text'), LINE = col('--line'), MUT = col('--muted'), BG = col('--bg');
    let w = 0, h = 0, s = 1, ox = 0, oy = 0, raf = 0, lastPct = -1;
    let scr = new Float32Array(N * 2);
    const sp = (p: [number, number]): [number, number] => [ox + p[0] * s, oy + p[1] * s];

    const resize = () => {
      const r = wrap.getBoundingClientRect(), dpr = devicePixelRatio || 1;
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s = Math.min(w / (bounds[2] - bounds[0]), h / (bounds[3] - bounds[1])) * 0.9;
      ox = w / 2 - ((bounds[0] + bounds[2]) / 2) * s;
      oy = h / 2 - ((bounds[1] + bounds[3]) / 2) * s;
      scr = new Float32Array(N * 2);
      resP.forEach((p, i) => { scr[i * 2] = ox + p[0] * s; scr[i * 2 + 1] = oy + p[1] * s; });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const siteP = sites.map((x) => proj(x.at));
    const storeP = stores.map((x) => proj(x.at));
    const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const a = anim.current, before = compareRef.current;
      ctx.clearRect(0, 0, w, h);

      // street grid (world meters -> tilted screen)
      ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (let k = -3000; k <= 3000; k += 250) {
        const toS = (lng: number, lat: number) => sp(proj([C0 + lng / (111_320 * COS), C1 + lat / 111_320]));
        let [x1, y1] = toS(k, -3000), [x2, y2] = toS(k, 3000);
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        [x1, y1] = toS(-3000, k); [x2, y2] = toS(3000, k);
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      }
      ctx.stroke(); ctx.globalAlpha = 1;

      // walk rings
      const rx = WALK * s, ry = WALK * s * TILT;
      if (a && !before) for (const hub of a.hubs) {
        const t = ease((now - hub.at - 300) / 650);
        if (t <= 0) continue;
        const [x, y] = sp(proj(hub.p));
        ctx.beginPath(); ctx.ellipse(x, y, rx * t, ry * t, 0, 0, Math.PI * 2);
        ctx.fillStyle = ACC; ctx.globalAlpha = 0.06; ctx.fill();
        ctx.strokeStyle = ACC; ctx.globalAlpha = 0.25 + 0.5 * (1 - t); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // residents: ash pass, then glow + core for lit
      let lit = 0;
      const isLit = (i: number) => baseline.has(i) || (!before && !!a && a.ign[i] <= now);
      ctx.fillStyle = ASH;
      for (let i = 0; i < N; i++) if (!isLit(i)) ctx.fillRect(scr[i * 2] - 0.9, scr[i * 2 + 1] - 0.9, 1.8, 1.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = ACC; ctx.globalAlpha = 0.18;
      for (let i = 0; i < N; i++) if (isLit(i)) { lit++; ctx.fillRect(scr[i * 2] - 3, scr[i * 2 + 1] - 3, 6, 6); }
      ctx.globalAlpha = 1;
      for (let i = 0; i < N; i++) if (isLit(i)) {
        const age = a && !baseline.has(i) ? now - a.ign[i] : 1e9;
        const r = age < 400 ? 1.2 + 2.4 * (1 - age / 400) : 1.2;
        ctx.fillStyle = age < 400 ? HOT : ACC;
        ctx.fillRect(scr[i * 2] - r, scr[i * 2 + 1] - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';

      // stores
      ctx.fillStyle = TXT;
      for (const p of storeP) { const [x, y] = sp(p); ctx.fillRect(x - 4, y - 4, 8, 8); }

      // candidate sites + hover label
      let hov: number = -1, best = 196;
      siteP.forEach((p, i) => {
        const [x, y] = sp(p);
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = MUT; ctx.lineWidth = 1.2; ctx.stroke();
        if (hover.current) { const d = (hover.current.x - x) ** 2 + (hover.current.y - y) ** 2; if (d < best) { best = d; hov = i; } }
      });

      // hubs: falling beam + marker
      if (a && !before) for (const hub of a.hubs) {
        const t = now - hub.at;
        if (t < 0) continue;
        const [x, y] = sp(proj(hub.p));
        const land = ease(t / 350), yy = y - (1 - land) * 70;
        if (t < 700) {
          const g = ctx.createLinearGradient(x, 0, x, y);
          g.addColorStop(0, 'transparent'); g.addColorStop(1, HOT);
          ctx.strokeStyle = g; ctx.globalAlpha = 1 - t / 700; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, yy); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(x, yy, 7, 0, Math.PI * 2); ctx.fillStyle = ACC; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = BG; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, yy, 2.5, 0, Math.PI * 2); ctx.fillStyle = HOT; ctx.fill();
      }

      if (hov >= 0) {
        const [x, y] = sp(siteP[hov]);
        const label = sites[hov].name;
        ctx.font = '600 12px "Space Grotesk", system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const lx = Math.min(Math.max(8, x - tw / 2 - 8), w - tw - 24);
        ctx.fillStyle = BG; ctx.globalAlpha = 0.85; ctx.fillRect(lx, y - 32, tw + 16, 22); ctx.globalAlpha = 1;
        ctx.fillStyle = TXT; ctx.fillText(label, lx + 8, y - 17);
      }

      const pct = Math.round((lit / N) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        if (pctRef.current) pctRef.current.textContent = `${pct}%`;
        if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [active]);

  const after = result ? Math.round((litSet(result.hubs.map((x) => x.at)).size / N) * 100) : null;
  const target = levels[level].target;
  const met = after !== null && after >= target;

  const lines = code.slice(0, n).split('\n');
  const holdKey = (on: boolean) => (e: RKE) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) setCompare(on);
  };

  return (
    <div className="lp-wrap pl">
      <header className="pl-head">
        <span className="lp-eyebrow lp-in">Try it · Mission 1</span>
        <h2 className="lp-h2 lp-in" style={{ '--d': 1 } as React.CSSProperties}>Write three lines. <span className="lp-accent">Light a neighborhood.</span></h2>
        <p className="lp-lede lp-in" style={{ '--d': 2 } as React.CSSProperties}>Place up to {mission.maxPlacements} pickup hubs in {mission.neighborhood}. Every family within a {mission.walkMinutes}‑minute walk lights up.</p>
      </header>

      <div className="pl-frame lp-card lp-in" style={{ '--d': 3 } as React.CSSProperties}>
        <div className="pl-chrome" aria-hidden>
          <span /><span /><span />
          <b>West End · Feed the Block</b>
        </div>

        <div className="pl-body">
          <div className="pl-code">
            <div className="pl-tabs" role="group" aria-label="Level">
              {levels.map((l, i) => (
                <button key={l.n} aria-pressed={i === level} onClick={() => select(i)}>
                  <span className="lp-mono">{l.n}</span> {l.concept}
                </button>
              ))}
            </div>
            <pre className="pl-pre" aria-label={`Level ${level + 1} code`}>
              {lines.map((ln, i) => (
                <div key={i} className="pl-ln">
                  <span className="pl-no">{i + 1}</span>
                  <code>
                    {tokens(ln).map((t, k) => <span key={k} className={t.c || undefined}>{t.t}</span>)}
                    {i === lines.length - 1 && <span className="pl-caret" aria-hidden />}
                  </code>
                </div>
              ))}
            </pre>
            <div className="pl-run">
              <button className="lp-btn primary" onClick={() => run(level)} disabled={typing}>
                <span aria-hidden>▶</span> Run
              </button>
              <output className="pl-out lp-mono" aria-live="polite">
                {result ? `> ${result.output.join(' ')}` : typing ? '> typing…' : '> ready'}
              </output>
            </div>
          </div>

          <div className="pl-mapcol">
            <div className="pl-map" ref={wrapRef}>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Map of West End. ${after ?? basePct}% of residents can reach food.`}
                onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); hover.current = { x: e.clientX - r.left, y: e.clientY - r.top }; }}
                onPointerLeave={() => { hover.current = null; }}
              />
              {compare && <span className="pl-badge lp-mono">Before</span>}
              <ul className="pl-legend lp-mono" aria-hidden>
                <li><i className="lit" />can reach food</li>
                <li><i />can’t yet</li>
                <li><i className="store" />store</li>
                <li><i className="site" />site</li>
              </ul>
            </div>

            <div className="pl-stats">
              <div className="pl-meter">
                <div className="pl-meter-top">
                  <span>City lit</span>
                  <span className="pl-pct lp-mono" ref={pctRef}>{basePct}%</span>
                </div>
                <div className="pl-bar">
                  <div className="pl-fill" ref={fillRef} style={{ width: `${basePct}%` }} />
                  <div className="pl-goal" style={{ left: `${target}%` }}><span className="lp-mono">goal {target}%</span></div>
                </div>
                <div className="pl-ba lp-mono">
                  <span>before <b>{basePct}%</b></span>
                  <span className="pl-ba-bars" aria-hidden>
                    <i style={{ height: `${basePct}%` }} />
                    <i className="hot" style={{ height: `${after ?? basePct}%` }} />
                  </span>
                  <span>after <b className="lp-accent">{after ?? '—'}{after !== null && '%'}</b></span>
                </div>
              </div>
              <button
                className="lp-btn ghost pl-hold"
                aria-pressed={compare}
                disabled={!result}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setCompare(true); }}
                onPointerUp={() => setCompare(false)}
                onPointerCancel={() => setCompare(false)}
                onLostPointerCapture={() => setCompare(false)}
                onKeyDown={holdKey(true)}
                onKeyUp={holdKey(false)}
                onBlur={() => setCompare(false)}
              >
                Hold to compare
              </button>
            </div>
            <p className="pl-coach" aria-live="polite">
              {done && result ? (met ? 'You did it! Look how far the light reaches now.' : 'Good start! Some families are still in the dark...') : ' '}
            </p>
          </div>
        </div>
      </div>

      <div className="pl-cta lp-in" style={{ '--d': 4 } as React.CSSProperties}>
        <Link className="lp-btn primary" to="/mission/feed-the-block">Open the full mission <Arrow /></Link>
        <button className="lp-btn ghost" onClick={() => go('data')}>See the data behind it</button>
      </div>
    </div>
  );
}
