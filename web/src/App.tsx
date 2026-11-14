// Routes: / (landing: the mission list), /city (the city map with problem flares),
// /report, /mission/:id, /challenge/:id, /proposal/:id.
// Visiting /?reset=1 wipes this app's saved state (demo reset) and returns to /.
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Home } from "./pages/Home";
import { Report } from "./pages/Report";
import { MissionPage } from "./pages/Mission";
import { ProposalPage } from "./pages/Proposal";
import { useApp } from "./mission/AppContext";
import { challenges } from "./challenges";

// The landing (three.js) and the challenge page (its own Pyodide worker) load on demand.
const Landing = lazy(() => import("./landing/Landing"));
const ChallengePage = lazy(() => import("./pages/Challenge"));

function ChallengeRoute() {
  const { id = "" } = useParams();
  const { dayMode, toggleDay } = useApp();
  const nav = useNavigate();
  const ch = challenges[id as keyof typeof challenges];
  if (!ch) return <Navigate to="/" replace />;
  // The registry mixes challenge data types; the page is generic over them.
  return <ChallengePage ch={ch as Parameters<typeof import("./pages/Challenge").default>[0]["ch"]} theme={dayMode ? "day" : "night"} onHome={() => nav("/#missions")} onTheme={toggleDay} />;
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
      <Route path="/" element={<Landing />} />
      <Route path="/city" element={<Home />} />
      <Route path="/challenge/:id" element={<ChallengeRoute />} />
      <Route path="/report" element={<Report />} />
      <Route path="/mission/:id" element={<MissionPage />} />
      <Route path="/proposal/:id" element={<ProposalPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
