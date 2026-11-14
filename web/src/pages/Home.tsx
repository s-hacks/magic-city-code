// Home (as in the UI prototype): the city at night with the fly-in, one flare per resident
// problem (hover one to read it, click one that has a mission to open it), and the hero with
// the app's two ways in: "Browse challenges" (/challenges) and "Solve a real city problem"
// (/challenges?tab=city). "Report a problem" is in the top bar.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProblemCard } from "@mcc/shared";
import { MapView, type Flare } from "../map/MapView";
import { TopBar } from "../app/TopBar";
import { flaresFor } from "../app/flares";
import { useApp } from "../mission/AppContext";
import { listMissionSummaries, listProblems, type MissionSummary } from "../mission/api";

export function Home() {
  const { data, dayMode } = useApp();
  const nav = useNavigate();
  const [problems, setProblems] = useState<ProblemCard[]>([]);
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    listProblems().then(setProblems);
    listMissionSummaries().then(setMissions);
  }, []);

  const titles = useMemo(() => Object.fromEntries(missions.map((m) => [m.id, m.title])), [missions]);
  const hoodName = (id: string | null) => data?.neighborhoods.find((n) => n.id === id)?.name ?? "Birmingham";
  const flares = useMemo(() => {
    if (!data) return [];
    const labels: Record<string, string> = {};
    for (const p of problems) if (p.missionId && titles[p.missionId]) labels[p.id] = titles[p.missionId];
    return flaresFor(problems, data.neighborhoods, labels);
  }, [data, problems, titles]);

  // Only missions an adult approved can be opened. (The seed index lists approved ones only.)
  const approved = useMemo(() => new Set(missions.map((m) => m.id)), [missions]);
  const canOpen = (p: ProblemCard) => !!p.missionId && approved.has(p.missionId);
  const openProblem = (p?: ProblemCard) => p && canOpen(p) && nav(`/mission/${p.missionId}`);
  const hovered = problems.find((p) => p.id === hover);

  return (
    <div className="app" data-screen="home">
      <MapView
        mode="home"
        data={data}
        flares={flares}
        dayMode={dayMode}
        cameraPadding={{ top: 90, bottom: 60, left: Math.min(window.innerWidth * 0.42, 640), right: 60 }}
        onFlareClick={(f: Flare) => openProblem(problems.find((p) => p.id === f.id))}
        onFlareHover={(f) => setHover(f?.id ?? null)}
      />
      <div className="vignette" aria-hidden />
      <TopBar actions={<button className="btn ghost" onClick={() => nav("/report")}>Report a problem</button>} />

      <section className="hero">
        <p className="eyebrow">Birmingham, Alabama · Built on iron, run on code</p>
        <h1>Write code that <em>lights up</em> the Magic City.</h1>
        <p className="lede">Every dot is a family. Every flare is a real problem a neighbor told us about. Pick one, write a little Python, and watch your neighborhood glow.</p>
        <div className="hero-actions">
          <button className="btn big primary" onClick={() => nav("/challenges")}>Browse challenges <span aria-hidden>→</span></button>
          <button className="btn big ghost" onClick={() => nav("/challenges?tab=city")}>Solve a real city problem</button>
        </div>
        <p className="tiny">{problems.length} problems reported · click a flare to jump straight in</p>
      </section>

      {hovered && (
        <div className={`flare-card glass is-shown${canOpen(hovered) ? " has-mission" : ""}`} role="status">
          <div className="flare-hood">{hoodName(hovered.neighborhood)}</div>
          <div className="flare-quote">“{hovered.text}”</div>
          <div className="flare-cta">{canOpen(hovered) ? "Click the flare to open the mission →" : hovered.missionId ? "Waiting for an adult to approve" : "Saved · mission in the works"}</div>
        </div>
      )}
    </div>
  );
}
