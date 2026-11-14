// Routes: / (home: the city map with problem flares), /challenges (practice list + city problems), /report, /mission/:id, /challenge/:id, /proposal/:id.
// City problems: /problems/:id (detail + solutions), /problems/:id/solve (the workspace),
// /problems/:id/solutions/:sid (a submitted project, read-only, to run and review).
// Visiting /?reset=1 wipes this app's saved state (demo reset) and returns to /.
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Home } from "./pages/Home";
import { Report } from "./pages/Report";
import { MissionPage } from "./pages/Mission";
import { ProposalPage } from "./pages/Proposal";
import { useApp } from "./mission/AppContext";
import { challenges } from "./challenges";

// The landing page is a separate site (landing.html, its own port). The challenge pages
// (their own Pyodide worker) load on demand.
const ChallengePage = lazy(() => import("./pages/Challenge"));
const ChallengeList = lazy(() => import("./pages/ChallengeList"));
const WorkspacePage = lazy(() => import("./pages/Workspace"));

function ChallengesRoute() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { id } = useParams();
  const tab = id || params.get("tab") === "city" ? "city" : "practice";
  return (
    <ChallengeList
      tab={tab}
      problemId={id ?? null}
      sentId={params.get("sent")}
      onTab={(t) => (id ? nav(t === "city" ? "/challenges?tab=city" : "/challenges") : setParams(t === "city" ? { tab: "city" } : {}, { replace: true }))}
      onHome={() => nav("/")}
      onOpen={(p) => p.open && nav(p.open === "challenge" ? `/challenge/${p.id}` : `/mission/${p.id}`)}
    />
  );
}

function ChallengeRoute() {
  const { id = "" } = useParams();
  const { dayMode, toggleDay } = useApp();
  const nav = useNavigate();
  const ch = challenges[id as keyof typeof challenges];
  if (!ch) return <Navigate to="/" replace />;
  // The registry mixes challenge data types; the page is generic over them.
  return <ChallengePage ch={ch as Parameters<typeof import("./pages/Challenge").default>[0]["ch"]} theme={dayMode ? "day" : "night"} onHome={() => nav("/")} onList={() => nav("/challenges")} onTheme={toggleDay} />;
}

function clearKeys(store: Storage) {
  try {
    Object.keys(store)
      .filter((k) => k.startsWith("mcc."))
      .forEach((k) => store.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const wantsReset = loc.pathname === "/" && new URLSearchParams(loc.search).get("reset") === "1";
  const [resetting, setResetting] = useState(wantsReset);

  useEffect(() => {
    if (!wantsReset) return;
    setResetting(true);
    try {
      clearKeys(localStorage);
    } catch {
      /* ignore */
    }
    try {
      clearKeys(sessionStorage);
    } catch {
      /* ignore */
    }
    fetch("/api/admin/reset", { method: "POST", signal: AbortSignal.timeout(3000) })
      .catch(() => {})
      .finally(() => {
        nav("/", { replace: true });
        setResetting(false);
      });
  }, [wantsReset, nav]);

  if (resetting || wantsReset) return null;
  return (
    <Suspense fallback={<div className="app" />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/city" element={<Navigate to="/" replace />} />
      <Route path="/challenges" element={<ChallengesRoute />} />
      <Route path="/challenge/:id" element={<ChallengeRoute />} />
      <Route path="/problems/:id" element={<ChallengesRoute />} />
      <Route path="/problems/:id/solve" element={<WorkspacePage mode="solve" />} />
      <Route path="/problems/:id/solutions/:sid" element={<WorkspacePage mode="review" />} />
      <Route path="/report" element={<Report />} />
      <Route path="/mission/:id" element={<MissionPage />} />
      <Route path="/proposal/:id" element={<ProposalPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
