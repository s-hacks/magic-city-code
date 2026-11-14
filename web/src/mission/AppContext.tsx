// App-wide state shared by every screen: the city data, the ONE Python runner (started
// at app start so Pyodide is warm), day/night, missions fetched or generated this session
// (so AI-made missions open even though they are not in static files), and the proposal
// draft handed from the Mission screen to the Proposal screen.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CityData, FormerStore, Mission } from "@mcc/shared";
import { createPythonRunner, type PythonRunner, type RunnerStatus } from "../code/runner";
import { loadCityData } from "../map/dataLoader";
import { fetchMission, loadFormerStores } from "./api";
import { readStore, writeStore } from "./storage";
import { applyCssVars } from "../theme";

export interface ProposalDraft {
  mission: Mission;
  neighborhoodName: string;
  levelIndex: number;
  code: string;
  hubs: number;
  before: number;
  after: number;
  helped: number;
}

interface AppState {
  data: CityData | null;
  dataError: string | null;
  formerStores: FormerStore[];
  runner: PythonRunner;
  runnerStatus: RunnerStatus;
  dayMode: boolean;
  toggleDay(): void;
  registerMission(m: Mission): void;
  getMission(id: string): Promise<Mission | null>;
  draft: ProposalDraft | null;
  setDraft(d: ProposalDraft | null): void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [runner] = useState(() => createPythonRunner());
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus>({ state: "loading", message: "Waking up Python..." });
  const [data, setData] = useState<CityData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [formerStores, setFormerStores] = useState<FormerStore[]>([]);
  const [dayMode, setDayMode] = useState(() => readStore("mcc.day") === "1");
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  const missions = useRef(new Map<string, Mission>());

  useEffect(() => applyCssVars(dayMode ? "day" : "night"), [dayMode]);
  useEffect(() => runner.onStatus(setRunnerStatus), [runner]);
  useEffect(() => {
    runner.ready.catch(() => {}); // the status shows the problem
  }, [runner]);
  useEffect(() => {
    loadCityData().then(setData, (e) => setDataError(String(e?.message ?? e)));
    loadFormerStores().then(setFormerStores);
  }, []);

  const registerMission = useCallback((m: Mission) => void missions.current.set(m.id, m), []);
  const getMission = useCallback(async (id: string) => {
    const known = missions.current.get(id);
    if (known) return known;
    const m = await fetchMission(id);
    if (m) missions.current.set(id, m);
    return m;
  }, []);
  const toggleDay = useCallback(() => {
    setDayMode((d) => {
      writeStore("mcc.day", d ? "0" : "1");
      return !d;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({ data, dataError, formerStores, runner, runnerStatus, dayMode, toggleDay, registerMission, getMission, draft, setDraft }),
    [data, dataError, formerStores, runner, runnerStatus, dayMode, toggleDay, registerMission, getMission, draft],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
