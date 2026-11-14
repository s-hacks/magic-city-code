import { useState } from 'react';
import { neighborhoods, type Problem } from '../data/mock';
import { Mark } from './Mission';

export default function Home({ problems, onOpen, onReport }: { problems: Problem[]; onOpen: (p: Problem) => void; onReport: (p: Problem) => void }) {
  const [reporting, setReporting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const playable = problems.filter((p) => p.missionId);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = String(f.get('text') ?? '').trim();
    const hood = neighborhoods.find((n) => n.id === f.get('hood'))!;
    if (!text) return;
    // ponytail: no API yet — the flare launches locally; POST /api/problems + mission generator come from the backend.
    onReport({ id: `r-${Date.now()}`, label: text.length > 28 ? `${text.slice(0, 26)}…` : text, quote: text, neighborhood: hood.name, at: hood.at });
    setReporting(false);
    setSent(hood.name);
  };

  return (
    <>
      <header className="topbar">
        <div className="brand"><Mark /> Magic City Code</div>
        <button className="btn ghost" onClick={() => setReporting(true)}>Report a problem</button>
      </header>

      <section className="hero">
        <p className="eyebrow">Birmingham, Alabama · Built on iron, run on code</p>
        <h1>Write code that <em>lights up</em> the Magic City.</h1>
        <p className="lede">Every dot is a family. Every flare is a real problem a neighbor told us about. Pick one, write a little Python, and watch your neighborhood glow.</p>
        <div className="hero-actions">
          {playable.map((p) => (
            <button key={p.id} className="btn primary big" onClick={() => onOpen(p)}>
              Start: {p.label} in {p.neighborhood} <span aria-hidden>→</span>
            </button>
          ))}
        </div>
        <p className="tiny">{problems.length} problems reported · hover a flare to read it</p>
      </section>

      {sent && (
        <div className="toast" role="status" onAnimationEnd={() => setSent(null)}>
          Flare launched over {sent}. A mission is being written for it.
        </div>
      )}

      {reporting && (
        <div className="scrim" onClick={() => setReporting(false)}>
          <form className="glass modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
            <h2>What's wrong in your neighborhood?</h2>
            <p className="muted">Say it the way you'd tell a friend. Leave out names and addresses.</p>
            <label className="field">
              <span>The problem</span>
              <textarea name="text" rows={4} maxLength={280} required autoFocus placeholder="The bus stop on our street has no shelter, and kids wait in the rain." />
            </label>
            <label className="field">
              <span>Neighborhood</span>
              <select name="hood" defaultValue="west-end">
                {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </label>
            <div className="row end">
              <button type="button" className="btn ghost" onClick={() => setReporting(false)}>Cancel</button>
              <button className="btn primary">Launch flare</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
