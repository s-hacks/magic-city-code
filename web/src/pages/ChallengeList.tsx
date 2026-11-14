import { useEffect, useRef, useState } from 'react';
import { cityProblems, INTERVIEW_AT, leaders, practice, type CityProblem, type Practice } from '../data/community';
import { neighborhoods } from '../data/mock';
import { Mark } from './Mission';

type Tab = 'practice' | 'city';
interface Props { tab: Tab; onTab: (t: Tab) => void; onOpen: (p: Practice) => void; onHome: () => void }

export default function ChallengeList({ tab, onTab, onOpen, onHome }: Props) {
  const [problems, setProblems] = useState(cityProblems);
  const [open, setOpen] = useState<CityProblem | null>(null);
  const [modal, setModal] = useState<'post' | 'solve' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => { page.current?.scrollTo({ top: 0 }); }, [open, tab]); // braces: scrollTo returns a Promise in new browsers

  const allSkills = [...new Set((tab === 'practice' ? practice : problems).flatMap((p) => p.skills))];
  const match = (s: string[]) => !skill || s.includes(skill);

  // ponytail: forms don't save anywhere yet; they show the flow. Wire to POST /api/problems and /api/solutions later.
  const postProblem = (f: FormData) => {
    const hood = neighborhoods.find((n) => n.id === f.get('hood'))!;
    setProblems((ps) => [{
      id: `p-${Date.now()}`, title: String(f.get('title')), postedBy: 'You', posterKind: 'Resident', neighborhood: hood.name,
      summary: String(f.get('summary')), details: String(f.get('summary')), data: String(f.get('data') || 'Not provided yet'),
      skills: String(f.get('skills') || '').split(',').map((s) => s.trim()).filter(Boolean),
      status: 'Open', reward: 'Featured on the Magic City Code leaderboard', due: 'in 3 weeks', solutions: [],
    }, ...ps]);
    setToast('Problem posted. Coders across Birmingham can now send solutions.');
  };

  return (
    <div className="hub" ref={page}>
      <header className="cbar">
        <button className="brand link" onClick={onHome} title="Home (H)"><Mark /> Magic City Code</button>
        <nav className="hub-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'practice'} onClick={() => { onTab('practice'); setOpen(null); setSkill(null); }}>Practice</button>
          <button role="tab" aria-selected={tab === 'city'} onClick={() => { onTab('city'); setSkill(null); }}>City problems <span className="count">{problems.filter((p) => p.status !== 'Solved').length}</span></button>
        </nav>
        <button className="btn primary" onClick={() => setModal('post')}>+ Post a city problem</button>
      </header>

      <main className="hub-main">
        {tab === 'practice' && (
          <section>
            <div className="hub-intro">
              <p className="eyebrow grad-text">Practice</p>
              <h1>Learn the skill, then use it on your city.</h1>
              <p className="muted">Each challenge runs on real Birmingham data and trains one set of skills.</p>
            </div>
            <SkillFilter skills={allSkills} value={skill} onChange={setSkill} />
            <div className="ptable card" role="table" aria-label="Practice challenges">
              <div className="prow head" role="row"><span>Status</span><span>Challenge</span><span>Skills trained</span><span>Difficulty</span><span>Solved</span></div>
              {practice.filter((p) => match(p.skills)).map((p) => (
                <button key={p.id} className="prow" role="row" disabled={!p.open} onClick={() => onOpen(p)}>
                  <span className={`pstatus ${p.open ? 'live' : ''}`}>{p.open ? '●' : '◌'}</span>
                  <span className="ptitle"><strong>{p.title}</strong><small>{p.neighborhood} · {p.blurb}</small></span>
                  <span className="tags">{p.skills.map((s) => <span key={s} className="tag">{s}</span>)}</span>
                  <span className={`diff ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
                  <span className="muted">{p.open ? `${p.solvedPct}%` : 'Soon'}</span>
                </button>
              ))}
            </div>
            <aside className="cta-band card">
              <div>
                <strong>Ready for a real one?</strong>
                <p className="muted">Residents and groups post problems from their own neighborhoods. Solve them to earn points and interviews.</p>
              </div>
              <button className="btn ghost" onClick={() => onTab('city')}>See city problems →</button>
            </aside>
          </section>
        )}

        {tab === 'city' && !open && (
          <section className="city-grid">
            <div>
              <div className="hub-intro">
                <p className="eyebrow grad-text">City problems · concept preview, sample data</p>
                <h1>Real problems, posted by neighbors.</h1>
                <p className="muted">Anyone can post a problem code could solve. Coders send solutions, the poster picks what works best, and top solvers get interviews.</p>
              </div>
              <ol className="how">
                <li><b>1</b> A neighbor posts a problem and the data they have.</li>
                <li><b>2</b> Coders send solutions with a short write-up.</li>
                <li><b>3</b> The poster picks the one that works for them.</li>
                <li><b>4</b> Chosen solutions earn points. {INTERVIEW_AT.toLocaleString()} points unlocks an interview.</li>
              </ol>
              <SkillFilter skills={allSkills} value={skill} onChange={setSkill} />
              <div className="cp-list">
                {problems.filter((p) => match(p.skills)).map((p) => (
                  <button key={p.id} className="cp card" onClick={() => setOpen(p)}>
                    <div className="cp-top">
                      <span className={`state ${p.status.toLowerCase()}`}>{p.status}</span>
                      <span className="tiny">{p.neighborhood} · {p.postedBy}</span>
                    </div>
                    <h3>{p.title}</h3>
                    <p className="muted">{p.summary}</p>
                    <div className="cp-foot">
                      <span className="tags">{p.skills.map((s) => <span key={s} className="tag">{s}</span>)}</span>
                      <span className="tiny">{p.solutions.length} solution{p.solutions.length === 1 ? '' : 's'} · due {p.due}</span>
                    </div>
                    <div className="reward">★ {p.reward}</div>
                  </button>
                ))}
              </div>
            </div>
            <Leaderboard />
          </section>
        )}

        {tab === 'city' && open && (
          <section className="city-grid">
            <article className="cp-detail">
              <button className="link-btn quiet" onClick={() => setOpen(null)}>← All city problems</button>
              <div className="cp-top">
                <span className={`state ${open.status.toLowerCase()}`}>{open.status}</span>
                <span className="tiny">{open.posterKind} · {open.postedBy} · {open.neighborhood} · due {open.due}</span>
              </div>
              <h1>{open.title}</h1>
              <p className="lead">{open.details}</p>
              <dl className="facts card">
                <div><dt>Data provided</dt><dd>{open.data}</dd></div>
                <div><dt>Skills</dt><dd className="tags">{open.skills.map((s) => <span key={s} className="tag">{s}</span>)}</dd></div>
                <div><dt>Reward</dt><dd className="gold-text">★ {open.reward}</dd></div>
              </dl>
              <div className="sol-head">
                <h2>Solutions <span className="count">{open.solutions.length}</span></h2>
                {open.status !== 'Solved' && <button className="btn submit" onClick={() => setModal('solve')}>Submit a solution</button>}
              </div>
              {open.solutions.length === 0 && <p className="muted">No solutions yet. Be the first.</p>}
              {[...open.solutions].sort((a, b) => Number(!!b.chosen) - Number(!!a.chosen) || b.votes - a.votes).map((s) => (
                <div key={s.id} className={`sol card ${s.chosen ? 'chosen' : ''}`}>
                  <div className="sol-votes"><span>▲</span><b>{s.votes}</b></div>
                  <div className="sol-body">
                    <div className="sol-meta"><strong>{s.author}</strong><span className="tiny">{s.school} · {s.submitted}</span>{s.chosen && <span className="badge">✓ Chosen by poster</span>}</div>
                    <p>{s.approach}</p>
                    <div className="sol-foot"><span className="metric">{s.metric}</span><span className="tags">{s.skills.map((k) => <span key={k} className="tag">{k}</span>)}</span></div>
                  </div>
                </div>
              ))}
              <p className="tiny">The poster reviews solutions and marks the one that works best for them. Chosen solutions earn 300 points; upvotes earn 10.</p>
            </article>
            <Leaderboard />
          </section>
        )}
      </main>

      {toast && <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>{toast}</div>}

      {modal && (
        <div className="scrim" onClick={() => setModal(null)}>
          <form
            className="glass modal" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === 'post') postProblem(new FormData(e.currentTarget));
              else setToast('Solution sent. The poster will review it.');
              setModal(null);
            }}
          >
            {modal === 'post' ? (
              <>
                <h2>Post a city problem</h2>
                <p className="muted">Describe something in your neighborhood that code could help with. Leave out names and addresses.</p>
                <label className="field"><span>Title</span><input name="title" required autoFocus maxLength={90} placeholder="Which corners need streetlights first?" /></label>
                <label className="field"><span>What's the problem?</span><textarea name="summary" required rows={3} maxLength={400} placeholder="Our block is dark at night and kids walk home from practice…" /></label>
                <div className="row two">
                  <label className="field"><span>Neighborhood</span>
                    <select name="hood" defaultValue="woodlawn">{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
                  </label>
                  <label className="field"><span>Skills it might need</span><input name="skills" placeholder="Graphs, Sorting" /></label>
                </div>
                <label className="field"><span>Data you have (optional)</span><input name="data" placeholder="A list of reported outages, a map, a spreadsheet…" /></label>
              </>
            ) : (
              <>
                <h2>Submit a solution</h2>
                <p className="muted">for “{open?.title}”</p>
                <label className="field"><span>Your approach</span><textarea name="approach" required autoFocus rows={4} placeholder="I counted reports per inlet with a dictionary, then…" /></label>
                <label className="field"><span>Link to your code</span><input name="link" type="url" placeholder="https://github.com/…" /></label>
                <label className="field"><span>Result</span><input name="metric" placeholder="Top 10 inlets cover 64% of flooded homes" /></label>
              </>
            )}
            <div className="row end">
              <button type="button" className="btn ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary">{modal === 'post' ? 'Post problem' : 'Send solution'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SkillFilter({ skills, value, onChange }: { skills: string[]; value: string | null; onChange: (s: string | null) => void }) {
  return (
    <div className="skill-filter" aria-label="Filter by skill">
      <button className="chip" aria-pressed={!value} onClick={() => onChange(null)}>All skills</button>
      {skills.map((s) => <button key={s} className="chip" aria-pressed={value === s} onClick={() => onChange(value === s ? null : s)}>{s}</button>)}
    </div>
  );
}

function Leaderboard() {
  return (
    <aside className="leaders card">
      <p className="eyebrow">Top solvers this season</p>
      <ol>
        {leaders.map((l, i) => (
          <li key={l.name}>
            <span className="rank">{i + 1}</span>
            <span className="who"><strong>{l.name}</strong><small>{l.school} · {l.chosen} chosen</small></span>
            <span className="pts">{l.points.toLocaleString()}</span>
            <div className="bar"><i style={{ width: `${Math.min(100, (l.points / INTERVIEW_AT) * 100)}%` }} /></div>
            {l.points >= INTERVIEW_AT && <span className="badge">Interview unlocked</span>}
          </li>
        ))}
      </ol>
      <p className="tiny">Sample data · {INTERVIEW_AT.toLocaleString()} points unlocks an interview with a partner company.</p>
    </aside>
  );
}
