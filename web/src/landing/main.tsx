// Landing page entry (landing.html). A separate site from the app: it takes its colors from the
// app's tokens (theme.ts, set as CSS variables below) but not the app's stylesheet, whose
// class names (.hero, .wave, .tag...) clash with the landing's. Links go to the app via appHref().
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./Landing";
import { applyCssVars } from "../theme";
import "./landing.css";

applyCssVars("night");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
