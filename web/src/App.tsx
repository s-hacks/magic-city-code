// Routes: / (home), /report, /mission/:id, /proposal/:id.
import { Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Report } from "./pages/Report";
import { MissionPage } from "./pages/Mission";
import { ProposalPage } from "./pages/Proposal";

export function App() {
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
