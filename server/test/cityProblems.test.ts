// City problem routes over real HTTP on a random local port, with a temporary seed folder.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POINTS_CHOSEN, POINTS_VOTE, PROJECT_LIMITS, type CityProblem, type CityProblemSummary, type LeaderRow } from "@mcc/shared";
import { createApp } from "../src/app";
import { Store } from "../src/store";

process.env.AI_DISABLED = "1";

const write = (file: string, content: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
};

/** Two good sample problems, one with no problem.json, one that fails the schema. */
function makeSeedDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcc-city-"));
  write(path.join(dir, "index.json"), ["storm-drains", "missing-one", "broken", "water-bills"]);
  write(path.join(dir, "leaders.seed.json"), [
    { name: "Ada", school: "Ramsay High", points: 500, chosen: 1 },
    { name: "Zed", school: "Parker High", points: 40, chosen: 0 },
  ]);

  const storm = path.join(dir, "storm-drains");
  write(path.join(storm, "problem.json"), {
    title: "Which storm drains clog first?",
    postedBy: "Dana",
    posterKind: "Neighborhood group",
    neighborhood: "Ensley",
    summary: "Find the inlets to clean before the next storm.",
    details: "We have a year of flooding reports.",
    data: "A CSV of 311 flooding reports.",
    skills: ["csv", "sorting"],
    status: "Reviewing",
    reward: "Pizza for the class",
    due: "Dec 8",
    solutions: [
      {
        id: "s1",
        author: "Ada",
        school: "Ramsay High",
        approach: "Counted reports per inlet.",
        metric: "Top 10 inlets cover 64% of flooded homes",
        skills: ["csv"],
        votes: 5,
        projectDir: "solutions/s1",
        submitted: "2 days ago",
      },
      { id: "s2", author: "Zed", school: "Parker High", approach: "Mapped them.", metric: "8 hot spots", votes: 9 },
      { author: 42 }, // invalid: skipped
    ],
  });
  write(path.join(storm, "starter/README.md"), "# Storm drains\n");
  write(path.join(storm, "starter/main.py"), "def solve():\n    return None\n");
  write(path.join(storm, "starter/data/reports.csv"), "inlet,reports\nA,3\n");
  write(path.join(storm, "starter/.DS_Store"), "junk");
  fs.mkdirSync(path.join(storm, "starter/output"), { recursive: true });
  write(path.join(storm, "solutions/s1/main.py"), "def solve():\n    return ['A']\n");

  const broken = path.join(dir, "broken");
  write(path.join(broken, "problem.json"), { title: "No summary or neighborhood" });

  const water = path.join(dir, "water-bills");
  write(path.join(water, "problem.json"), {
    title: "Are water bills fair?",
    postedBy: "Lee",
    posterKind: "Resident",
    neighborhood: "West End",
    summary: "Compare bills across the block.",
    data: "Twelve months of bills.",
    skills: ["averages"],
    status: "Open",
    reward: "A thank-you letter",
    due: "Jan 3",
    solutions: [],
  });
  write(path.join(water, "starter/main.py"), "def solve():\n    return None\n");
  return dir;
}

let server: Server;
let base = "";
let seedDir = "";
let store: Store;

beforeAll(async () => {
  seedDir = makeSeedDir();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  store = new Store({ persistPath: null, cityProblemsDir: seedDir });
  server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(seedDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const send = (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const post = (p: string, body: unknown, headers?: Record<string, string>) => send("POST", p, body, headers);
const getJson = async <T>(p: string): Promise<T> => (await fetch(base + p)).json() as Promise<T>;

const newProblem = {
  title: "Where should the new benches go?",
  summary: "Call me at 205-555-1234 about benches near bus stops.",
  details: "My name is Maria Lopez and I live at 123 Main Street. We want benches.",
  neighborhood: "Woodlawn",
  posterKind: "Resident",
  postedBy: "Maria Lopez",
  skills: ["maps"],
  data: "A list of bus stops with riders per day.",
  files: [{ path: "uploads/stops.csv", content: "stop,riders\n1,40\n" }],
};

const goodSolution = {
  author: "Ben Carter",
  school: "Woodlawn High",
  approach: "Sorted stops by riders.",
  metric: "Top 5 stops serve 60% of riders",
  skills: ["sorting"],
  project: { files: [{ path: "main.py", content: "def solve():\n    return [1]\n" }], folders: ["notes"] },
  tests: { passed: 9, total: 3, results: Array.from({ length: 60 }, (_, i) => ({ name: `t${i}`, ok: true })) },
};

describe("city problems", () => {
  it("loads valid seeds in index order and skips the bad ones", async () => {
    const list = await getJson<CityProblemSummary[]>("/api/city-problems");
    expect(list.map((p) => p.id)).toEqual(["storm-drains", "water-bills"]);
    const storm = list[0] as CityProblemSummary & { starter?: unknown; solutions?: unknown };
    expect(storm.sample).toBe(true);
    expect(storm.solutionCount).toBe(2);
    expect(storm.starter).toBeUndefined();
    expect(storm.solutions).toBeUndefined();
    expect(list[0].createdAt > list[1].createdAt).toBe(true);
  });

  it("returns a full problem with its starter and sorted solutions, and 404s otherwise", async () => {
    const p = await getJson<CityProblem>("/api/city-problems/storm-drains");
    expect(p.starter.files.map((f) => f.path).sort()).toEqual(["README.md", "data/reports.csv", "main.py"]);
    expect(p.starter.folders).toEqual(["output"]);
    expect(p.solutions.map((s) => s.id)).toEqual(["s2", "s1"]); // more votes first
    expect(p.solutions[1].project?.files[0].path).toBe("main.py");
    expect(p.solutions[1].problemId).toBe("storm-drains");
    // A problem with no starter/ files gets a generated one.
    const water = await getJson<CityProblem>("/api/city-problems/water-bills");
    expect(water.starter.files.some((f) => f.path === "main.py")).toBe(true);
    expect((await fetch(base + "/api/city-problems/nope")).status).toBe(404);
  });

  it("posts a problem with a poster key and a starter project, scrubbed", async () => {
    const res = await post("/api/city-problems", newProblem);
    expect(res.status).toBe(201);
    const { problem, posterKey } = (await res.json()) as { problem: CityProblem; posterKey: string };
    expect(posterKey).toMatch(/^[0-9a-f]{36}$/);
    expect(JSON.stringify(problem)).not.toContain(posterKey);
    expect(problem.status).toBe("Open");
    expect(problem.postedBy).toBe("Maria");
    expect(problem.reward).toBe("Featured on the Magic City Code leaderboard");
    expect(problem.due).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    expect(problem.summary).not.toContain("555-1234");
    expect(problem.details).not.toContain("Lopez");
    expect(problem.details).not.toContain("123 Main Street");
    expect(problem.neighborhood).toBe("Woodlawn");

    const paths = problem.starter.files.map((f) => f.path);
    expect(paths).toEqual(["README.md", "main.py", "tests/test_main.py", "data/stops.csv"]);
    const file = (p: string) => problem.starter.files.find((f) => f.path === p)!.content;
    expect(file("README.md")).toContain("# Where should the new benches go?");
    expect(file("README.md")).toContain("A list of bus stops");
    expect(file("README.md")).toContain("How to run");
    expect(file("main.py")).toContain("def solve():");
    expect(file("main.py")).toContain("return None");
    expect(file("main.py")).toContain("data/stops.csv");
    expect(file("tests/test_main.py")).toContain("from main import solve");
    expect(file("tests/test_main.py")).toContain("def test_solve_returns_an_answer():");

    // Runtime problems come first in the list.
    const list = await getJson<CityProblemSummary[]>("/api/city-problems");
    expect(list[0].id).toBe(problem.id);
    expect(list[0].solutionCount).toBe(0);

    const bad = await post("/api/city-problems", { ...newProblem, files: [{ path: "../etc/passwd", content: "x" }] });
    expect(bad.status).toBe(400);
    const tooMany = Array.from({ length: PROJECT_LIMITS.maxFiles }, (_, i) => ({ path: `f${i}.csv`, content: "a" }));
    expect((await post("/api/city-problems", { ...newProblem, files: tooMany })).status).toBe(400);
    expect((await post("/api/city-problems", { ...newProblem, posterKind: "Alien" })).status).toBe(400);
  });

  it("checks submitted projects, moves Open to Reviewing, and lets the poster choose", async () => {
    const { problem, posterKey } = await (await post("/api/city-problems", newProblem)).json();
    const url = `/api/city-problems/${problem.id}`;

    const unsafe = { ...goodSolution, project: { files: [{ path: "../x.py", content: "print(1)" }] } };
    expect((await post(`${url}/solutions`, unsafe)).status).toBe(400);
    const tooMany = Array.from({ length: PROJECT_LIMITS.maxFiles + 1 }, (_, i) => ({ path: `f${i}.py`, content: "" }));
    expect((await post(`${url}/solutions`, { ...goodSolution, project: { files: tooMany } })).status).toBe(400);
    const big = "x".repeat(PROJECT_LIMITS.maxFileBytes + 1);
    expect((await post(`${url}/solutions`, { ...goodSolution, project: { files: [{ path: "a.py", content: big }] } })).status).toBe(400);
    const noPy = { ...goodSolution, project: { files: [{ path: "notes.txt", content: "hi" }] } };
    expect((await post(`${url}/solutions`, noPy)).status).toBe(400);
    const badFolder = { ...goodSolution, project: { ...goodSolution.project, folders: ["/abs"] } };
    expect((await post(`${url}/solutions`, badFolder)).status).toBe(400);
    expect((await getJson<CityProblem>(url)).status).toBe("Open");

    const res = await post(`${url}/solutions`, {
      ...goodSolution,
      project: { files: [{ path: "main.py", content: "# Ben, 205-555-9876\ndef solve():\n    return [1]\n" }] },
    });
    expect(res.status).toBe(201);
    const sol = await res.json();
    expect(sol.author).toBe("Ben");
    expect(sol.votes).toBe(0);
    expect(sol.problemId).toBe(problem.id);
    expect(sol.project.files[0].content).not.toContain("555-9876");
    expect(sol.tests.passed).toBe(3); // clamped to total
    expect(sol.tests.results).toHaveLength(50);
    expect((await getJson<CityProblem>(url)).status).toBe("Reviewing");

    // Review rights: only the poster's key.
    expect(await getJson(`${url}/review`)).toEqual({ canReview: false });
    const review = await fetch(`${base}${url}/review`, { headers: { "x-poster-key": posterKey } });
    expect(await review.json()).toEqual({ canReview: true });

    const wrong = await post(`${url}/solutions/${sol.id}/choose`, {}, { "x-poster-key": "0".repeat(36) });
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).error).toBeTruthy();
    expect((await post(`${url}/solutions/${sol.id}/choose`, {})).status).toBe(403);
    expect((await post(`${url}/solutions/nope/choose`, {}, { "x-poster-key": posterKey })).status).toBe(404);

    const chosen = await post(`${url}/solutions/${sol.id}/choose`, {}, { "x-poster-key": posterKey });
    expect(chosen.status).toBe(200);
    const updated = (await chosen.json()) as CityProblem;
    expect(updated.status).toBe("Solved");
    expect(updated.solutions[0]).toMatchObject({ id: sol.id, chosen: true });

    expect((await post(`${url}/solutions`, goodSolution)).status).toBe(409);
  });

  it("counts one vote per voter per solution", async () => {
    const url = "/api/city-problems/storm-drains/solutions/s1/vote";
    expect((await post(url, { voterId: "short" })).status).toBe(400);
    const first = await (await post(url, { voterId: "voter-aaaa" })).json();
    expect(first).toEqual({ votes: 6 });
    const again = await (await post(url, { voterId: "voter-aaaa" })).json();
    expect(again).toEqual({ votes: 6 });
    const other = await (await post(url, { voterId: "voter-bbbb" })).json();
    expect(other).toEqual({ votes: 7 });
    expect((await post("/api/city-problems/storm-drains/solutions/nope/vote", { voterId: "voter-aaaa" })).status).toBe(404);
  });

  it("lets this computer choose on a sample problem, but not a forwarded request", async () => {
    const url = "/api/city-problems/storm-drains/solutions/s1/choose";
    expect((await post(url, {}, { "x-forwarded-for": "10.0.0.5" })).status).toBe(403);
    const review = await fetch(`${base}/api/city-problems/storm-drains/review`);
    expect(await review.json()).toEqual({ canReview: true });
    const res = await post(url, {});
    expect(res.status).toBe(200);
    const p = (await res.json()) as CityProblem;
    expect(p.status).toBe("Solved");
    expect(p.solutions.map((s) => [s.id, !!s.chosen])).toEqual([
      ["s1", true],
      ["s2", false],
    ]);
  });

  it("adds up the leaderboard", async () => {
    const rows = await getJson<LeaderRow[]>("/api/leaderboard");
    const ada = rows.find((r) => r.name === "Ada")!;
    // Carried over 500 + chosen s1 + 7 votes on s1.
    expect(ada).toEqual({ name: "Ada", school: "Ramsay High", points: 500 + POINTS_CHOSEN + 7 * POINTS_VOTE, chosen: 2 });
    const zed = rows.find((r) => r.name === "Zed")!;
    expect(zed.points).toBe(40 + 9 * POINTS_VOTE);
    const ben = rows.find((r) => r.name === "Ben")!;
    expect(ben).toEqual({ name: "Ben", school: "Woodlawn High", points: POINTS_CHOSEN, chosen: 1 });
    expect(rows[0].name).toBe("Ada");
    expect(rows.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].points).toBeGreaterThanOrEqual(rows[i].points);
  });

  it("reset goes back to the seed state", async () => {
    const res = await post("/api/admin/reset", {});
    expect(res.status).toBe(200);
    expect((await res.json()).cityProblems).toBe(2);
    const list = await getJson<CityProblemSummary[]>("/api/city-problems");
    expect(list.map((p) => p.id)).toEqual(["storm-drains", "water-bills"]);
    const storm = await getJson<CityProblem>("/api/city-problems/storm-drains");
    expect(storm.status).toBe("Reviewing");
    expect(storm.solutions.find((s) => s.id === "s1")).toMatchObject({ votes: 5 });
    expect(storm.solutions.some((s) => s.chosen)).toBe(false);
    // Votes were forgotten too, so the same voter can vote again.
    expect(await (await post("/api/city-problems/storm-drains/solutions/s1/vote", { voterId: "voter-aaaa" })).json()).toEqual({ votes: 6 });
    const rows = await getJson<LeaderRow[]>("/api/leaderboard");
    expect(rows.find((r) => r.name === "Ben")).toBeUndefined();
  });

  it("saves runtime state and a changed sample problem, and they win over the seeds on reload", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mcc-store-")), "store.json");
    const a = new Store({ persistPath: file, cityProblemsDir: seedDir });
    a.voteCitySolution("water-bills", "none", "voter-xxxx"); // no such solution: nothing changes
    const storm = a.getCityProblem("storm-drains")!;
    a.addCitySolution("storm-drains", { ...storm.solutions[0], id: "s9", votes: 0, createdAt: new Date().toISOString() });
    a.voteCitySolution("storm-drains", "s9", "voter-xxxx");
    await new Promise((r) => setTimeout(r, 300));
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(saved.cityProblems.map((p: CityProblem) => p.id)).toEqual(["storm-drains"]);

    const b = new Store({ persistPath: file, cityProblemsDir: seedDir });
    expect(b.getCityProblem("storm-drains")!.solutions.find((s) => s.id === "s9")?.votes).toBe(1);
    expect(b.voteCitySolution("storm-drains", "s9", "voter-xxxx")).toBe(1); // voter remembered
    expect(b.listCityProblems().map((p) => p.id)).toEqual(["storm-drains", "water-bills"]);
    b.reset();
    expect(fs.existsSync(file)).toBe(false);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it("starts with no city problems when the seed folder is missing", () => {
    const s = new Store({ persistPath: null, cityProblemsDir: path.join(seedDir, "does-not-exist") });
    expect(s.listCityProblems()).toEqual([]);
    expect(s.leaderboard()).toEqual([]);
  });
});
