// Landing: the first page. Five full-screen stages (city, the loop, try it, Birmingham data,
// missions); the Missions stage lists every real mission and opens it in the app.
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { appHref } from './appUrl';

export interface StageProps {
  active: boolean; // true while this stage is on screen; pause loops/WebGL when false
  go: (id: StageId) => void; // open another stage
}

const STAGES = [
  { id: 'hero', label: 'City', C: lazy(() => import('./stages/Hero')) },
  { id: 'loop', label: 'The loop', C: lazy(() => import('./stages/Loop')) },
  { id: 'play', label: 'Try it', C: lazy(() => import('./stages/Play')) },
  { id: 'data', label: 'Birmingham', C: lazy(() => import('./stages/Data')) },
  { id: 'missions', label: 'Missions', C: lazy(() => import('./stages/Missions')) },
] as const satisfies readonly { id: string; label: string; C: ComponentType<StageProps> }[];

export type StageId = (typeof STAGES)[number]['id'];
const ids = STAGES.map((s) => s.id) as StageId[];
const fromHash = (): StageId => (ids.find((id) => `#${id}` === location.hash) ?? 'hero');
const LEAVE_MS = 900;

export default function Landing() {
  const [cur, setCur] = useState<StageId>(fromHash);
  const [prev, setPrev] = useState<StageId | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const timer = useRef(0);
  const [origin, setOrigin] = useState({ x: 50, y: 92 }); // % — where the next stage grows from

  const go = useCallback((id: StageId, from?: { x: number; y: number }) => {
    if (cur === id) return;
    setDir(ids.indexOf(id) > ids.indexOf(cur) ? 1 : -1);
    setPrev(cur);
    setCur(id);
    setOrigin(from ?? { x: 50, y: 50 });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPrev(null), LEAVE_MS);
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  }, [cur]);

  const step = useCallback((d: 1 | -1) => {
    const i = Math.min(ids.length - 1, Math.max(0, ids.indexOf(cur) + d));
    go(ids[i], { x: d > 0 ? 100 : 0, y: 50 });
  }, [cur, go]);

  useEffect(() => {
    const onPop = () => go(fromHash());
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); step(1); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
      const n = Number(e.key);
      if (n >= 1 && n <= ids.length) go(ids[n - 1]);
    };
    // swipe between stages (horizontal only, so vertical scrolling inside a stage still works)
    let sx = 0, sy = 0;
    const onDown = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    };
    const onMove = (e: PointerEvent) => {
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`);
      document.documentElement.style.setProperty('--my', `${e.clientY}px`);
    };
    addEventListener('popstate', onPop);
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onDown);
    addEventListener('pointerup', onUp);
    addEventListener('pointermove', onMove, { passive: true });
    return () => {
      removeEventListener('popstate', onPop);
      removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointermove', onMove);
    };
  }, [go, step]);

  const i = ids.indexOf(cur);
  const goPublic = (id: StageId) => go(id);

  return (
    <div className="lp" data-stage={cur}>
      <div className="lp-glow" aria-hidden />
      <a className="skip" href="#stage">Skip to content</a>

      <header className="lp-top">
        <button className="lp-brand" onClick={() => go('hero')} aria-label="Magic City Code, home">
          <Mark /> <span>Magic City Code</span>
        </button>
        <div className="lp-count" aria-hidden>
          <span key={cur} className="lp-count-n">{String(i + 1).padStart(2, '0')}</span>
          <span className="lp-count-of">/ {String(ids.length).padStart(2, '0')}</span>
        </div>
        <a className="lp-btn primary" href={appHref("/")}>Open the app <Arrow /></a>
      </header>

      <main id="stage" className="lp-stages" style={{ '--ox': `${origin.x}%`, '--oy': `${origin.y}%` } as React.CSSProperties}>
        {STAGES.map(({ id, C }) => {
          const state = id === cur ? 'enter' : id === prev ? 'leave' : null;
          if (!state) return null;
          return (
            <section key={id} className="lp-stage" data-state={state} data-dir={dir} aria-hidden={state === 'leave'} {...{ inert: state === 'leave' ? '' : undefined }}>
              <Suspense fallback={<div className="lp-loading" />}>
                <C active={state === 'enter'} go={goPublic} />
              </Suspense>
            </section>
          );
        })}
      </main>

      <nav className="lp-dock" aria-label="Sections" style={{ '--i': i, '--n': ids.length } as React.CSSProperties}>
        <span className="lp-dock-ind" aria-hidden />
        {STAGES.map((s, k) => (
          <button
            key={s.id}
            aria-current={s.id === cur ? 'page' : undefined}
            onClick={(e) => go(s.id, { x: (e.clientX / innerWidth) * 100, y: (e.clientY / innerHeight) * 100 })}
          >
            <span className="lp-dock-n">{k + 1}</span>
            <span className="lp-dock-l">{s.label}</span>
          </button>
        ))}
      </nav>

      <div className="lp-arrows">
        <button className="lp-icon" onClick={() => step(-1)} disabled={i === 0} aria-label="Previous section"><Arrow flip /></button>
        <button className="lp-icon" onClick={() => step(1)} disabled={i === ids.length - 1} aria-label="Next section"><Arrow /></button>
      </div>
    </div>
  );
}

export function Arrow({ flip }: { flip?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Mark() {
  return (
    <svg className="lp-mark" viewBox="0 0 32 32" aria-hidden>
      <rect x="4" y="14" width="6" height="14" rx="1.5" fill="currentColor" opacity=".45" />
      <rect x="13" y="6" width="6" height="22" rx="1.5" fill="currentColor" opacity=".7" />
      <rect x="22" y="10" width="6" height="18" rx="1.5" fill="currentColor" />
      <circle cx="16" cy="3" r="2" fill="var(--accent)" />
    </svg>
  );
}
