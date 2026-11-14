// Missions stage: the real mission list. Seed and approved resident missions come from the
// server (or the static files when it is away) and the code challenges from
// src/challenges. Each card opens a detail view; Start opens the mission screen
// (/mission/:id) or the challenge page (/challenge/:id).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import type { Mission as MissionConfig } from '@mcc/shared';
import type { StageProps } from '../Landing';
import { Arrow } from '../Landing';
import { city, partners } from '../facts';
import { useApp } from '../../mission/AppContext';
import { listMissionSummaries } from '../../mission/api';
import { challenges } from '../../challenges';
import './missions.css';

type Kind = 'Coverage' | 'Route' | 'Match';
interface Card {
  id: string;
  title: string;
  kind: Kind;
  place: string;
  partner: string;
  task: string;
  status: string;
  href: string;
  levels: { n: number; concept: string; goal: string; code: string }[];
}
type MissionId = string;
const v = (o: Record<string, string | number>) => o as CSSProperties;
const titleCase = (id: string) => id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function missionCard(m: MissionConfig, place: string): Card {
  return {
    id: m.id,
    title: m.title,
    kind: 'Coverage',
    place,
    partner: m.partner,
    task: `“${m.residentQuote}”`,
    status: m.source.kind === 'resident' ? 'From a resident' : 'Playable',
    href: `/mission/${m.id}`,
    levels: m.levels.map((l, i) => ({ n: i + 1, concept: l.concept, goal: `Light up ${Math.round(l.goal.target * 100)}% of ${place}`, code: l.starterCode })),
  };
}

const challengeCards: Card[] = Object.values(challenges).map((c) => ({
  id: c.id,
  title: c.title,
  kind: 'Route',
  place: c.neighborhood,
  partner: c.tags.join(' · '),
  task: 'Write a shortest-path search on Birmingham’s real walking network and find the fastest way to fresh food, even when streets flood.',
  status: `Code challenge · ${c.difficulty}`,
  href: `/challenge/${c.id}`,
  levels: [],
}));

/** Every playable mission and challenge, for the cards. */
function useCards(): Card[] | null {
  const { data, getMission } = useApp();
  const [configs, setConfigs] = useState<MissionConfig[] | null>(null);
  useEffect(() => {
    let live = true;
    listMissionSummaries()
      .then((list) => Promise.all(list.map((s) => getMission(s.id))))
      .then((ms) => live && setConfigs(ms.filter((m): m is MissionConfig => !!m)))
      .catch(() => live && setConfigs([]));
    return () => { live = false; };
  }, [getMission]);
  return useMemo(() => {
    if (!configs) return null;
    const hood = (id: string) => data?.neighborhoods.find((n) => n.id === id)?.name ?? titleCase(id);
    return [...configs.map((m) => missionCard(m, hood(m.area.neighborhood))), ...challengeCards];
  }, [configs, data]);
}

// Shared-element morph via View Transitions; plain state swap where unsupported.
function morph(update: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (d.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.startViewTransition(() => flushSync(update));
  else update();
}

export default function Missions({ active, go }: StageProps) {
  const cards = useCards();
  const missions = cards ?? [];
  const first = missions[0];
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
          <h2 className="lp-h2 lp-in" style={v({ '--d': 1 })}>{cards ? `${missions.length} missions.` : 'Missions.'} Real streets. <span className="lp-accent">Real partners.</span></h2>
        </div>
        <p className="lp-lede lp-in" style={v({ '--d': 2 })}>Each mission starts from a resident report and a Birmingham neighborhood. Pick one to read it, then start coding.</p>
      </header>

      <ul className="ms-cards" data-many={missions.length > 3 || undefined}>
        {cards === null && <li className="ms-loading lp-in">Loading missions…</li>}
        {missions.map((x, k) => (
          <li key={x.id} className="lp-in" style={v({ '--d': 3 + Math.min(k, 6) })}>
            <button
              className="ms-card lp-card hover"
              data-live
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
          <p className="ms-cta-line">Open {first?.place ?? 'a neighborhood'} and <span className="lp-accent">light it up.</span></p>
          <div className="ms-cta-btns">
            {first && <Link className="lp-btn primary" to={first.href}>Start {first.title} <Arrow /></Link>}
            <Link className="lp-btn ghost" to="/challenges">All challenges</Link>
            <Link className="lp-btn ghost" to="/city">Open the city map</Link>
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
          <div className="ms-panel lp-card" style={{ viewTransitionName: `ms-${m.id}` }} data-live>
            <button className="lp-icon ms-close" onClick={hide} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <Header kind={m.kind} />
            <div className="ms-body">
              <div className="ms-meta"><span className="ms-kind">{m.kind}</span><span className="ms-status">{m.status}</span></div>
              <h3 id="ms-dlg-title">{m.title}</h3>
              <p className="ms-place">{m.place} <span aria-hidden>·</span> {m.partner}</p>
              <p className="ms-task">{m.task}</p>
              {m.levels.length > 0 && (
                <ol className="ms-path">
                  {m.levels.map((l, k) => (
                    <li key={l.n} style={v({ '--k': k })}>
                      <span className="ms-node" aria-hidden>{l.n}</span>
                      <div>
                        <p className="ms-lvl"><b>Level {l.n}: {l.concept}</b><span>{l.goal}</span></p>
                        <pre><code>{l.code}</code></pre>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <Link className="lp-btn primary" to={m.href}>{m.kind === 'Route' ? 'Open the challenge' : `Start ${m.title}`} <Arrow /></Link>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function Header({ kind }: { kind: Kind }) {
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
