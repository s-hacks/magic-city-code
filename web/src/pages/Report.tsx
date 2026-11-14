// Report a problem: one text box + neighborhood picker + example sentences. Sends the
// words to the mission maker, shows the mission it made, and an adult approves it with
// one click before it opens.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GenerateResponse, Mission, ProblemCard } from "@mcc/shared";
import { MapView } from "../map/MapView";
import { TopBar } from "../app/TopBar";
import { flaresFor } from "../app/flares";
import { useApp } from "../mission/AppContext";
import { approveMission, generateMission } from "../mission/api";
import { NEED_LABEL } from "../mission/text";

const EXAMPLES: { text: string; hood: string }[] = [
  { text: "There's no grocery store near West End, and I don't have a car.", hood: "west-end" },
  { text: "My kids can't do their homework online at home.", hood: "ensley" },
  { text: "On cold nights, where can people near me go to get warm?", hood: "southside" },
  { text: "With no Saturday bus, I can't get to the store on my day off.", hood: "east-lake" },
  { text: "The produce truck never comes to our side of the neighborhood.", hood: "woodlawn" },
];

type Phase =
  | { k: "form" }
  | { k: "loading" }
  | { k: "error"; message: string }
  | { k: "unsupported"; reason: string }
  | { k: "preview"; mission: Mission; problem: ProblemCard; source: "ai" | "fallback" };

export function Report() {
  const { data, dayMode, registerMission } = useApp();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [hood, setHood] = useState("");
  const [phase, setPhase] = useState<Phase>({ k: "form" });
  const [flareCard, setFlareCard] = useState<ProblemCard | null>(null);
  const [approving, setApproving] = useState(false);

  const hoodName = (id: string | null) => data?.neighborhoods.find((n) => n.id === id)?.name ?? "Birmingham";
  const flares = useMemo(() => (data && flareCard ? flaresFor([flareCard], data.neighborhoods) : []), [data, flareCard]);

  async function submit() {
    if (!text.trim()) return;
    setPhase({ k: "loading" });
    try {
      const res: GenerateResponse = await generateMission({ text: text.trim(), neighborhood: hood || undefined });
      setFlareCard(res.problem);
      if (res.status === "ok") {
        registerMission(res.mission);
        setPhase({ k: "preview", mission: res.mission, problem: res.problem, source: res.source });
      } else setPhase({ k: "unsupported", reason: res.reason });
    } catch {
      setPhase({ k: "error", message: "I couldn't reach the mission maker. You can still try one of the five ready-made missions on the home screen." });
    }
  }

  async function approve(m: Mission) {
    setApproving(true);
    const approved = await approveMission(m.id);
    const ready = approved ?? { ...m, approved: true }; // server away: approve locally for this session
    registerMission(ready);
    nav(`/mission/${ready.id}`);
  }

  return (
    <div className="app" data-screen="report">
      <MapView mode="home" data={data} flares={flares} dayMode={dayMode} cameraPadding={{ top: 90, bottom: 60, left: 60, right: 700 }} />
      <div className="vignette" aria-hidden />
      <TopBar actions={<Link className="btn ghost" to="/">← Back to the city</Link>} />
      <div className="report glass">
        {(phase.k === "form" || phase.k === "error") && (
          <>
            <p className="eyebrow">Report a problem</p>
            <h2>What's wrong in your neighborhood?</h2>
            <p className="muted">Say it the way you'd tell a friend. Please leave out names, phone numbers and addresses.</p>
            <label className="field" htmlFor="problem"><span>The problem</span></label>
            <textarea id="problem" rows={3} value={text} maxLength={400} onChange={(e) => setText(e.target.value)} placeholder="For example: There's no grocery store near me…" />
            <label className="field" htmlFor="hood"><span>Neighborhood</span></label>
            <select id="hood" value={hood} onChange={(e) => setHood(e.target.value)}>
              <option value="">Not sure</option>
              {data?.neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <div className="examples" aria-label="Example problems">
              <span className="muted">Or try one:</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.text} className="example" onClick={() => { setText(ex.text); setHood(ex.hood); }}>
                  “{ex.text}”
                </button>
              ))}
            </div>
            {phase.k === "error" && <p className="error-box" role="alert">{phase.message}</p>}
            <div className="row end"><button className="btn primary big" disabled={!text.trim()} onClick={submit}>Launch flare · make a mission</button></div>
          </>
        )}

        {phase.k === "loading" && (
          <div className="loading-box" role="status">
            <div className="spinner" aria-hidden="true" />
            <h2>Turning your problem into a mission…</h2>
            <p className="muted">This can take a few seconds.</p>
          </div>
        )}

        {phase.k === "unsupported" && (
          <>
            <h2>Thank you for telling us</h2>
            <p>{phase.reason}</p>
            <p className="muted">Your problem card was saved on the board, so it is not lost. Missions for this kind of problem are coming later.</p>
            <button className="btn primary" onClick={() => setPhase({ k: "form" })}>Report another problem</button>
          </>
        )}

        {phase.k === "preview" && (
          <>
            <h2>{phase.mission.title}</h2>
            <blockquote className="quote">“{phase.mission.residentQuote}”</blockquote>
            <p>{phase.mission.story}</p>
            <ul className="facts">
              <li><b>Neighborhood:</b> {hoodName(phase.mission.area.neighborhood)}</li>
              <li><b>Partner:</b> {phase.mission.partner}</li>
              <li><b>Counts:</b> {NEED_LABEL[phase.mission.needColumn]} within a {phase.mission.walkMinutes}-minute walk</li>
            </ul>
            <ol className="level-list">
              {phase.mission.levels.map((l, i) => (
                <li key={i}><b>Level {i + 1}: {l.concept}.</b> {l.title}</li>
              ))}
            </ol>
            <div className="approve-row">
              <button className="btn primary big" disabled={approving} onClick={() => approve(phase.mission)}>✓ Approve and open</button>
              <button className="btn ghost" onClick={() => setPhase({ k: "form" })}>Start over</button>
            </div>
            <p className="muted small">An adult approves a mission before students see it.{phase.source === "fallback" ? " (Made from a ready template.)" : ""}</p>
          </>
        )}
      </div>
    </div>
  );
}
