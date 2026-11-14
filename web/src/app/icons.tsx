// Small inline icons from the UI prototype. They color themselves from CSS
// (currentColor and var(--accent)), so they follow the day/night theme.

export const Mark = () => (
  <svg className="mark" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2c2.5 3 4 5.2 4 7.5A4 4 0 0 1 12 13.5 4 4 0 0 1 8 9.5C8 7.2 9.5 5 12 2Z" fill="var(--accent)" />
    <rect x="10.5" y="14.5" width="3" height="7.5" rx="1" fill="currentColor" />
  </svg>
);

/** The Vulcan torch at the end of the city-light meter; lit when the goal is reached. */
export const Torch = ({ lit }: { lit: boolean }) => (
  <svg className={`torch ${lit ? "lit" : ""}`} viewBox="0 0 24 36" aria-label={lit ? "Goal reached" : "Goal not reached yet"}>
    <path d="M12 2c3 3.6 5 6.4 5 9.2A5 5 0 0 1 12 16a5 5 0 0 1-5-4.8C7 8.4 9 5.6 12 2Z" className="flame" />
    <path d="M7 17h10l-2 5h-6z" fill="currentColor" />
    <rect x="10.5" y="22" width="3" height="12" rx="1" fill="currentColor" />
  </svg>
);

/** Sparks, the coach. */
export const Spark = () => (
  <svg className="spark" viewBox="0 0 32 32" aria-hidden>
    <path d="M16 2l3 10 10 4-10 4-3 10-3-10-10-4 10-4z" fill="var(--accent)" />
    <circle cx="16" cy="16" r="3" fill="var(--bg)" />
  </svg>
);

export const Play = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);

export const Lock = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
    <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
    <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" />
  </svg>
);

export const Sun = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <circle cx="12" cy="12" r="4.5" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${a} 12 12)`} />
      ))}
    </g>
  </svg>
);

export const Moon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
  </svg>
);
