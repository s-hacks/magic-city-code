// Challenges hub (from the UI prototype), routes /challenges and /problems/:id.
// Practice tab: the challenge list with skills and difficulty (src/data/community.ts).
// City problems tab: the real loop, from the server (/api/city-problems). A neighbor posts a
// problem (with data files) -> coders open it and "Solve in the app" (/problems/:id/solve) ->
// they submit their project -> the poster opens each one (/problems/:id/solutions/:sid),
// runs it, and chooses one. Chosen solutions and upvotes earn points on the leaderboard.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INTERVIEW_AT, POINTS_CHOSEN, POINTS_VOTE, PROJECT_LIMITS, type CityProblem, type CityProblemSummary, type LeaderRow, type PosterKind, type ProjectFile } from '@mcc/shared';
import { practice, type Practice } from '../data/community';
import { neighborhoods } from '../data/mock';
import { Mark } from '../app/icons';
import { cityApi, explain, hasVoted, mySolutions, posterKeyFor } from '../workspace/api';
import '../workspace/workspace.css';

type Tab = 'practice' | 'city';
interface Props { tab: Tab; onTab: (t: Tab) => void; onOpen: (p: Practice) => void; onHome: () => void; problemId?: string | null; sentId?: string | null }
const KINDS: PosterKind[] = ['Resident', 'Neighborhood group', 'Nonprofit', 'City department'];

export default function ChallengeList({ tab, onTab, onOpen, onHome, problemId = null, sentId = null }: Props) {
  const nav = useNavigate();
  const [problems, setProblems] = useState<CityProblemSummary[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [open, setOpen] = useState<CityProblem | null>(null);
  const [openErr, setOpenErr] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [modal, setModal] = useState<'post' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [, bump] = useState(0); // re-render after a vote (votes live in localStorage)
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => { page.current?.scrollTo({ top: 0 }); }, [problemId, tab]); // braces: scrollTo returns a Promise in new browsers

  const loadList = useCallback(() => {
    cityApi.list().then((l) => { setProblems(l); setListErr(null); }, (e) => setListErr(explain(e)));
    cityApi.leaderboard().then(setLeaders, () => {});
  }, []);
  useEffect(() => { if (tab === 'city') loadList(); }, [tab, loadList]);

  // The open problem (from the URL).
  useEffect(() => {
    setOpen(null); setOpenErr(null); setCanReview(false);
    if (!problemId) return;
    let live = true;
    cityApi.get(problemId).then((p) => live && setOpen(p), (e) => live && setOpenErr(explain(e)));
    cityApi.canReview(problemId).then((ok) => live && setCanReview(ok));
    return () => { live = false; };
  }, [problemId]);

  useEffect(() => { if (sentId && open) setToast('Solution sent. The poster will open it and run it.'); }, [sentId, open]);

  const list = problems ?? [];
  const allSkills = [...new Set((tab === 'practice' ? practice : list).flatMap((p) => p.skills))];
  const match = (s: string[]) => !skill || s.includes(skill);
  const mine = mySolutions();

  const vote = async (sid: string) => {
    if (!open || hasVoted(sid)) return;
    try {
      const votes = await cityApi.vote(open.id, sid);
      setOpen({ ...open, solutions: open.solutions.map((s) => (s.id === sid ? { ...s, votes } : s)) });
      bump((n) => n + 1);
      cityApi.leaderboard().then(setLeaders, () => {});
    } catch (e) { setToast(explain(e)); }
  };

  const choose = async (sid: string) => {
    if (!open) return;
    const s = open.solutions.find((x) => x.id === sid);
    if (!s || !window.confirm(`Choose ${s.author}'s solution? This marks the problem solved and gives them ${POINTS_CHOSEN} points.`)) return;
    try {
      setOpen(await cityApi.choose(open.id, sid));
      setToast(`Chosen. ${s.author} earns ${POINTS_CHOSEN} points.`);
      loadList();
    } catch (e) { setToast(explain(e)); }
  };

  const showCity = () => { onTab('city'); setSkill(null); if (problemId) nav('/challenges?tab=city'); };

  return (
    <div className="hub" ref={page}>
      <header className="cbar">
        <button className="brand link" onClick={onHome} title="Home (H)"><Mark /> Magic City Code</button>
        <nav className="hub-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'practice'} onClick={() => { onTab('practice'); setSkill(null); }}>Practice</button>
          <button role="tab" aria-selected={tab === 'city'} onClick={showCity}>City problems {problems && <span className="count">{list.filter((p) => p.status !== 'Solved').length}</span>}</button>
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
              <button className="btn ghost" onClick={showCity}>See city problems →</button>
            </aside>
          </section>
        )}

        {tab === 'city' && !problemId && (
          <section className="city-grid">
            <div>
              <div className="hub-intro">
                <p className="eyebrow grad-text">City problems</p>
                <h1>Real problems, posted by neighbors.</h1>
                <p className="muted">Anyone can post a problem code could solve. Coders solve it right here in a Python project, the poster runs each one and picks what works best, and top solvers get interviews.</p>
              </div>
              <ol className="how">
                <li><b>1</b> A neighbor posts a problem and the data they have.</li>
                <li><b>2</b> Coders open the project, write Python and run the tests in the app.</li>
                <li><b>3</b> The poster runs each submitted project and picks the one that works.</li>
                <li><b>4</b> Chosen solutions earn {POINTS_CHOSEN} points. {INTERVIEW_AT.toLocaleString()} points unlocks an interview.</li>
              </ol>
              <SkillFilter skills={allSkills} value={skill} onChange={setSkill} />
              {listErr && <div className="card cp-err"><p>{listErr}</p><button className="btn ghost small" onClick={loadList}>Try again</button></div>}
              {!problems && !listErr && <p className="muted"><i className="spin" /> Loading problems…</p>}
              <div className="cp-list">
                {list.filter((p) => match(p.skills)).map((p) => (
                  <button key={p.id} className="cp card" onClick={() => nav(`/problems/${p.id}`)}>
                    <div className="cp-top">
                      <span className={`state ${p.status.toLowerCase()}`}>{p.status}</span>
                      <span className="tiny">{p.neighborhood} · {p.postedBy}{p.sample && !/sample/i.test(p.postedBy) ? ' (sample)' : ''}{posterKeyFor(p.id) ? ' · posted by you' : ''}</span>
                    </div>
                    <h3>{p.title}</h3>
                    <p className="muted">{p.summary}</p>
                    <div className="cp-foot">
                      <span className="tags">{p.skills.map((s) => <span key={s} className="tag">{s}</span>)}</span>
                      <span className="tiny">{p.solutionCount} solution{p.solutionCount === 1 ? '' : 's'} · due {p.due}</span>
                    </div>
                    <div className="reward">★ {p.reward}</div>
                  </button>
                ))}
              </div>
            </div>
            <aside className="hub-side">
              <Leaderboard leaders={leaders} />
              {mine.length > 0 && (
                <div className="card mine">
                  <p className="eyebrow">Sent from this browser</p>
                  <ul>{mine.slice(0, 6).map((m) => <li key={m.solutionId}><button className="link-btn" onClick={() => nav(`/problems/${m.problemId}/solutions/${m.solutionId}`)}>{m.title}</button></li>)}</ul>
                </div>
              )}
            </aside>
          </section>
        )}

        {tab === 'city' && problemId && (
          <section className="city-grid">
            <article className="cp-detail">
              <button className="link-btn quiet" onClick={() => nav('/challenges?tab=city')}>← All city problems</button>
              {openErr && <div className="card cp-err"><p>{openErr}</p></div>}
              {!open && !openErr && <p className="muted"><i className="spin" /> Loading…</p>}
              {open && (
                <>
                  <div className="cp-top">
                    <span className={`state ${open.status.toLowerCase()}`}>{open.status}</span>
                    <span className="tiny">{open.posterKind} · {open.postedBy}{open.sample && !/sample/i.test(open.postedBy) ? ' (sample)' : ''} · {open.neighborhood} · due {open.due}</span>
                  </div>
                  <h1>{open.title}</h1>
                  <p className="lead">{open.details}</p>
                  <dl className="facts card">
                    <div><dt>Data provided</dt><dd>{open.data}</dd></div>
                    <div><dt>Skills</dt><dd className="tags">{open.skills.map((s) => <span key={s} className="tag">{s}</span>)}</dd></div>
                    <div><dt>Reward</dt><dd className="gold-text">★ {open.reward}</dd></div>
                  </dl>
                  <div className="card solve-band">
                    <div>
                      <strong>{open.status === 'Solved' ? 'Solved. You can still practice on it.' : 'Solve it in the app'}</strong>
                      <p className="muted">A Python project with the data, starter code and tests: {open.starter.files.length} files. Your work saves in this browser until you submit.</p>
                      <div className="solve-files mono">{open.starter.files.slice(0, 6).map((f) => <span key={f.path}>{f.path}</span>)}{open.starter.files.length > 6 && <span>+{open.starter.files.length - 6} more</span>}</div>
                    </div>
                    <button className="btn big primary" onClick={() => nav(`/problems/${open.id}/solve`)}>{open.status === 'Solved' ? 'Open the project' : 'Solve in the app'} <span aria-hidden>→</span></button>
                  </div>
                  {canReview && open.status !== 'Solved' && (
                    <p className="review-note">You can review this problem{open.sample ? ' (sample problem: this demo computer acts as the poster)' : ' because you posted it from this browser'}. Open a solution to run it, then choose the one that works best.</p>
                  )}
                  <div className="sol-head">
                    <h2>Solutions <span className="count">{open.solutions.length}</span></h2>
                  </div>
                  {open.solutions.length === 0 && <p className="muted">No solutions yet. Be the first.</p>}
                  {open.solutions.map((s) => (
                    <div key={s.id} className={`sol card ${s.chosen ? 'chosen' : ''}${s.id === sentId ? ' mine-new' : ''}`}>
                      <button className="sol-votes" onClick={() => vote(s.id)} disabled={hasVoted(s.id)} title={hasVoted(s.id) ? 'You upvoted this' : `Upvote (+${POINTS_VOTE} points for ${s.author})`} aria-label={`Upvote ${s.author}'s solution`}><span>▲</span><b>{s.votes}</b></button>
                      <div className="sol-body">
                        <div className="sol-meta">
                          <strong>{s.author}</strong><span className="tiny">{s.school} · {timeAgo(s.createdAt)}</span>
                          {s.chosen && <span className="badge">✓ Chosen by poster</span>}
                          {s.id === sentId && <span className="tag">Yours, just sent</span>}
                        </div>
                        <p>{s.approach}</p>
                        <div className="sol-foot">
                          <span className="metric">{s.metric}</span>
                          <span className="tags">{s.skills.map((k) => <span key={k} className="tag">{k}</span>)}</span>
                        </div>
                        <div className="sol-actions">
                          {s.tests && <span className={`ws-testbadge ${s.tests.total > 0 && s.tests.passed === s.tests.total ? 'ok' : 'bad'}`}>{s.tests.passed}/{s.tests.total} tests passed</span>}
                          {s.project ? <button className="btn ghost small" onClick={() => nav(`/problems/${open.id}/solutions/${s.id}`)}>Open project ({s.project.files.length} files) →</button> : <span className="tiny">Write-up only</span>}
                          {canReview && open.status !== 'Solved' && <button className="btn submit small" onClick={() => choose(s.id)}>Choose</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="tiny">The poster opens each project, runs it and marks the one that works best for them. Chosen solutions earn {POINTS_CHOSEN} points; upvotes earn {POINTS_VOTE}.</p>
                </>
              )}
            </article>
            <aside className="hub-side"><Leaderboard leaders={leaders} /></aside>
          </section>
        )}
      </main>

      {toast && <div className="toast" role="status" onAnimationEnd={() => setToast(null)}>{toast}</div>}

      {modal === 'post' && (
        <PostDialog
          onClose={() => setModal(null)}
          onPosted={(p) => { setModal(null); setToast('Problem posted. Coders across Birmingham can now solve it.'); onTab('city'); nav(`/problems/${p.id}`); }}
        />
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Post a problem. Attached data files go into the starter project's data/ folder. */
function PostDialog({ onClose, onPosted }: { onClose: () => void; onPosted: (p: CityProblem) => void }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [why, setWhy] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const attach = async (list: FileList | null) => {
    setWhy(null);
    const out: ProjectFile[] = [...files];
    for (const f of Array.from(list ?? [])) {
      if (f.size > PROJECT_LIMITS.maxFileBytes) { setWhy(`${f.name} is over ${PROJECT_LIMITS.maxFileBytes / 1000} KB.`); continue; }
      const name = f.name.replace(/[^\w .-]/g, '_');
      if (out.length >= 10 || out.some((x) => x.path === name)) continue;
      out.push({ path: name, content: await f.text() });
    }
    setFiles(out);
  };

  const post = async (f: FormData) => {
    const hood = neighborhoods.find((n) => n.id === f.get('hood'));
    setSending(true); setWhy(null);
    try {
      const p = await cityApi.post({
        title: String(f.get('title')).trim(),
        summary: String(f.get('summary')).trim(),
        details: String(f.get('details') || '').trim() || undefined,
        neighborhood: hood?.name ?? 'Birmingham',
        posterKind: f.get('kind') as PosterKind,
        postedBy: String(f.get('postedBy')).trim(),
        skills: String(f.get('skills') || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 6),
        data: String(f.get('data') || '').trim() || (files.length ? files.map((x) => x.path).join(', ') : undefined),
        files,
      });
      onPosted(p);
    } catch (e) {
      setWhy(explain(e));
      setSending(false);
    }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <form className="glass modal post-modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void post(new FormData(e.currentTarget)); }}>
        <h2>Post a city problem</h2>
        <p className="muted">Describe something in your neighborhood that code could help with. Leave out names and addresses.</p>
        <label className="field"><span>Title</span><input name="title" required autoFocus maxLength={90} placeholder="Which corners need streetlights first?" /></label>
        <label className="field"><span>What's the problem?</span><textarea name="summary" required rows={2} maxLength={400} placeholder="Our block is dark at night and kids walk home from practice…" /></label>
        <label className="field"><span>What would a good answer look like? (optional)</span><textarea name="details" rows={2} maxLength={1500} placeholder="A ranked list of the 10 corners where a light helps the most kids." /></label>
        <div className="row two">
          <label className="field"><span>Neighborhood</span>
            <select name="hood" defaultValue="woodlawn">{neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select>
          </label>
          <label className="field"><span>Skills it might need</span><input name="skills" placeholder="Graphs, Sorting" /></label>
        </div>
        <div className="row two">
          <label className="field"><span>Your first name or group</span><input name="postedBy" required maxLength={40} placeholder="Woodlawn Neighbors" /></label>
          <label className="field"><span>You are a…</span>
            <select name="kind" defaultValue="Resident">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </label>
        </div>
        <label className="field"><span>Data you have (optional)</span><input name="data" placeholder="A list of reported outages, a map, a spreadsheet…" /></label>
        <div className="field">
          <span>Attach data files (CSV, JSON or text, up to {PROJECT_LIMITS.maxFileBytes / 1000} KB each)</span>
          <label className="attach">
            <input type="file" multiple accept=".csv,.tsv,.json,.txt,.md" onChange={(e) => { void attach(e.currentTarget.files); e.currentTarget.value = ''; }} />
            <span className="btn ghost small">Choose files</span>
            <span className="tiny">{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} → data/ in the starter project` : 'They go in the data/ folder of the project coders get.'}</span>
          </label>
          {files.length > 0 && (
            <ul className="attached">
              {files.map((f) => (
                <li key={f.path}><span className="mono">data/{f.path}</span><span className="tiny">{(f.content.length / 1024).toFixed(1)} KB</span><button type="button" className="link-btn quiet" onClick={() => setFiles(files.filter((x) => x !== f))}>Remove</button></li>
              ))}
            </ul>
          )}
        </div>
        {why && <p className="ws-why" role="alert">{why}</p>}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={sending}>{sending ? <i className="spin" /> : null} Post problem</button>
        </div>
      </form>
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

function Leaderboard({ leaders }: { leaders: LeaderRow[] }) {
  return (
    <div className="leaders card">
      <p className="eyebrow">Top solvers this season</p>
      {leaders.length === 0 && <p className="tiny">No points yet.</p>}
      <ol>
        {leaders.map((l, i) => (
          <li key={`${l.name}|${l.school}`}>
            <span className="rank">{i + 1}</span>
            <span className="who"><strong>{l.name}</strong><small>{l.school} · {l.chosen} chosen</small></span>
            <span className="pts">{l.points.toLocaleString()}</span>
            <div className="bar"><i style={{ width: `${Math.min(100, (l.points / INTERVIEW_AT) * 100)}%` }} /></div>
            {l.points >= INTERVIEW_AT && <span className="badge">Interview unlocked</span>}
          </li>
        ))}
      </ol>
      <p className="tiny">{POINTS_CHOSEN} points per chosen solution, {POINTS_VOTE} per upvote. {INTERVIEW_AT.toLocaleString()} points unlocks an interview with a partner company. Sample solvers are made up.</p>
    </div>
  );
}
