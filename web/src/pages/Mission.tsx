// /mission/:id — loads the mission (from this session, the server, or the static files)
// and hands it to the Mission screen.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Mission } from "@mcc/shared";
import { TopBar } from "../app/TopBar";
import { useApp } from "../mission/AppContext";
import { MissionScreen } from "../mission/MissionScreen";

export function MissionPage() {
  const { id = "" } = useParams();
  const { getMission } = useApp();
  const [mission, setMission] = useState<Mission | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "ok">("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    getMission(id).then((m) => {
      if (!live) return;
      setMission(m);
      setState(m ? "ok" : "missing");
    });
    return () => {
      live = false;
    };
  }, [id, getMission]);

  if (state === "ok" && mission) return <MissionScreen key={mission.id} mission={mission} />;
  return (
    <div className="screen plain">
      <TopBar />
      <div className="center-card glass">
        {state === "loading" ? <h2>Loading mission…</h2> : (
          <>
            <h2>We couldn't find that mission</h2>
            <Link className="big-btn" to="/">Back to the city</Link>
          </>
        )}
      </div>
    </div>
  );
}
