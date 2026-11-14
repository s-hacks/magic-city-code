// Landing page entry (landing.html). A separate site from the app: it shares the app's tokens
// (theme.ts + index.css) and data, and links into the app with appHref().
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./Landing";
import { applyCssVars } from "../theme";
import "../index.css";
import "./landing.css";

applyCssVars("night");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
