// City problems: loading the sample problems from disk, building a starter project for a
// newly posted problem, and the leaderboard math. The Store keeps the state; app.ts has the routes.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  isSafePath,
  POINTS_CHOSEN,
  POINTS_VOTE,
  PROJECT_LIMITS,
  type CityProblem,
  type CityProblemSummary,
  type CitySolution,
  type LeaderRow,
  type Project,
  type ProjectFile,
} from "@mcc/shared";

export const POSTER_KINDS = ["Resident", "Neighborhood group", "Nonprofit", "City department"] as const;
export const DEFAULT_REWARD = "Featured on the Magic City Code leaderboard";

/** Seeds are dated before any runtime problem: seed i is SEED_EPOCH minus i days. */
const SEED_EPOCH = Date.parse("2025-01-01T12:00:00.000Z");
const DAY = 86_400_000;

// --- seed files -----------------------------------------------------------------------------

const SeedSolution = z.object({
  id: z.string().min(1).optional(),
  author: z.string().min(1),
  school: z.string().default(""),
  approach: z.string().default(""),
  metric: z.string().default(""),
  skills: z.array(z.string()).default([]),
  votes: z.number().int().min(0).default(0),
  chosen: z.boolean().optional(),
  tests: z
    .object({
      passed: z.number(),
      total: z.number(),
      results: z.array(z.object({ name: z.string(), ok: z.boolean(), message: z.string().optional() })),
    })
    .optional(),
  projectDir: z.string().optional(),
  submitted: z.string().optional(), // display text only; createdAt is derived instead
});

const SeedProblem = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  postedBy: z.string().min(1),
  posterKind: z.enum(POSTER_KINDS).default("Resident"),
  neighborhood: z.string().min(1),
  summary: z.string().min(1),
  details: z.string().optional(),
  data: z.string().default(""),
  skills: z.array(z.string()).default([]),
  status: z.enum(["Open", "Reviewing", "Solved"]).default("Open"),
  reward: z.string().default(DEFAULT_REWARD),
  due: z.string().default(""),
  solutions: z.array(z.unknown()).default([]),
});

const SeedLeader = z.object({
  name: z.string().min(1),
  school: z.string().default(""),
  points: z.number().min(0).default(0),
  chosen: z.number().int().min(0).default(0),
});

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** Every file under a folder as a Project (utf-8, "/" paths). Dotfiles and __pycache__ are skipped. */
export function readProjectDir(dir: string): Project | null {
  let rootStat: fs.Stats;
  try {
    rootStat = fs.statSync(dir);
  } catch {
    return null;
  }
  if (!rootStat.isDirectory()) return null;
  const files: ProjectFile[] = [];
  const folders: string[] = [];
  const walk = (abs: string, rel: string): number => {
    let count = 0;
    const entries = fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "__pycache__") continue;
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (!isSafePath(relPath)) {
        console.warn(`[city-problems] skipped unsafe seed path ${relPath} in ${dir}`);
        continue;
      }
      if (e.isDirectory()) {
        const inside = walk(path.join(abs, e.name), relPath);
        if (inside === 0) folders.push(relPath);
        count += 1;
      } else if (e.isFile()) {
        files.push({ path: relPath, content: fs.readFileSync(path.join(abs, e.name), "utf8") });
        count += 1;
      }
    }
    return count;
  };
  walk(dir, "");
  const project: Project = { files };
  if (folders.length) project.folders = folders;
  return project;
}

export interface CitySeed {
  problems: CityProblem[]; // in index order
  leaders: LeaderRow[];
}

/** Load the sample problems. Anything missing or invalid is skipped with a warning. */
export function loadCitySeed(dir: string): CitySeed {
  const leaders = loadSeedLeaders(path.join(dir, "leaders.seed.json"));
  const index = readJson(path.join(dir, "index.json"));
  if (index === undefined) {
    console.warn(`[city-problems] no index.json in ${dir}; no sample problems loaded`);
    return { problems: [], leaders };
  }
  if (!Array.isArray(index)) {
    console.warn(`[city-problems] index.json in ${dir} is not an array; no sample problems loaded`);
    return { problems: [], leaders };
  }
  const problems: CityProblem[] = [];
  const seen = new Set<string>();
  for (const id of index) {
    if (typeof id !== "string" || !isSafePath(id) || id.includes("/") || seen.has(id)) {
      console.warn(`[city-problems] skipped bad id in index.json: ${JSON.stringify(id)}`);
      continue;
    }
    seen.add(id);
    const p = loadSeedProblem(dir, id, problems.length);
    if (p) problems.push(p);
  }
  return { problems, leaders };
}

function loadSeedProblem(dir: string, id: string, order: number): CityProblem | null {
  const problemDir = path.join(dir, id);
  const raw = readJson(path.join(problemDir, "problem.json"));
  if (raw === undefined) {
    console.warn(`[city-problems] skipped ${id}: problem.json is missing or not valid JSON`);
    return null;
  }
  const parsed = SeedProblem.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.warn(`[city-problems] skipped ${id}: ${issue ? `${issue.path.join(".")}: ${issue.message}` : "invalid"}`);
    return null;
  }
  const p = parsed.data;
  if (p.id && p.id !== id) console.warn(`[city-problems] ${id}/problem.json says id "${p.id}"; using the folder id`);
  const createdAt = new Date(SEED_EPOCH - order * DAY).toISOString();

  const base = {
    id,
    title: p.title,
    postedBy: p.postedBy,
    posterKind: p.posterKind,
    neighborhood: p.neighborhood,
    summary: p.summary,
    details: p.details ?? p.summary,
    data: p.data,
    skills: p.skills,
    status: p.status,
    reward: p.reward,
    due: p.due,
  };

  let starter = readProjectDir(path.join(problemDir, "starter"));
  if (!starter || starter.files.length === 0) {
    console.warn(`[city-problems] ${id} has no starter/ files; using a generated starter`);
    starter = buildStarter({ ...base, files: [] });
  }

  const solutions: CitySolution[] = [];
  const solutionIds = new Set<string>();
  p.solutions.forEach((rawSol, j) => {
    const s = SeedSolution.safeParse(rawSol);
    if (!s.success) {
      console.warn(`[city-problems] skipped solution ${j + 1} of ${id}: ${s.error.issues[0]?.message ?? "invalid"}`);
      return;
    }
    const sid = s.data.id ?? `${id}-s${j + 1}`;
    if (solutionIds.has(sid)) {
      console.warn(`[city-problems] skipped duplicate solution id ${sid} in ${id}`);
      return;
    }
    solutionIds.add(sid);
    const sol: CitySolution = {
      id: sid,
      problemId: id,
      author: s.data.author,
      school: s.data.school,
      approach: s.data.approach,
      metric: s.data.metric,
      skills: s.data.skills,
      votes: s.data.votes,
      createdAt: new Date(SEED_EPOCH - order * DAY + (j + 1) * 3_600_000).toISOString(),
    };
    if (s.data.chosen) sol.chosen = true;
    if (s.data.tests) sol.tests = clampTests(s.data.tests);
    if (s.data.projectDir) {
      const project = isSafePath(s.data.projectDir) ? readProjectDir(path.join(problemDir, s.data.projectDir)) : null;
      if (project) sol.project = project;
      else console.warn(`[city-problems] solution ${sid} of ${id}: projectDir ${s.data.projectDir} not found; no project`);
    }
    solutions.push(sol);
  });

  return { ...base, starter, solutions, sample: true, createdAt };
}

function loadSeedLeaders(file: string): LeaderRow[] {
  const raw = readJson(file);
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    console.warn(`[city-problems] leaders.seed.json is not an array; ignored`);
    return [];
  }
  const out: LeaderRow[] = [];
  raw.forEach((r, i) => {
    const parsed = SeedLeader.safeParse(r);
    if (parsed.success) out.push(parsed.data);
    else console.warn(`[city-problems] skipped leader ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  });
  return out;
}

// --- posting a problem ----------------------------------------------------------------------

export interface StarterInput {
  title: string;
  details: string;
  data: string;
  /** Already checked and scrubbed; saved under data/<basename>. */
  files: ProjectFile[];
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** README.md, main.py, tests/test_main.py and the poster's data files under data/. */
export function buildStarter(input: StarterInput): Project {
  const dataFiles = input.files.map((f) => ({ path: `data/${basename(f.path)}`, content: f.content }));
  const firstCsv = dataFiles.find((f) => f.path.toLowerCase().endsWith(".csv"))?.path ?? "data/your_file.csv";
  const fileList = dataFiles.length
    ? dataFiles.map((f) => `- \`${f.path}\``).join("\n")
    : "No data files were attached yet. Add your own under `data/`.";

  const readme = [
    `# ${oneLine(input.title)}`,
    "",
    input.details.trim(),
    "",
    "## The data",
    "",
    input.data.trim() || "The poster did not describe any data.",
    "",
    fileList,
    "",
    "## How to run",
    "",
    "- **Run** executes `main.py`.",
    "- **Run tests** runs every `tests/test_*.py` file.",
    "",
    "Write your answer in `solve()` in `main.py`, then explain your approach when you submit.",
    "",
  ].join("\n");

  const mainPy = [
    `# ${oneLine(input.title)}`,
    "# Write your answer in solve(). Run executes this file; Run tests checks it.",
    "import csv",
    "",
    "",
    "def solve():",
    "    # Load a file from data/ with the csv module, like this:",
    `    #     with open("${firstCsv}") as f:`,
    "    #         rows = list(csv.DictReader(f))",
    "    # Then work out the answer and return it.",
    "    return None",
    "",
    "",
    'if __name__ == "__main__":',
    "    print(solve())",
    "",
  ].join("\n");

  const testPy = [
    "from main import solve",
    "",
    "",
    "def test_solve_returns_an_answer():",
    "    assert solve() is not None",
    "",
  ].join("\n");

  const files: ProjectFile[] = [
    { path: "README.md", content: readme },
    { path: "main.py", content: mainPy },
    { path: "tests/test_main.py", content: testPy },
    ...dataFiles,
  ];
  const project: Project = { files, entry: "main.py" };
  if (!dataFiles.length) project.folders = ["data"];
  return project;
}

export function basename(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] ?? p;
}

/** "Dec 5": a display date `days` from now. */
export function dueIn(days: number, now = new Date()): string {
  const d = new Date(now.getTime() + days * DAY);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// --- checks shared by the routes --------------------------------------------------------------

/** null if the files fit PROJECT_LIMITS and every path is safe, else the reason. */
export function checkFiles(files: ProjectFile[], folders: string[] = [], reserved = 0): string | null {
  if (files.length + reserved > PROJECT_LIMITS.maxFiles) return `too many files (max ${PROJECT_LIMITS.maxFiles - reserved})`;
  if (folders.length > PROJECT_LIMITS.maxFiles) return `too many folders (max ${PROJECT_LIMITS.maxFiles})`;
  let total = 0;
  const seen = new Set<string>();
  for (const f of files) {
    if (!isSafePath(f.path)) return `unsafe file path: ${JSON.stringify(f.path.slice(0, PROJECT_LIMITS.maxPathLength))}`;
    if (seen.has(f.path)) return `two files with the same path: ${f.path}`;
    seen.add(f.path);
    const bytes = Buffer.byteLength(f.content, "utf8");
    if (bytes > PROJECT_LIMITS.maxFileBytes) return `${f.path} is too big (max ${PROJECT_LIMITS.maxFileBytes} bytes)`;
    total += bytes;
  }
  if (total > PROJECT_LIMITS.maxProjectBytes) return `project is too big (max ${PROJECT_LIMITS.maxProjectBytes} bytes)`;
  for (const d of folders) if (!isSafePath(d)) return `unsafe folder path: ${JSON.stringify(d.slice(0, PROJECT_LIMITS.maxPathLength))}`;
  return null;
}

const clampInt = (n: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : 0);

/** Test results come from the browser: keep them, but bounded. */
export function clampTests(t: { passed: number; total: number; results: { name: string; ok: boolean; message?: string }[] }) {
  const results = t.results.slice(0, 50).map((r) => ({
    name: String(r.name).slice(0, 200),
    ok: Boolean(r.ok),
    ...(r.message !== undefined ? { message: String(r.message).slice(0, 1000) } : {}),
  }));
  const total = clampInt(t.total, 10_000);
  return { passed: Math.min(clampInt(t.passed, 10_000), total), total, results };
}

// --- poster keys -----------------------------------------------------------------------------

export function newPosterKey(): string {
  return crypto.randomBytes(18).toString("hex");
}
export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}
/** Constant-time check of a key against a stored sha256 hex hash. */
export function keyMatches(key: string | undefined, storedHash: string | undefined): boolean {
  if (!key || !storedHash) return false;
  const a = Buffer.from(hashKey(key), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- views -----------------------------------------------------------------------------------

/** Chosen first, then most votes, then oldest. */
export function sortSolutions(list: CitySolution[]): CitySolution[] {
  return [...list].sort(
    (a, b) => Number(!!b.chosen) - Number(!!a.chosen) || b.votes - a.votes || a.createdAt.localeCompare(b.createdAt),
  );
}

export function withSortedSolutions(p: CityProblem): CityProblem {
  return { ...p, solutions: sortSolutions(p.solutions) };
}

export function summarize(p: CityProblem): CityProblemSummary {
  const { starter: _s, solutions, ...rest } = p;
  return { ...rest, solutionCount: solutions.length };
}

/** Carried-over points + POINTS_CHOSEN per chosen solution + POINTS_VOTE per vote, by author+school. */
export function computeLeaderboard(seedLeaders: LeaderRow[], problems: CityProblem[], limit = 10): LeaderRow[] {
  const rows = new Map<string, LeaderRow>();
  const row = (name: string, school: string) => {
    const key = `${name.trim().toLowerCase()}|${school.trim().toLowerCase()}`;
    let r = rows.get(key);
    if (!r) {
      r = { name: name.trim(), school: school.trim(), points: 0, chosen: 0 };
      rows.set(key, r);
    }
    return r;
  };
  for (const l of seedLeaders) {
    const r = row(l.name, l.school);
    r.points += l.points;
    r.chosen += l.chosen;
  }
  for (const p of problems) {
    for (const s of p.solutions) {
      const r = row(s.author, s.school);
      r.points += s.votes * POINTS_VOTE;
      if (s.chosen) {
        r.points += POINTS_CHOSEN;
        r.chosen += 1;
      }
    }
  }
  return [...rows.values()]
    .sort((a, b) => b.points - a.points || b.chosen - a.chosen || a.name.localeCompare(b.name))
    .slice(0, limit);
}
