// Landing page, "Data" stage: animated numbers and the problem list, all taken from the sourced facts in facts.ts.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Arrow, type StageProps } from '../Landing';
import { city, homelessCounts, problems } from '../facts';
import './data.css';

type PId = (typeof problems)[number]['id'];
type TipFn = (e: MouseEvent | FocusEvent | null, text?: string) => void;
type Kpi = { v: number; dec?: number; pre?: string; suf?: string; label: string; hot?: boolean };

const CYCLE_MS = 6000;
const OUT_MS = 320;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n: number, dec = 0) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const samePointDrop = Math.round((1 - city.homicidesSamePoint.y2026 / city.homicidesSamePoint.y2024) * 100); // 74

const KPIS: Record<PId, Kpi[]> = {
  food: [
    { v: city.foodDesertShare, pre: '~', suf: '%', label: 'of residents live in food deserts', hot: true },
    { v: city.povertyRate, dec: 1, suf: '%', label: 'poverty rate, nearly double the metro' },
  ],
  crime: [
    { v: city.homicides.y2026q3, label: 'homicides through Q3 2026', hot: true },
    { v: samePointDrop, pre: '−', suf: '%', label: 'vs the same point in 2024' },
    { v: city.homicides.y2024, label: 'homicides in 2024, a record' },
  ],
  housing: [
    { v: city.homelessStudents.y2026, label: 'homeless students, up from 649', hot: true },
    { v: city.unsheltered, pre: '~', label: 'people unsheltered at any time' },
    { v: city.rentIncrease, pre: '+', suf: '%', label: 'rent increase, 2023–25' },
  ],
  transit: [
    { v: city.busOnTime, suf: '%', label: 'of buses run on time', hot: true },
    { v: city.stormInletsNeedRepair, pre: '~', label: 'storm inlets need repair' },
    { v: city.stormInlets, label: 'storm inlets citywide' },
  ],
  water: [
    { v: city.waterCallsPerDay, suf: '+', label: 'calls to the water utility a day', hot: true },
    { v: city.waterUnbilledShare, pre: '~', suf: '%', label: 'of water unbilled or leaked' },
  ],
  neglect: [
    { v: city.demolitionsSince2018, pre: '~', label: 'demolitions since 2018', hot: true },
    { v: 1, pre: '#', label: '311 complaint: stray animals' },
  ],
};

export default function Data({ active, go }: StageProps) {
  const [sel, setSel] = useState<PId>(problems[0].id);
  const [shown, setShown] = useState<PId>(problems[0].id);
  const [leaving, setLeaving] = useState(false);
  const [playing, setPlaying] = useState(() => !reduced());
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const morph = useRef(0);
  // morph: outgoing collapses, then incoming mounts and draws in
  const select = useCallback((id: PId) => {
    setSel(id);
    setTip(null);
    clearTimeout(morph.current);
    if (reduced()) { setShown(id); return; }
    setLeaving(true);
    morph.current = window.setTimeout(() => { setShown(id); setLeaving(false); }, OUT_MS);
  }, []);
  useEffect(() => () => clearTimeout(morph.current), []);
  // keep the selected chip visible when the rail is a horizontal strip (mobile)
  useEffect(() => {
    const el = tabs.current[problems.findIndex((p) => p.id === sel)], rail = el?.parentElement;
    if (el && rail && rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: el.offsetLeft - rail.offsetLeft - 8, behavior: reduced() ? 'auto' : 'smooth' });
  }, [sel]);

  // auto-cycle while on screen
  useEffect(() => {
    if (!active || !playing) return;
    const t = window.setTimeout(() => select(problems[(problems.findIndex((p) => p.id === sel) + 1) % problems.length].id), CYCLE_MS);
    return () => clearTimeout(t);
  }, [active, playing, sel, select]);

  const pick = (id: PId) => { setPlaying(false); if (id !== sel) select(id); };

  const onRailKey = (e: KeyboardEvent, i: number) => {
    const d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? problems.length - 1 : d ? (i + d + problems.length) % problems.length : -1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation(); // keep arrows from flipping the landing stage
    pick(problems[j].id);
    tabs.current[j]?.focus();
  };

  const showTip = useCallback<TipFn>((e, text) => {
    const box = panel.current?.getBoundingClientRect();
    if (!e || !text || !box) { setTip(null); return; }
    let x: number, y: number;
    if ('clientX' in e) { x = e.clientX; y = e.clientY; }
    else { const r = (e.currentTarget as Element).getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    setTip({ x: x - box.left, y: y - box.top, text });
  }, []);

  const cur = problems.find((p) => p.id === shown)!;

  return (
    <div className={`lp-wrap dt${active ? '' : ' dt-paused'}`}>
      <header className="dt-head">
        <div className="dt-head-copy">
          <span className="lp-eyebrow lp-in">The city</span>
          <h2 className="lp-h2 lp-in" style={{ '--d': 1 } as CSSProperties}>Birmingham’s problems are now everyday ones.</h2>
          <p className="lp-lede lp-in" style={{ '--d': 2 } as CSSProperties}>Crime fell fast. Water bills, rent, buses and empty lots did not, and those are what residents report every day.</p>
        </div>
        <button className="lp-btn primary lp-in" style={{ '--d': 3 } as CSSProperties} onClick={() => go('missions')}>
          See the missions these become <Arrow />
        </button>
      </header>

      <div className="dt-board lp-in" style={{ '--d': 4 } as CSSProperties}>
        <div className="dt-rail-wrap">
          <div className="dt-rail" role="tablist" aria-label="Birmingham problems" aria-orientation="vertical">
            {problems.map((p, i) => (
              <button
                key={p.id}
                ref={(el) => { tabs.current[i] = el; }}
                role="tab"
                id={`dt-tab-${p.id}`}
                aria-selected={p.id === sel}
                aria-controls="dt-panel"
                tabIndex={p.id === sel ? 0 : -1}
                className="dt-tab"
                onClick={() => pick(p.id)}
                onKeyDown={(e) => onRailKey(e, i)}
              >
                <span className="dt-tab-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="dt-tab-name">{p.name}</span>
                <span className={`dt-trend${/improv/i.test(p.trend) ? ' up' : /worsen|cut/i.test(p.trend) ? ' down' : ''}`}>{p.trend}</span>
                {p.id === sel && playing && active && <span className="dt-tab-prog" key={sel} style={{ '--ms': `${CYCLE_MS}ms` } as CSSProperties} aria-hidden />}
              </button>
            ))}
          </div>
          <button className="dt-play" onClick={() => setPlaying((v) => !v)} aria-pressed={playing} aria-label={playing ? 'Pause auto-cycle' : 'Play auto-cycle'}>
            {playing
              ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>}
            <span>{playing ? 'Auto' : 'Paused'}</span>
          </button>
        </div>

        <div id="dt-panel" role="tabpanel" aria-labelledby={`dt-tab-${sel}`} className="dt-panel lp-card" ref={panel} onMouseLeave={() => setTip(null)}>
          <div className="dt-panel-top">
            <span className="dt-panel-name">{cur.name}</span>
            <span className="dt-panel-fact">{cur.fact}</span>
          </div>
          <div key={shown} className={`dt-vis${leaving ? ' out' : ''}`}>
            {shown === 'food' && <Food tip={showTip} />}
            {shown === 'crime' && <Crime tip={showTip} />}
            {shown === 'housing' && <Housing tip={showTip} />}
            {shown === 'transit' && <Transit tip={showTip} />}
            {shown === 'water' && <Water tip={showTip} />}
            {shown === 'neglect' && <Neglect tip={showTip} />}
          </div>
          <div key={`k-${shown}`} className={`dt-kpis${leaving ? ' out' : ''}`}>
            {KPIS[shown].map((k, i) => <KpiTile key={k.label} k={k} run={active} i={i} />)}
          </div>
          {tip && <div className="dt-tip" role="status" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
        </div>
      </div>

      <p className="dt-src lp-in" style={{ '--d': 5 } as CSSProperties}>Source: Magic City Code research, Nov 2026</p>
    </div>
  );
}

function useCount(target: number, run: boolean, ms = 1100) {
  const [n, setN] = useState(() => (reduced() ? target : 0));
  useEffect(() => {
    if (!run || reduced()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

function KpiTile({ k, run, i }: { k: Kpi; run: boolean; i: number }) {
  const n = useCount(k.v, run);
  return (
    <div className={`dt-kpi${k.hot ? ' hot' : ''}`} style={{ '--i': i } as CSSProperties}>
      <span className="dt-kpi-v">{k.pre}{fmt(n, k.dec)}{k.suf}</span>
      <span className="dt-kpi-l">{k.label}</span>
    </div>
  );
}

/** wraps a visual: accessible name + hover/focus tooltip wiring */
function Fig({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <figure className={`dt-fig ${className}`} role="img" aria-label={label}>{children}</figure>;
}
const hover = (tip: TipFn, text: string) => ({
  onMouseMove: (e: MouseEvent) => tip(e, text),
  onMouseLeave: () => tip(null),
  onFocus: (e: FocusEvent) => tip(e, text),
  onBlur: () => tip(null),
});

/* ---------------- food ---------------- */
// deterministic scatter so the 70 lit cubes look like a map, not a progress bar
const LIT = new Set(Array.from({ length: 100 }, (_, i) => i).sort((a, b) => ((a * 37) % 101) - ((b * 37) % 101)).slice(0, city.foodDesertShare));

function Food({ tip }: { tip: TipFn }) {
  const r = 70, c = Math.PI * r; // half circle
  return (
    <div className="dt-two">
      <Fig label={`${city.foodDesertShare} of every 100 Birmingham residents live in a food desert.`} className="dt-food">
        <div className="dt-iso" {...hover(tip, `${city.foodDesertShare} of 100 residents live in a food desert`)}>
          {Array.from({ length: 100 }, (_, i) => (
            <span key={i} className={`dt-cube${LIT.has(i) ? ' lit' : ''}`} style={{ '--x': i % 10, '--y': Math.floor(i / 10), '--k': (i % 10) + Math.floor(i / 10) } as CSSProperties} />
          ))}
        </div>
        <div className="dt-legend"><i className="hot" /> In a food desert <i /> Not</div>
      </Fig>
      <Fig label={`Poverty rate: ${city.povertyRate} percent.`} className="dt-gauge">
        <svg viewBox="0 0 180 110" {...hover(tip, `Poverty rate ${city.povertyRate}%`)} tabIndex={0}>
          <path d="M20 95 A70 70 0 0 1 160 95" className="trk" />
          <path d="M20 95 A70 70 0 0 1 160 95" className="val draw-arc" style={{ '--len': c, '--to': c * (1 - city.povertyRate / 100) } as CSSProperties} strokeDasharray={c} />
          <text x="90" y="82" textAnchor="middle" className="big">{city.povertyRate}%</text>
          <text x="90" y="104" textAnchor="middle" className="sm">in poverty</text>
          <text x="20" y="108" textAnchor="middle" className="ax">0</text>
          <text x="160" y="108" textAnchor="middle" className="ax">100</text>
        </svg>
      </Fig>
    </div>
  );
}

/* ---------------- crime ---------------- */
function Crime({ tip }: { tip: TipFn }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 440, H = 240, L = 40, R = 16, T = 16, B = 32;
  const pts = [
    { label: '2024', v: city.homicides.y2024, note: 'full year, a record' },
    { label: '2025', v: city.homicides.y2025, note: 'full year' },
    { label: '2026', v: city.homicides.y2026q3, note: 'through Q3' },
  ];
  const x = (i: number) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v: number) => T + (1 - v / 160) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.v)}`).join(' ');
  const area = `${line} L${x(pts.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * (W - L - R);
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(px / ((W - L - R) / (pts.length - 1)))));
    setHi(i);
    tip(e, `${pts[i].label}: ${pts[i].v} homicides (${pts[i].note})`);
  };
  const s = city.homicidesSamePoint;
  return (
    <div className="dt-two wide">
      <Fig label={`Homicides in Birmingham: ${pts.map((p) => `${p.label} ${p.v} (${p.note})`).join(', ')}.`}>
        <svg viewBox={`0 0 ${W} ${H}`} className="dt-chart">
          <defs>
            <linearGradient id="dt-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 40, 80, 120, 160].map((v) => (
            <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end" className="ax">{v}</text></g>
          ))}
          <path d={area} fill="url(#dt-area)" className="fade" />
          <path d={line} pathLength={1} className="ln draw" />
          {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={y(0)} className="xhair" />}
          {pts.map((p, i) => (
            <g key={p.label}>
              <circle cx={x(i)} cy={y(p.v)} r={hi === i ? 7 : 5} className={`pt${i === 2 ? ' q3' : ''}`} style={{ '--i': i } as CSSProperties} tabIndex={0}
                onFocus={(e) => { setHi(i); tip(e, `${p.label}: ${p.v} homicides (${p.note})`); }} onBlur={() => { setHi(null); tip(null); }} />
              <text x={x(i)} y={y(p.v) - 14} textAnchor="middle" className="val-t" style={{ '--i': i } as CSSProperties}>{p.v}</text>
              <text x={x(i)} y={H - 10} textAnchor="middle" className="ax">{p.label}{i === 2 ? ' (thru Q3)' : ''}</text>
            </g>
          ))}
          <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} onMouseLeave={() => { setHi(null); tip(null); }} />
        </svg>
      </Fig>
      <Fig label={`Through Q3: ${s.y2024} homicides in 2024 versus ${s.y2026} in 2026, down ${samePointDrop} percent.`} className="dt-cmp">
        <div className="dt-cmp-h">Same point in the year<br /><span>through Q3</span></div>
        {[{ k: '2024', v: s.y2024 }, { k: '2026', v: s.y2026 }].map((r, i) => (
          <div key={r.k} className={`dt-hbar${i ? ' hot' : ''}`} {...hover(tip, `Through Q3 ${r.k}: ${r.v} homicides`)} tabIndex={0}>
            <span className="k">{r.k}</span>
            <span className="bar"><i style={{ '--w': r.v / s.y2024, '--i': i } as CSSProperties} /></span>
            <span className="v">{r.v}</span>
          </div>
        ))}
        <div className="dt-delta">−{samePointDrop}%</div>
      </Fig>
    </div>
  );
}

/* ---------------- housing ---------------- */
function Housing({ tip }: { tip: TipFn }) {
  const W = 420, H = 240, L = 40, R = 8, T = 18, B = 40, max = 600;
  const gw = (W - L - R) / homelessCounts.length, bw = gw * 0.3;
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const s = city.homelessStudents;
  return (
    <div className="dt-two wide">
      <Fig label={`Point-in-time homeless counts, 2025 vs 2026: ${homelessCounts.map((g) => `${g.group} ${g.y2025} to ${g.y2026}`).join('; ')}.`}>
        <div className="dt-legend top"><i /> 2025 <i className="hot" /> 2026</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="dt-chart">
          {[0, 200, 400, 600].map((v) => (
            <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end" className="ax">{v}</text></g>
          ))}
          {homelessCounts.map((g, i) => {
            const cx = L + gw * i + gw / 2;
            return (
              <g key={g.group}>
                {([['2025', g.y2025, cx - bw - 2], ['2026', g.y2026, cx + 2]] as const).map(([yr, v, bx], j) => (
                  <rect key={yr} x={bx} y={y(v)} width={bw} height={y(0) - y(v)} rx={3} className={`bar${j ? ' hot' : ''}`} style={{ '--i': i * 2 + j } as CSSProperties}
                    tabIndex={0} {...hover(tip, `${g.group}, ${yr}: ${v}`)} />
                ))}
                <text x={cx} y={H - 24} textAnchor="middle" className="ax">{g.group.split(' ')[0]}</text>
                <text x={cx} y={H - 10} textAnchor="middle" className="ax">{g.group.split(' ').slice(1).join(' ')}</text>
              </g>
            );
          })}
        </svg>
      </Fig>
      <div className="dt-stack">
        <Fig label={`Homeless students rose from ${s.y2025} in 2025 to ${s.y2026} in 2026.`} className="dt-callout">
          <span className="lbl">Homeless students</span>
          <svg viewBox="0 0 160 70" {...hover(tip, `Homeless students: ${s.y2025} (2025) → ${s.y2026} (2026)`)} tabIndex={0}>
            <path d="M12 52 L148 18" pathLength={1} className="ln draw" />
            <circle cx="12" cy="52" r="4" className="pt ash" />
            <circle cx="148" cy="18" r="5" className="pt q3" style={{ '--i': 2 } as CSSProperties} />
            <text x="12" y="68" className="ax" textAnchor="start">{s.y2025}</text>
            <text x="148" y="40" className="val-t" textAnchor="end" style={{ '--i': 2 } as CSSProperties}>{s.y2026}</text>
          </svg>
          <span className="sub">2025 → 2026 · counts fall, students rise</span>
        </Fig>
        <Fig label={`${city.renterBurden} percent of renters spend over half their income on housing.`} className="dt-callout">
          <span className="lbl"><b>{city.renterBurden}%</b> of renters spend over half their income on housing</span>
          <span className="dt-meter" {...hover(tip, `${city.renterBurden}% of renters are severely cost-burdened`)} tabIndex={0}><i style={{ '--w': city.renterBurden / 100 } as CSSProperties} /></span>
        </Fig>
      </div>
    </div>
  );
}

/* ---------------- transit ---------------- */
function Transit({ tip }: { tip: TipFn }) {
  const r = 62, c = 2 * Math.PI * r;
  const per = city.stormInlets / 100; // 270 inlets per square
  const bad = Math.round((city.stormInletsNeedRepair / city.stormInlets) * 100); // 33
  return (
    <div className="dt-two">
      <Fig label={`${city.busOnTime} percent of buses run on time.`} className="dt-gauge">
        <svg viewBox="0 0 160 160" {...hover(tip, `Buses on time: ${city.busOnTime}%; late: ${100 - city.busOnTime}%`)} tabIndex={0}>
          <circle cx="80" cy="80" r={r} className="trk" />
          <circle cx="80" cy="80" r={r} className="val draw-arc" strokeDasharray={c} style={{ '--len': c, '--to': c * (1 - city.busOnTime / 100) } as CSSProperties} transform="rotate(-90 80 80)" />
          <text x="80" y="84" textAnchor="middle" className="big">{city.busOnTime}%</text>
          <text x="80" y="104" textAnchor="middle" className="sm">buses on time</text>
        </svg>
      </Fig>
      <Fig label={`${fmt(city.stormInlets)} storm inlets; about ${fmt(city.stormInletsNeedRepair)}, one in three, need repair.`} className="dt-waffle-fig">
        <div className="dt-waffle">
          {Array.from({ length: 100 }, (_, i) => (
            <span key={i} className={i < bad ? 'hot' : ''} style={{ '--i': i } as CSSProperties} {...hover(tip, i < bad ? `Needs repair · ~${per} inlets` : `OK · ~${per} inlets`)} />
          ))}
        </div>
        <div className="dt-legend"><i className="hot" /> Needs repair <i /> OK <span className="ax-note">1 square ≈ {per} inlets</span></div>
      </Fig>
    </div>
  );
}

/* ---------------- water ---------------- */
function Water({ tip }: { tip: TipFn }) {
  const share = city.waterUnbilledShare;
  return (
    <div className="dt-two wide">
      <Fig label={`About ${share} percent of the water Birmingham pumps is unbilled or leaked; about ${100 - share} percent is billed.`}>
        <svg viewBox="0 0 440 240" className="dt-chart dt-water">
          <defs>
            <clipPath id="dt-tank"><rect x="30" y="40" width="110" height="160" rx="14" /></clipPath>
          </defs>
          <rect x="30" y="40" width="110" height="160" rx="14" className="tank" />
          <g clipPath="url(#dt-tank)">
            <rect x="30" y="40" width="110" height="160" className="fill" />
            <path className="wave" d="M-80 66 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V200 H-80Z" />
          </g>
          <text x="85" y="226" textAnchor="middle" className="ax">Pumped</text>
          <path d="M140 150 H200 Q220 150 220 130 V100 Q220 80 240 80 H330" className="pipe" />
          <path d="M220 150 V170 Q220 190 240 190 H330" className="pipe" />
          <path d="M140 150 H200 Q220 150 220 130 V100 Q220 80 240 80 H330" className="flow ash" />
          <path d="M140 150 H220 V170 Q220 190 240 190 H330" className="flow hot" />
          {[250, 280, 310].map((dx, i) => <circle key={dx} cx={dx} cy={196} r={3} className="drip" style={{ '--i': i } as CSSProperties} />)}
          <g {...hover(tip, `Billed: about ${100 - share}%`)} tabIndex={0}>
            <rect x="330" y="58" width="96" height="44" rx="10" className="tag" />
            <text x="378" y="78" textAnchor="middle" className="tag-v">~{100 - share}%</text>
            <text x="378" y="94" textAnchor="middle" className="ax">billed</text>
          </g>
          <g {...hover(tip, `Unbilled or leaked: about ${share}%`)} tabIndex={0}>
            <rect x="330" y="168" width="96" height="44" rx="10" className="tag hot" />
            <text x="378" y="188" textAnchor="middle" className="tag-v hot">~{share}%</text>
            <text x="378" y="204" textAnchor="middle" className="ax">leaked</text>
          </g>
        </svg>
      </Fig>
      <Fig label={`The water utility gets more than ${fmt(city.waterCallsPerDay)} calls a day, about one every ${Math.round(86400 / city.waterCallsPerDay)} seconds.`} className="dt-callout dt-phone">
        <span className="ring" aria-hidden><i /><i /><i /></span>
        <span className="lbl"><b>{fmt(city.waterCallsPerDay)}+</b> calls a day</span>
        <span className="sub">about one every {Math.round(86400 / city.waterCallsPerDay)} seconds, around the clock</span>
      </Fig>
    </div>
  );
}

/* ---------------- neglect ---------------- */
function Neglect({ tip }: { tip: TipFn }) {
  const per = 10, n = city.demolitionsSince2018 / per; // 250 dots
  return (
    <div className="dt-two wide">
      <Fig label={`About ${fmt(city.demolitionsSince2018)} demolitions since 2018, shown as ${n} dots of ${per} each.`} className="dt-dots-fig">
        <div className="dt-dots" {...hover(tip, `~${fmt(city.demolitionsSince2018)} demolitions since 2018`)}>
          {Array.from({ length: n }, (_, i) => <span key={i} style={{ '--i': i } as CSSProperties} />)}
        </div>
        <div className="dt-legend"><i className="hot" /> 1 dot = {per} demolitions since 2018</div>
      </Fig>
      <Fig label="Stray animals are the top 311 complaint in Birmingham." className="dt-callout dt-rank">
        <span className="lbl">Top 311 complaint</span>
        <span className="dt-rank-1" {...hover(tip, 'Stray animals: the most frequent 311 complaint')} tabIndex={0}>
          <b>#1</b> Stray animals
        </span>
        <span className="sub">Followed by illegal dumping, blight and potholes</span>
      </Fig>
    </div>
  );
}
