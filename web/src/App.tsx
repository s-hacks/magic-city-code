// Routes: / (home), /report, /mission/:id, /proposal/:id.
// Visiting /?reset=1 wipes this app's saved state (demo reset) and returns to /.
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { Report } from "./pages/Report";
import { MissionPage } from "./pages/Mission";
import { ProposalPage } from "./pages/Proposal";

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
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/report" element={<Report />} />
      <Route path="/mission/:id" element={<MissionPage />} />
      <Route path="/proposal/:id" element={<ProposalPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
