// Dev harness for the map: renders MapView, the meter and the legend with real data
// and the real engine when available, otherwise a synthetic West End and a fake engine.
// Keys: R run 5 hubs, B hold to compare, D day/night, H home/mission. Not part of the app.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Action, CityData, Mission, Result, SiteInfo } from "@mcc/shared";
import { MapView, type Flare, type MapViewHandle } from "./MapView";
import { CityMeter } from "./CityMeter";
import { Legend } from "./Legend";
import { useCompare } from "./useCompare";
import { loadCityData } from "./dataLoader";
import { fakeDescribeSites, fakeSimulate, harnessMission, syntheticCity } from "./harnessData";

interface EngineApi {
  simulate(m: Mission, a: Action[], d: CityData, level?: number): Result;
  baseline(m: Mission, d: CityData, level?: number): Result;
  describeSites(m: Mission, d: CityData): SiteInfo[];
}

// Untyped glob import so the harness never breaks the typecheck if the engine changes.
const engineModules = import.meta.glob("../engine/index.ts");

async function loadEngine(): Promise<EngineApi | null> {
  const load = engineModules["../engine/index.ts"];
  if (!load) return null;
  try {
    const m = (await load()) as Partial<EngineApi>;
    return m.simulate && m.baseline && m.describeSites ? (m as EngineApi) : null;
  } catch {
    return null;
  }
}

function meters(a: [number, number], b: [number, number]) {
  return Math.hypot((a[0] - b[0]) * 92800, (a[1] - b[1]) * 110540);
}

function pickSpread(sites: SiteInfo[], n: number, minGap = 650): SiteInfo[] {
  const out: SiteInfo[] = [];
  for (const s of [...sites].sort((a, b) => b.families_nearby - a.families_nearby)) {
    if (out.every((o) => meters([o.lon, o.lat], [s.lon, s.lat]) > minGap)) out.push(s);
    if (out.length >= n) break;
  }
  return out;
}

function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0, last = performance.now(), raf = 0;
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last > 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

const btn: React.CSSProperties = {
  font: "600 16px 'Space Grotesk', system-ui, sans-serif",
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(242,245,255,0.25)",
  background: "rgba(28,37,64,0.9)",
  color: "#F2F5FF",
  cursor: "pointer",
};

export function MapHarness() {
  const [data, setData] = useState<CityData | null>(null);
  const [engine, setEngine] = useState<EngineApi | null>(null);
  const [source, setSource] = useState("loading…");
  const [mode, setMode] = useState<"home" | "mission">("home");
  const [dayMode, setDayMode] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [runToken, setRunToken] = useState(0);
  const [step, setStep] = useState<string>("");
  const [shownMetrics, setShownMetrics] = useState<Result | null>(null);
  const [extraFlares, setExtraFlares] = useState<Flare[]>([]);
  const [hoverFlare, setHoverFlare] = useState<string | null>(null);
  const { comparing, buttonProps } = useCompare();
  const fps = useFps();
  const mapHandle = useRef<MapViewHandle>(null);
  useEffect(() => {
    (window as any).__mcc = { handle: mapHandle, result: () => result };
  });

  useEffect(() => {
    (async () => {
      const [d, e] = await Promise.all([loadCityData().catch(() => null), loadEngine()]);
      const city = d ?? syntheticCity();
      setData(city);
      setEngine(d ? e : null);
      setSource(`${d ? "real data" : "synthetic data"} · ${d && e ? "real engine" : "fake engine"}`);
    })();
  }, []);

  const mission = useMemo(() => {
    const n = data?.neighborhoods.find((x) => x.id === "west-end");
    return n ? harnessMission(n.bbox, n.id) : harnessMission();
  }, [data]);

  const api = useMemo(
    () => ({
      simulate: (a: Action[]) => (engine ? engine.simulate(mission, a, data!) : fakeSimulate(mission, a, data!)),
      describe: () => (engine ? engine.describeSites(mission, data!) : fakeDescribeSites(mission, data!)),
    }),
    [engine, mission, data],
  );

  const baselineResult = useMemo(() => (data ? api.simulate([]) : null), [data, api]);
  const sites = useMemo(() => (data ? api.describe() : undefined), [data, api]);

  useEffect(() => {
    if (baselineResult && !result) {
      setResult(baselineResult);
      setShownMetrics(baselineResult);
    }
  }, [baselineResult, result]);

  const run = useCallback(
    (n: number, broken = false) => {
      if (!sites || !data) return;
      const chosen = pickSpread(sites, n);
      const actions: Action[] = chosen.map((s, i) => ({ type: "place_hub", siteId: s.id, line: 3 + i }));
      let r = api.simulate(actions);
      if (broken) r = { ...r, ok: false, placed: [], errors: [{ code: "unknown_site", message: "That site is not on the map.", line: 2 }] };
      setMode("mission");
      setResult(r);
      setRunToken((t) => t + 1);
    },
    [sites, data, api],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "r") run(5);
      if (k === "d") setDayMode((x) => !x);
      if (k === "h") setMode((m) => (m === "home" ? "mission" : "home"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const flares: Flare[] = useMemo(() => {
    const ns = data?.neighborhoods ?? [];
    const labels = ["No grocery store", "Bus takes an hour", "No fresh food nearby", "Corner store only"];
    return [...ns.slice(0, 4).map((n, i) => ({ id: `p-${n.id}`, lon: n.center[0], lat: n.center[1], label: labels[i] })), ...extraFlares];
  }, [data, extraFlares]);

  const reportProblem = () => {
    const ns = data?.neighborhoods ?? [];
    const n = ns[(4 + extraFlares.length) % Math.max(1, ns.length)];
    if (n) setExtraFlares((f) => [...f, { id: `new-${f.length}`, lon: n.center[0], lat: n.center[1], label: "New: no pharmacy" }]);
    setMode("home");
  };

  const m = shownMetrics?.metrics;
  const base = baselineResult?.metrics;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0B1020", overflow: "hidden" }}>
      <MapView
        ref={mapHandle}
        mode={mode}
        data={data}
        mission={mission}
        result={result}
        baselineResult={baselineResult}
        showBaseline={comparing}
        runToken={runToken}
        sites={sites}
        flares={flares}
        dayMode={dayMode}
        cameraPadding={{ top: 90, bottom: 110, left: 360, right: 120 }}
        onFlareClick={() => setMode("mission")}
        onFlareHover={(f) => setHoverFlare(f ? f.label : null)}
        onSiteClick={(s) => setStep(`clicked ${s.id}`)}
        onRunStep={(s) => setStep(s ? `hub #${s.order + 1} · line ${s.line ?? "?"}` : "")}
        onRunComplete={() => result?.ok && setShownMetrics(result)}
      />
      <div
        style={{
          position: "absolute", left: 16, top: 16, width: 320, padding: 16, borderRadius: 16,
          background: "rgba(16,22,42,0.78)", border: "1px solid rgba(242,245,255,0.14)", backdropFilter: "blur(8px)",
          color: "#F2F5FF", font: "16px 'Space Grotesk', system-ui, sans-serif", display: "flex", flexDirection: "column", gap: 10, zIndex: 3,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>Map harness</div>
        <div style={{ color: "#aeb8d6", fontSize: 14 }}>{source} · {fps} fps · {result?.residents.length ?? 0} dots</div>
        {m && base && (
          <CityMeter
            coverage={m.coverage}
            baselineCoverage={base.coverage}
            families={m.needCovered}
            target={mission.levels[0].goal.target}
            goalMet={!!shownMetrics?.goalMet}
            comparing={comparing}
          />
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={btn} onClick={() => run(3)}>Run 3</button>
          <button style={btn} onClick={() => run(5)}>Run 5 (R)</button>
          <button style={btn} onClick={() => run(8)}>Run 8</button>
          <button style={btn} onClick={() => run(3, true)}>Run error</button>
          <button style={{ ...btn, background: comparing ? "#FFC44D" : btn.background, color: comparing ? "#0B1020" : "#F2F5FF" }} {...buttonProps}>
            Compare (hold B)
          </button>
          <button style={btn} onClick={() => setDayMode((x) => !x)}>{dayMode ? "Night" : "Day"} (D)</button>
          <button style={btn} onClick={() => setMode((x) => (x === "home" ? "mission" : "home"))}>{mode === "home" ? "Mission" : "Home"} (H)</button>
          <button style={btn} onClick={reportProblem}>Report problem</button>
        </div>
        <div style={{ minHeight: 22, color: "#FFC44D" }}>{step || (hoverFlare ? `flare: ${hoverFlare}` : "")}</div>
      </div>
      {mode === "mission" && <Legend walkMinutes={mission.walkMinutes} dayMode={dayMode} />}
    </div>
  );
}

export default MapHarness;
