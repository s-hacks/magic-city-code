// Top bar shared by every screen (UI prototype look): the brand (home link, also the
// H key), whatever the screen puts in the middle (level pills on the Mission screen),
// the Python status pill, and the projector-mode switch (also the D key).
import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../mission/AppContext";
import { Mark, Moon, Sun } from "./icons";

export function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || !!el.closest?.(".cm-editor"));
}

export function TopBar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  const { runnerStatus, dayMode, toggleDay } = useApp();
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "d") toggleDay();
      if (k === "h") nav("/#missions");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleDay, nav]);

  let python: string;
  let cls = "";
  if (runnerStatus.state === "loading") {
    python = `Python is waking up${runnerStatus.progress != null ? ` ${Math.round(runnerStatus.progress * 100)}%` : "…"}`;
    cls = "loading";
  } else if (runnerStatus.state === "error") {
    python = "Python could not start";
    cls = "bad";
  } else {
    python = "Python ready";
    cls = "ok";
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand" title="Home (H)"><Mark /> Magic City Code</Link>
      <nav className="levels" aria-label="Mission">
        {children}
        <span className={`pill status ${cls}`} title={"message" in runnerStatus ? runnerStatus.message : "Python is ready"}>
          <span className="pip" aria-hidden="true" /> {python}
        </span>
        {actions}
        <button className="icon-btn" onClick={toggleDay} aria-pressed={dayMode} title="Projector mode (D)" aria-label="Toggle projector mode">
          {dayMode ? <Moon /> : <Sun />}
        </button>
      </nav>
    </header>
  );
}
