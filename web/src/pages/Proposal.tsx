// Proposal: the printable one-pager. Route /proposal/draft shows the draft handed over by
// the Mission screen (enter a first name or nickname, then Save). Saved proposals open at
// /proposal/<id>. Printing gives a white page with just the one-pager.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Mission, Proposal } from "@mcc/shared";
import { TopBar } from "../app/TopBar";
import { useApp } from "../mission/AppContext";
import { fetchProposal, saveProposal } from "../mission/api";
import { getLocalProposals, getSnapshot, saveLocalProposal } from "../mission/storage";
import { makeSummary, NEED_LABEL, num, pct } from "../mission/text";

const LABEL = "A student proposal based on public data. A starting point for discussion, not an engineering study.";

interface View {
  proposal: Omit<Proposal, "id" | "createdAt"> & { id?: string; createdAt?: string };
  mission: Mission | null;
  hoodName: string;
  hubs: number;
}

export function ProposalPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { draft, getMission, data } = useApp();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<Proposal | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");

  // Build the view: from the draft, or from a saved proposal.
  useEffect(() => {
    let live = true;
    (async () => {
      if (id === "draft") {
        if (!draft) return live && setMissing(true);
        const summary = makeSummary({ mission: draft.mission, neighborhoodName: draft.neighborhoodName, hubs: draft.hubs, before: draft.before, after: draft.after, helped: draft.helped });
        setView({
          mission: draft.mission,
          hoodName: draft.neighborhoodName,
          hubs: draft.hubs,
          proposal: { studentName: "", missionId: draft.mission.id, missionTitle: draft.mission.title, partner: draft.mission.partner, neighborhood: draft.neighborhoodName, levelIndex: draft.levelIndex, code: draft.code, before: draft.before, after: draft.after, helped: draft.helped, summary },
        });
        return;
      }
      const p = getLocalProposals().find((x) => x.id === id) ?? (await fetchProposal(id));
      if (!live) return;
      if (!p) return setMissing(true);
      const m = await getMission(p.missionId);
      if (!live) return;
      setSaved(p);
      setView({ proposal: p, mission: m, hoodName: p.neighborhood, hubs: Number(/chose (\d+)/.exec(p.summary)?.[1] ?? (p.code.match(/place_hub/g) ?? []).length) });
    })();
    return () => {
      live = false;
    };
  }, [id, draft, getMission]);

  const snapshot = useMemo(() => (view ? getSnapshot(view.proposal.missionId) : null), [view]);
  void data;

  async function save() {
    if (!view) return;
    const first = name.trim().split(/\s+/)[0];
    if (!first) return;
    const input = { ...view.proposal, studentName: first };
    delete (input as { id?: string }).id;
    delete (input as { createdAt?: string }).createdAt;
    let p: Proposal;
    try {
      p = await saveProposal(input);
    } catch {
      p = { ...input, id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
      setNote("The server is not reachable, so this proposal is saved on this laptop only.");
    }
    saveLocalProposal(p);
    setSaved(p);
    setView({ ...view, proposal: p });
    nav(`/proposal/${p.id}`, { replace: true });
  }

  if (missing) {
    return (
      <div className="app plain">
        <TopBar />
        <div className="center-card glass">
          <h2>No proposal here yet</h2>
          <p className="muted">Finish a level, then press “Make a proposal”.</p>
          <Link className="btn primary" to="/">Back to the city</Link>
        </div>
      </div>
    );
  }
  if (!view) return <div className="app plain"><TopBar /></div>;

  const { proposal: p, mission } = view;
  const who = mission ? NEED_LABEL[mission.needColumn] : "households";
  const unit = who;

  return (
    <div className="proposal-page">
      <div className="no-print"><TopBar actions={<Link className="btn ghost" to={mission ? `/mission/${mission.id}` : "/"}>← {mission ? "Back to the mission" : "Home"}</Link>} /></div>
      <div className="paper-wrap">
        <div className="paper-tools no-print">
          {!saved ? (
            <>
              <label htmlFor="nm">Your first name or nickname</label>
              <input id="nm" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="First name only" />
              <button className="btn primary" disabled={!name.trim()} onClick={save}>Save proposal</button>
            </>
          ) : (
            <>
              <span className="ok-text">✓ Saved</span>
              <button className="btn primary" onClick={() => window.print()}>Print</button>
            </>
          )}
          {note && <span className="muted small">{note}</span>}
        </div>

        <article className="paper" aria-label="Student proposal">
          <div className="paper-kicker">✦ Magic City Code · Student proposal</div>
          <h1>{p.missionTitle}: {p.neighborhood}</h1>
          <p className="by">By {saved ? p.studentName : name.trim().split(/\s+/)[0] || "a student"}</p>
          <p className="to">
            To the neighbor who said {mission ? <>“{mission.residentQuote}”</> : "this was a problem"} and to {p.partner}:
          </p>

          <div className="paper-grid">
            <div>
              <div className="stat-row">
                <div className="stat"><div className="n">{pct(p.before)}</div><div className="l">within a walk of food before</div></div>
                <div className="arrow" aria-hidden="true">→</div>
                <div className="stat good"><div className="n">{pct(p.after)}</div><div className="l">after my {view.hubs} {view.hubs === 1 ? "hub" : "hubs"}</div></div>
              </div>
              <div className="helped">About <b>{num(p.helped)}</b> more {unit} within a {mission?.walkMinutes ?? 10}-minute walk (straight-line estimate).</div>
            </div>
            {snapshot && <img className="snap" src={snapshot} alt={`Map of ${p.neighborhood} after the student's plan`} />}
          </div>

          <p className="summary">{p.summary}</p>

          <h3>My code</h3>
          <pre className="code">{p.code}</pre>

          <p className="label">{LABEL}</p>
        </article>
      </div>
    </div>
  );
}
