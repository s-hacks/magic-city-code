import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import type { StageProps } from '../Landing';
import { Arrow } from '../Landing';
import { city, levels, missions, partners } from '../facts';
import './missions.css';

type Mission = (typeof missions)[number];
type MissionId = Mission['id'];
const v = (o: Record<string, string | number>) => o as CSSProperties;

// Shared-element morph via View Transitions; plain state swap where unsupported.
function morph(update: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (d.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.startViewTransition(() => flushSync(update));
  else update();
}

export default function Missions({ active, go }: StageProps) {
  const [open, setOpen] = useState<MissionId | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const m = missions.find((x) => x.id === open);

  const show = (id: MissionId, el: HTMLButtonElement) => {
    opener.current = el;
    morph(() => { setOpen(id); dlg.current?.showModal(); });
  };
  const hide = () => morph(() => {
    dlg.current?.close();
    setOpen(null);
    opener.current?.focus();
  });

  // leaving the stage closes the detail view
  useEffect(() => {
    if (!active && dlg.current?.open) { dlg.current.close(); setOpen(null); }
  }, [active]);

  return (
    <div className="lp-wrap ms" data-paused={!active || undefined}>
      <header className="ms-head">
        <div>
          <span className="lp-eyebrow lp-in">Missions</span>
          <h2 className="lp-h2 lp-in" style={v({ '--d': 1 })}>Three missions. Real streets. <span className="lp-accent">Real partners.</span></h2>
        </div>
        <p className="lp-lede lp-in" style={v({ '--d': 2 })}>Each mission starts from a resident report and a Birmingham neighborhood. One is playable today; two are next.</p>
      </header>

      <ul className="ms-cards">
        {missions.map((x, k) => (
          <li key={x.id} className="lp-in" style={v({ '--d': 3 + k })}>
            <button
              className="ms-card lp-card hover"
              data-live={x.status === 'Playable' || undefined}
              style={{ viewTransitionName: open === x.id ? 'none' : `ms-${x.id}` }}
              onClick={(e) => show(x.id, e.currentTarget)}
              aria-haspopup="dialog"
            >
              <Header kind={x.kind} />
              <div className="ms-body">
                <div className="ms-meta">
                  <span className="ms-kind">{x.kind}</span>
                  <span className="ms-status">{x.status}</span>
                </div>
                <h3>{x.title}</h3>
                <p className="ms-place">{x.place} <span aria-hidden>·</span> {x.partner}</p>
                <p className="ms-task">{x.task}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="ms-foot">
        <div className="ms-partners lp-in" style={v({ '--d': 6 })}>
          <span className="ms-label">Built to work with</span>
          <div className="ms-marquee">
            <ul className="ms-track">
              {[0, 1].map((dup) => partners.map((p) => (
                <li key={`${dup}-${p.name}`} className="ms-chip" aria-hidden={dup === 1 || undefined}>
                  <b>{p.name}</b><span>{p.role}</span>
                </li>
              )))}
            </ul>
          </div>
        </div>
        <div className="ms-cta lp-in" style={v({ '--d': 7 })}>
          <p className="ms-cta-line">Open West End and <span className="lp-accent">light it up.</span></p>
          <div className="ms-cta-btns">
            <a className="lp-btn primary" href="/">Start Feed the Block <Arrow /></a>
            <button className="lp-btn ghost" onClick={() => go('hero')}>Back to the city</button>
          </div>
        </div>
      </div>

      <dialog
        ref={dlg}
        className="ms-dlg"
        aria-labelledby="ms-dlg-title"
        onCancel={(e) => { e.preventDefault(); hide(); }}
        onKeyDown={(e) => { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation(); }} // keep stage-nav keys out
        onClick={(e) => { if (e.target === e.currentTarget) hide(); }}
      >
        {m && (
          <div className="ms-panel lp-card" style={{ viewTransitionName: `ms-${m.id}` }} data-live={m.status === 'Playable' || undefined}>
            <button className="lp-icon ms-close" onClick={hide} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <Header kind={m.kind} />
            <div className="ms-body">
              <div className="ms-meta"><span className="ms-kind">{m.kind}</span><span className="ms-status">{m.status}</span></div>
              <h3 id="ms-dlg-title">{m.title}</h3>
              <p className="ms-place">{m.place} <span aria-hidden>·</span> {m.partner}</p>
              <p className="ms-task">{m.task}</p>
              {m.status === 'Playable' ? (
                <>
                  <ol className="ms-path">
                    {levels.map((l, k) => (
                      <li key={l.n} style={v({ '--k': k })}>
                        <span className="ms-node" aria-hidden>{l.n}</span>
                        <div>
                          <p className="ms-lvl"><b>Level {l.n}: {l.concept}</b><span>Light {l.target}% of West End</span></p>
                          <pre><code>{l.code}</code></pre>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <a className="lp-btn primary" href="/">Start Feed the Block <Arrow /></a>
                </>
              ) : (
                <div className="ms-next">
                  <b>Coming next</b>
                  <p>{m.task}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function Header({ kind }: { kind: Mission['kind'] }) {
  return <div className="ms-hdr" aria-hidden>{kind === 'Coverage' ? <Coverage /> : kind === 'Route' ? <Route /> : <Match />}</div>;
}

// Mini isometric block: hub beam in the middle, lit dots spreading out by distance.
function Coverage() {
  const N = 7, c = (N - 1) / 2;
  return (
    <div className="ms-iso">
      <div className="ms-plane">
        {Array.from({ length: N * N }, (_, i) => {
          const x = i % N, y = Math.floor(i / N);
          const d = Math.hypot(x - c, y - c);
          return <i key={i} className={d <= 2.3 ? 'reach' : undefined} style={v({ '--x': x, '--y': y, '--dist': d.toFixed(2) })} />;
        })}
        <b className="ms-beam" />
      </div>
    </div>
  );
}

const ROUTE = 'M20 84 H96 V36 H196 V72 H280';
const STOPS: [number, number][] = [[20, 84], [96, 84], [96, 36], [196, 36], [196, 72], [280, 72]];

function Route() {
  return (
    <svg className="ms-route" viewBox="0 0 300 110">
      <path d={ROUTE} className="ms-line" />
      <path d={ROUTE} className="ms-line-hot" pathLength={1} />
      {STOPS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" className="ms-stop" />)}
      <circle r="6" className="ms-bus" style={{ offsetPath: `path('${ROUTE}')` }} />
      <g transform="translate(250 24)">
        <circle r="13" className="ms-clock" />
        <line y2="-9" className="ms-hand" />
        <text x="-22" y="4" textAnchor="end" className="ms-ontime">{city.busOnTime}% on time</text>
      </g>
    </svg>
  );
}

// People dots flow from the left into open bed slots on the right.
function Match() {
  const slots = Array.from({ length: 8 }, (_, i) => [176 + (i % 4) * 26, 36 + Math.floor(i / 4) * 32] as const);
  return (
    <svg className="ms-match" viewBox="0 0 300 110">
      {slots.map(([x, y], i) => <rect key={i} x={x - 10} y={y - 8} width="20" height="16" rx="4" className="ms-slot" style={v({ '--i': i })} />)}
      {slots.map(([x, y], i) => {
        const sx = 30 + (i % 2) * 18, sy = 24 + Math.floor(i / 2) * 20;
        return <circle key={i} cx={sx} cy={sy} r="5" className="ms-person" style={v({ '--dx': `${x - sx}px`, '--dy': `${y - sy}px`, '--i': i })} />;
      })}
    </svg>
  );
}
