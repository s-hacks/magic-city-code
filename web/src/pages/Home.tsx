// Home: the city at night with the fly-in, one flare per resident problem, a drawer of
// problem cards (click one that has a mission to open it), the five quick-start mission
// tiles, and the "Report a problem" button.
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
  const [open, setOpen] = useState(true);

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

  const openProblem = (p: ProblemCard) => p.missionId && nav(`/mission/${p.missionId}`);
  const hovered = problems.find((p) => p.id === hover);

  return (
    <div className="screen">
      <MapView
        mode="home"
        data={data}
        flares={flares}
        dayMode={dayMode}
        cameraPadding={{ top: 90, bottom: 140, left: 460, right: 440 }}
        onFlareClick={(f: Flare) => openProblem(problems.find((p) => p.id === f.id)!)}
        onFlareHover={(f) => setHover(f?.id ?? null)}
      />
      <TopBar hideBrand />

      <div className="hero glass">
        <h1>✦ Magic City Code</h1>
        <p>Real problems from Birmingham neighbors. Write a little Python and light up the city.</p>
        <button className="big-btn" onClick={() => nav("/report")}>＋ Report a problem</button>
      </div>

      <aside className={`drawer glass ${open ? "" : "closed"}`} aria-label="Resident problems">
        <button className="drawer-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span>Neighbors say… ({problems.length})</span>
          <span aria-hidden="true">{open ? "▾" : "▴"}</span>
        </button>
        {open && (
          <ul className="problem-list">
            {problems.map((p) => (
              <li key={p.id}>
                <button
                  className={`problem ${hover === p.id ? "hot" : ""}`}
                  disabled={!p.missionId}
                  onClick={() => openProblem(p)}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="where">{hoodName(p.neighborhood)}</span>
                  <span className="said">“{p.text}”</span>
                  <span className="tag">{p.missionId ? "Open mission →" : "Saved · no mission yet"}</span>
                </button>
              </li>
            ))}
            {problems.length === 0 && <li className="muted pad">No problems yet. Report the first one.</li>}
          </ul>
        )}
      </aside>

      {hovered && !open && (
        <div className="hovercard glass">
          <strong>{hoodName(hovered.neighborhood)}</strong>
          <div>“{hovered.text}”</div>
        </div>
      )}

      <section className="tiles" aria-label="Quick-start missions">
        {missions.map((m) => (
          <button key={m.id} className="tile glass" onClick={() => nav(`/mission/${m.id}`)}>
            <span className="tile-title">{m.title}</span>
            <span className="tile-sub">{hoodName(m.neighborhood)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
