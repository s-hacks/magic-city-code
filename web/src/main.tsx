// App entry. Placeholder until mission-ui wires the real screens.
import React from "react";
import { createRoot } from "react-dom/client";

function Placeholder() {
  return <div style={{ color: "#fff", background: "#0b1020", height: "100vh", padding: 24 }}>Magic City Code — building…</div>;
}

createRoot(document.getElementById("root")!).render(<Placeholder />);
