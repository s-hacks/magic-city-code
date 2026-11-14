// Top bar shared by every screen: brand (home link), an optional centre label
// ("West End · Level 2/3"), Python load status, and the Day/Night switch (also the D key).
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../mission/AppContext";

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable || !!el.closest?.(".cm-editor"));
}

export function TopBar({ center, backTo, hideBrand }: { center?: string; hideBrand?: boolean; backTo?: { to: string; label: string } }) {
  const { runnerStatus, dayMode, toggleDay } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) toggleDay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleDay]);

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
      <Link to="/" className="brand" style={hideBrand ? { visibility: "hidden" } : undefined}>✦ Magic City Code</Link>
      {backTo && <Link to={backTo.to} className="chip">← {backTo.label}</Link>}
      <div className="topcenter">{center}</div>
      <span className={`chip status ${cls}`} title={runnerStatus.state === "error" ? runnerStatus.message : runnerStatus.state === "loading" ? runnerStatus.message : "Python is ready"}>
        <span className="pip" aria-hidden="true" /> {python}
      </span>
      <button className="chip" onClick={toggleDay} aria-pressed={dayMode} title="Press D">
        {dayMode ? "☀ Day" : "☾ Night"} map
      </button>
    </header>
  );
}
