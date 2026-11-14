// The app's memory: problem cards, missions and student proposals.
// It starts from the seed files in web/public/data and, if asked, saves itself to
// server/data/store.json so a restart keeps what was added during the demo.
import fs from "node:fs";
import path from "node:path";
import { MissionSchema, type Mission, type ProblemCard, type Proposal } from "@mcc/shared";
import { readJsonFile } from "./city";
import { MISSIONS_DIR, PROBLEMS_SEED_FILE } from "./paths";

interface Snapshot {
  problems: ProblemCard[];
  missions: Mission[];
  proposals: Proposal[];
  /** missionId -> the problem card it was made from (linked on approval). */
  missionProblems?: Record<string, string>;
}

export interface StoreOptions {
  /** File to save to and load from. null = memory only. */
  persistPath?: string | null;
  missionsDir?: string;
  problemsSeedFile?: string;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Seed missions from web/public/data/missions/*.json. Files that fail the schema are skipped. */
export function loadSeedMissions(dir: string = MISSIONS_DIR): Mission[] {
  let files: string[] = [];
  try {
    // index.json is the web app's list of mission ids, not a mission.
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
  } catch {
    return [];
  }
  const out: Mission[] = [];
  for (const f of files) {
    const raw = readJsonFile<unknown>(path.join(dir, f));
    const list = Array.isArray(raw) ? raw : [raw];
    for (const item of list) {
      const parsed = MissionSchema.safeParse(item);
      if (parsed.success) out.push(parsed.data);
      else console.warn(`[store] skipped seed mission ${f}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    }
  }
  return out;
}

/** problems.seed.json may hold full cards or just { text, neighborhood }. Fill in the rest. */
function loadSeedProblems(file: string): ProblemCard[] {
  const raw = readJsonFile<unknown>(file);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string")
    .map((p, i) => ({
      id: typeof p.id === "string" ? p.id : `seed_problem_${i + 1}`,
      text: p.text as string,
      neighborhood: typeof p.neighborhood === "string" ? p.neighborhood : null,
      status: p.status === "mission" || p.status === "needs_new_type" ? p.status : "new",
      ...(typeof p.missionId === "string" ? { missionId: p.missionId } : {}),
      createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(0).toISOString(),
    }));
}

export class Store {
  private problems = new Map<string, ProblemCard>();
  private missions = new Map<string, Mission>();
  private proposals = new Map<string, Proposal>();
  private seedMissionIds = new Set<string>();
  private missionProblems = new Map<string, string>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private opts: StoreOptions = {}) {
    this.load();
  }

  /** Fill the store from the seed files, plus the saved file if there is one. */
  private load() {
    const opts = this.opts;
    this.problems.clear();
    this.missions.clear();
    this.proposals.clear();
    this.seedMissionIds.clear();
    this.missionProblems.clear();
    const seeds = loadSeedMissions(opts.missionsDir);
    for (const m of seeds) {
      this.missions.set(m.id, m);
      this.seedMissionIds.add(m.id);
    }
    const saved = opts.persistPath ? readJsonFile<Snapshot>(opts.persistPath) : null;
    if (saved) {
      for (const p of saved.problems ?? []) this.problems.set(p.id, p);
      for (const m of saved.missions ?? []) if (!this.seedMissionIds.has(m.id)) this.missions.set(m.id, m);
      for (const p of saved.proposals ?? []) this.proposals.set(p.id, p);
      for (const [m, p] of Object.entries(saved.missionProblems ?? {})) this.missionProblems.set(m, p);
    }
    // Seed problems are always present, even after a saved store is loaded.
    for (const p of loadSeedProblems(opts.problemsSeedFile ?? PROBLEMS_SEED_FILE)) {
      if (!this.problems.has(p.id)) this.problems.set(p.id, p);
    }
  }

  seedMissions(): Mission[] {
    return [...this.missions.values()].filter((m) => this.seedMissionIds.has(m.id));
  }

  listProblems(): ProblemCard[] {
    return [...this.problems.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  saveProblem(card: ProblemCard): ProblemCard {
    this.problems.set(card.id, card);
    this.scheduleSave();
    return card;
  }

  listMissions(): Mission[] {
    return [...this.missions.values()];
  }
  getMission(id: string): Mission | undefined {
    return this.missions.get(id);
  }
  saveMission(m: Mission): Mission {
    this.missions.set(m.id, m);
    this.scheduleSave();
    return m;
  }
  /** Remember which problem card a not-yet-approved mission came from. */
  linkMissionToProblem(missionId: string, problemId: string) {
    this.missionProblems.set(missionId, problemId);
    this.scheduleSave();
  }

  /** Approve a mission. Only now does its problem card point at it and say "mission". */
  approveMission(id: string): Mission | undefined {
    const m = this.missions.get(id);
    if (!m) return undefined;
    const approved = { ...m, approved: true };
    this.missions.set(id, approved);
    const problemId = this.missionProblems.get(id);
    const card = problemId ? this.problems.get(problemId) : undefined;
    if (card) this.problems.set(card.id, { ...card, status: "mission", missionId: id });
    this.scheduleSave();
    return approved;
  }

  /** Back to the seed state: drops everything added at runtime and deletes the saved file. */
  reset() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.opts.persistPath) fs.rmSync(this.opts.persistPath, { force: true });
    const persist = this.opts.persistPath;
    this.opts = { ...this.opts, persistPath: null }; // load seeds only
    this.load();
    this.opts = { ...this.opts, persistPath: persist };
  }

  listProposals(): Proposal[] {
    return [...this.proposals.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  getProposal(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }
  saveProposal(p: Proposal): Proposal {
    this.proposals.set(p.id, p);
    this.scheduleSave();
    return p;
  }

  /** Write to disk a moment after the last change (seed missions are not copied). */
  private scheduleSave() {
    const file = this.opts.persistPath;
    if (!file) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const snapshot: Snapshot = {
        problems: this.listProblems(),
        missions: this.listMissions().filter((m) => !this.seedMissionIds.has(m.id)),
        proposals: this.listProposals(),
        missionProblems: Object.fromEntries(this.missionProblems),
      };
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
      } catch (err) {
        console.warn("[store] could not save:", (err as Error).message);
      }
    }, 200);
    this.saveTimer.unref?.();
  }
}
