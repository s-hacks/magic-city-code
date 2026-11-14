// The Mission screen logic: map full screen, two floating panels, and the one loop
//   Run -> Python (worker) -> actions -> engine.simulate -> map animates -> meter fills
//   -> goal check -> next level unlocks -> proposal.
// Rules from the map: bump runToken in the same render as the new result; show the meter's
// new numbers only after onRunComplete, and only for a result with no rule errors.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Mission, Result, SiteInfo } from "@mcc/shared";
import { MapView, type MapViewHandle } from "../map/MapView";
import { Legend } from "../map/Legend";
import { useCompare } from "../map/useCompare";
import { useDemoKeys } from "../code/demoKeys";
import { baseline, describeSites, neighborhoodsSummary, simulate } from "../engine";
import { TopBar, isTyping } from "../app/TopBar";
import { Lock } from "../app/icons";
import type { LayerGroup } from "../map/layerGroups";
import { themes } from "../theme";
import { useApp } from "./AppContext";
import { MissionPanel } from "./MissionPanel";
import { CodePanel } from "./CodePanel";
import { Coach } from "./Coach";
import { getUnlocked, saveSnapshot, setUnlocked } from "./storage";
import { pct } from "./text";

/** Draw every canvas in the map (map + lights) onto one small picture. */
function snapshotOf(handle: MapViewHandle | null, background: string): string | null {
  try {
    const container = handle?.getMap()?.getContainer();
    const canvases = Array.from(container?.querySelectorAll("canvas") ?? []) as HTMLCanvasElement[];
    if (!canvases.length) return null;
    const w = canvases[0].width;
    const h = canvases[0].height;
    const scale = Math.min(1, 1100 / w);
    const out = document.createElement("canvas");
    out.width = Math.round(w * scale);
    out.height = Math.round(h * scale);
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    for (const c of canvases) if (c.width > 0) ctx.drawImage(c, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

export function MissionScreen({ mission }: { mission: Mission }) {
  const { data, runner, runnerStatus, dayMode, formerStores, setDraft } = useApp();
  const nav = useNavigate();
  const maxIndex = mission.levels.length - 1;

  const [levelIndex, setLevelIndex] = useState(0);
  const [unlocked, setUnlockedState] = useState(() => getUnlocked(mission.id, maxIndex));
  const codes = useRef<Record<number, string>>({});
  const [code, setCodeState] = useState(mission.levels[0].starterCode);
  const [result, setResult] = useState<Result | null>(null);
  const [runToken, setRunToken] = useState(0);
  const [shown, setShown] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [stdout, setStdout] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ text: string; next: boolean } | null>(null);
  const [lastError, setLastError] = useState<string | undefined>();
  const pending = useRef<Result | null>(null);
  const handle = useRef<MapViewHandle>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState({ top: 80, bottom: 90, left: 440, right: 560 });
  const { comparing, buttonProps } = useCompare();
  const [hidden, setHidden] = useState<ReadonlySet<LayerGroup>>(new Set());
  const toggleLayer = (g: LayerGroup) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const hood = data?.neighborhoods.find((n) => n.id === mission.area.neighborhood)?.name ?? "this neighborhood";
  const level = mission.levels[levelIndex];

  const sites: SiteInfo[] | undefined = useMemo(() => (data ? describeSites(mission, data) : undefined), [mission, data]);
  const base = useMemo(() => (data ? baseline(mission, data, levelIndex) : null), [mission, data, levelIndex]);

  // Real panel sizes -> camera padding.
  useEffect(() => {
    const measure = () => {
      const l = leftRef.current?.getBoundingClientRect();
      const r = rightRef.current?.getBoundingClientRect();
      setPad({ top: 80, bottom: 80, left: Math.round((l?.right ?? 400) + 16), right: Math.round(window.innerWidth - (r?.left ?? window.innerWidth - 540) + 16) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    leftRef.current && ro.observe(leftRef.current);
    rightRef.current && ro.observe(rightRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [data]);

  const setCode = useCallback((c: string) => {
    setCodeState(c);
    setStatus("");
  }, []);
  const onChange = (c: string) => {
    codes.current[levelIndex] = c;
    setCode(c);
  };

  function resetRunState() {
    pending.current = null;
    setResult(null);
    setShown(null);
    setStdout("");
    setProblems([]);
    setStatus("");
    setErrorLine(null);
    setHighlight(null);
    setBanner(null);
    setLastError(undefined);
  }

  function goLevel(i: number) {
    if (i === levelIndex || i > unlocked || !mission.levels[i]) return;
    codes.current[levelIndex] = code;
    setLevelIndex(i);
    setCodeState(codes.current[i] ?? mission.levels[i].starterCode);
    resetRunState();
  }

  // Demo keys: Ctrl+Shift+1/2/3 types that level's solution (switching level if unlocked).
  useDemoKeys(mission.levels, (solution) => {
    const idx = mission.levels.findIndex((l) => l.solution === solution);
    if (idx >= 0 && idx !== levelIndex && idx <= unlocked) {
      codes.current[levelIndex] = code;
      setLevelIndex(idx);
      resetRunState();
    }
    const target = idx >= 0 && idx <= unlocked ? idx : levelIndex;
    codes.current[target] = solution;
    setCodeState(solution);
  });

  const runRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && !isTyping(e.target)) runRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function run() {
    if (running || !data || !sites) return;
    setRunning(true);
    setStdout("");
    setProblems([]);
    setStatus("");
    setErrorLine(null);
    setBanner(null);
    const outcome = await runner.run(
      code,
      { sites, stores: data.stores, neighborhoods: neighborhoodsSummary(mission, data) },
      { onStdout: (t) => setStdout((s) => s + t) },
    );
    if (!outcome.ok) {
      setErrorLine(outcome.line ?? null);
      setProblems([outcome.friendly]);
      setLastError(outcome.friendly);
      setRunning(false);
      return;
    }
    const res = simulate(mission, outcome.actions, data, levelIndex);
    if (!res.ok) {
      const errs = res.errors.length ? res.errors : [{ message: "Something about the hubs did not work." }];
      setProblems(errs.map((e) => e.message));
      setErrorLine(res.errors.find((e) => e.line)?.line ?? null);
      setLastError(errs[0].message);
      setRunning(false);
      return;
    }
    setLastError(undefined);
    pending.current = res;
    setResult(res);
    setRunToken((t) => t + 1); // same render as setResult
  }

  const onRunComplete = useCallback(() => {
    const res = pending.current;
    pending.current = null;
    setRunning(false);
    setHighlight(null);
    if (!res || !res.ok) return;
    setShown(res);
    const n = res.placed.length;
    setStatus(n === 0 ? "Your code ran, but it did not place any hubs yet." : `Placed ${n} ${n === 1 ? mission.thing : mission.thing + "s"}.`);
    if (res.goalMet) {
      const hasNext = levelIndex < maxIndex;
      if (hasNext && unlocked < levelIndex + 1) {
        setUnlocked(mission.id, levelIndex + 1);
        setUnlockedState(levelIndex + 1);
      }
      setBanner({ text: `You lit up ${pct(res.metrics.coverage)} of ${hood}!`, next: hasNext });
    }
  }, [levelIndex, maxIndex, unlocked, mission.id, mission.thing, hood]);

  // Click a site on the map -> put its place_hub line in the code.
  const onSiteClick = useCallback(
    (s: { name: string }) => {
      const line = `city.place_hub(${JSON.stringify(s.name)})`;
      const next = code.replace(/\s*$/, "") + "\n" + line + "\n";
      codes.current[levelIndex] = next;
      setCode(next);
    },
    [code, levelIndex, setCode],
  );

  runRef.current = run;

  function makeProposal() {
    const r = shown;
    if (!r) return;
    const snap = snapshotOf(handle.current, themes[dayMode ? "day" : "night"].land);
    if (snap) saveSnapshot(mission.id, snap);
    setDraft({
      mission,
      neighborhoodName: hood,
      levelIndex,
      code,
      hubs: r.placed.length,
      before: r.metrics.baselineCoverage,
      after: r.metrics.coverage,
      helped: r.metrics.helped,
    });
    nav("/proposal/draft");
  }

  const coach = (
    <Coach key={`${mission.id}-${levelIndex}`} mission={mission} levelIndex={levelIndex} code={code} lastError={lastError} lastCoverage={shown?.metrics.coverage} />
  );

  return (
    <div className="app" data-screen="mission">
      {base && (
        <MapView
          ref={handle}
          mode="mission"
          data={data}
          mission={mission}
          result={result}
          baselineResult={base}
          showBaseline={comparing}
          runToken={runToken}
          sites={sites}
          dayMode={dayMode}
          cameraPadding={pad}
          hidden={hidden}
          onSiteClick={onSiteClick}
          onRunStep={(s) => setHighlight(s?.line ?? null)}
          onRunComplete={onRunComplete}
        />
      )}
      <div className="vignette" aria-hidden />
      {shown?.goalMet && <div key={runToken} className="wave" aria-hidden />}

      <TopBar>
        <span className="crumb">{hood}</span>
        {mission.levels.map((l, i) => {
          const locked = i > unlocked;
          return (
            <button key={i} className="pill" aria-current={i === levelIndex} disabled={locked} onClick={() => goLevel(i)} title={locked ? "Finish the last level to unlock" : `${l.title} · ${l.concept}`}>
              {locked ? <Lock /> : null} Level {i + 1}
            </button>
          );
        })}
      </TopBar>

      <aside className="glass panel mission-panel" aria-label="Mission" ref={leftRef}>
        {base && data ? (
          <MissionPanel
            mission={mission}
            hood={hood}
            levelIndex={levelIndex}
            baseline={base}
            shown={shown}
            comparing={comparing}
            data={data}
            formerStores={formerStores}
            onProposal={makeProposal}
          />
        ) : (
          <p className="muted">Loading the city…</p>
        )}
      </aside>

      <section className="glass panel code-panel" aria-label="Your code" ref={rightRef}>
        <CodePanel
          code={code}
          onChange={onChange}
          highlightLine={highlight}
          errorLine={errorLine}
          onRun={run}
          running={running}
          loading={runnerStatus.state === "loading"}
          canCompare={!!shown}
          compareProps={buttonProps as unknown as Record<string, unknown>}
          comparing={comparing}
          stdout={stdout}
          problems={runnerStatus.state === "error" ? [`Python could not start: ${runnerStatus.message}`, ...problems] : problems}
          status={status}
          success={banner?.text}
          nextLevel={banner?.next ? levelIndex + 2 : undefined}
          onNext={() => goLevel(levelIndex + 1)}
          onProposal={banner ? makeProposal : undefined}
          coach={coach}
        />
      </section>

      <Legend walkMinutes={mission.walkMinutes} showStores={mission.existingSources !== "none"} hidden={hidden} onToggle={toggleLayer} />
    </div>
  );
}
