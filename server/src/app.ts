// The Express app and all routes. index.ts starts it; tests can build one without listening.
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
  challengeCoachInfo,
  isSafePath,
  MissionSchema,
  PROJECT_LIMITS,
  type CityProblem,
  type CitySolution,
  type PostCityProblemResponse,
  type Proposal,
} from "@mcc/shared";
import { loadCity, neighborhoodList } from "./city";
import {
  basename,
  buildStarter,
  checkFiles,
  clampTests,
  DEFAULT_REWARD,
  dueIn,
  hashKey,
  keyMatches,
  newPosterKey,
  POSTER_KINDS,
  summarize,
  withSortedSolutions,
} from "./cityProblems";
import { runChallengeCoach } from "./challengeCoach";
import { runCoach } from "./coach";
import type { CoachMission } from "./prompts/coach";
import { aiEnabled } from "./config";
import { generateMission, MAX_PROBLEM_CHARS } from "./generator";
import { scrub, scrubCode } from "./scrub";
import { newId, type Store } from "./store";

const ProblemBody = z.object({
  text: z.string().trim().min(1).max(MAX_PROBLEM_CHARS),
  neighborhood: z.string().nullish(),
});

// A browser-sent mission has no solutions; check everything else with the shared schema.
const PublicMissionSchema = MissionSchema.extend({
  levels: z.array(MissionSchema.shape.levels.element.omit({ solution: true })).min(1),
});

const CoachBody = z.object({
  missionId: z.string().min(1),
  mission: z.unknown().optional(),
  levelIndex: z.number().int().min(0).default(0),
  code: z.string().max(20000).default(""),
  lastError: z.string().max(4000).optional(),
  lastCoverage: z.number().min(0).max(1).optional(),
  question: z.string().max(1000).optional(),
  hintsGiven: z.number().int().min(0).default(0),
});

const ChallengeCoachBody = z.object({
  action: z.enum(["hint", "explain-failure", "review", "concept", "chat"]).default("chat"),
  code: z.string().max(20000).default(""),
  question: z.string().max(1000).optional(),
  verdict: z
    .object({
      ok: z.boolean(),
      title: z.string().max(300),
      detail: z.string().max(2000),
      line: z.number().int().min(0).optional(),
      testName: z.string().max(200).optional(),
    })
    .optional(),
  flood: z.boolean().optional(),
  history: z.array(z.object({ role: z.enum(["student", "coach"]), text: z.string().max(4000) })).max(20).default([]),
  hintsGiven: z.number().int().min(0).default(0),
});

const ProposalBody = z.object({
  studentName: z.string().trim().min(1).max(40),
  missionId: z.string().min(1),
  missionTitle: z.string().max(200),
  partner: z.string().max(200),
  neighborhood: z.string().max(100),
  levelIndex: z.number().int().min(0),
  code: z.string().max(20000),
  before: z.number().min(0).max(1),
  after: z.number().min(0).max(1),
  helped: z.number(),
  summary: z.string().max(2000),
  thing: z.string().max(80).optional(),
  hubs: z.number().int().min(0).max(50).optional(),
});

// --- City problems -----------------------------------------------------------------------------

const FileBody = z.object({
  path: z.string().max(PROJECT_LIMITS.maxPathLength * 2),
  content: z.string(),
});
const Skills = z.array(z.string().trim().min(1).max(40)).max(12).default([]);

const PostCityProblemBody = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(400),
  details: z.string().trim().max(5000).optional(),
  neighborhood: z.string().trim().min(1).max(80),
  posterKind: z.enum(POSTER_KINDS),
  postedBy: z.string().trim().min(1).max(80),
  skills: Skills,
  data: z.string().trim().max(3000).optional(),
  // Counted against the limits after parsing, so the error says why.
  files: z.array(FileBody).max(PROJECT_LIMITS.maxFiles * 4).default([]),
});

const TestsBody = z.object({
  passed: z.number(),
  total: z.number(),
  results: z.array(z.object({ name: z.string(), ok: z.boolean(), message: z.string().optional() })).max(1000),
});

const SubmitSolutionBody = z.object({
  author: z.string().trim().min(1).max(80),
  school: z.string().trim().max(120).default(""),
  approach: z.string().trim().min(1).max(8000),
  metric: z.string().trim().min(1).max(300),
  skills: Skills,
  project: z.object({
    files: z.array(FileBody).max(PROJECT_LIMITS.maxFiles * 4),
    folders: z.array(z.string().max(PROJECT_LIMITS.maxPathLength * 2)).max(PROJECT_LIMITS.maxFiles * 4).optional(),
    entry: z.string().max(PROJECT_LIMITS.maxPathLength * 2).optional(),
  }),
  tests: TestsBody.optional(),
});

const VoteBody = z.object({ voterId: z.string().min(8).max(64) });

/** First word only, at most 20 characters. */
const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").slice(0, 20);

/** True for requests from this machine (the server only listens on 127.0.0.1 anyway). */
function fromLocalhost(req: Request): boolean {
  const ip = req.socket.remoteAddress ?? "";
  const local = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  // A proxy (like Vite's) adds X-Forwarded-For when it forwards someone else's request.
  const fwd = String(req.headers["x-forwarded-for"] ?? "");
  const fwdLocal = !fwd || fwd.split(",").every((a) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(a.trim()));
  return local && fwdLocal;
}

function bad(res: Response, error: z.ZodError | string) {
  const message = typeof error === "string" ? error : error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  res.status(400).json({ error: message });
}

export function createApp(store: Store) {
  const app = express();
  // No CORS: the web app reaches /api through Vite's proxy, so it is same-origin.
  // 2 MB: a project may hold up to PROJECT_LIMITS.maxProjectBytes of files, plus JSON escaping.
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ai: aiEnabled() });
  });

  // --- Problem board -------------------------------------------------------------------------
  app.get("/api/problems", (_req, res) => {
    res.json(store.listProblems());
  });

  app.post("/api/problems", (req, res) => {
    const body = ProblemBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    const hoods = neighborhoodList(loadCity());
    const card = store.saveProblem({
      id: newId("problem"),
      text: scrub(body.data.text, { keepWords: hoods.map((n) => n.name) }),
      neighborhood: hoods.some((n) => n.id === body.data.neighborhood) ? body.data.neighborhood! : null,
      status: "new",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(card);
  });

  // --- Missions ------------------------------------------------------------------------------
  app.post("/api/missions/generate", async (req, res) => {
    const body = ProblemBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    try {
      const outcome = await generateMission({ text: body.data.text, neighborhood: body.data.neighborhood ?? undefined }, { store });
      console.log(
        `[generate] ${outcome.response.status} via ${outcome.usedAI ? "ai" : "fallback"} (${outcome.attempts} Claude call(s))` +
          (outcome.notes.length ? ` — ${outcome.notes.join(" | ")}` : ""),
      );
      res.json(outcome.response);
    } catch (err) {
      console.error("[generate] unexpected error:", (err as Error).message);
      res.status(500).json({ error: "Could not make a mission right now." });
    }
  });

  // Students only ever see missions an adult has approved.
  app.get("/api/missions", (_req, res) => {
    res.json(store.listMissions().filter((m) => m.approved));
  });

  // ?preview=1 lets the Report screen show a mission before it is approved.
  app.get("/api/missions/:id", (req, res) => {
    const m = store.getMission(req.params.id);
    if (!m) return res.status(404).json({ error: "No mission with that id." });
    if (!m.approved && req.query.preview !== "1") return res.status(403).json({ error: "not approved" });
    res.json(m);
  });

  app.post("/api/missions/:id/approve", (req, res) => {
    const m = store.approveMission(req.params.id);
    if (!m) return res.status(404).json({ error: "No mission with that id." });
    res.json(m);
  });

  // --- Coach (streamed plain text) -----------------------------------------------------------
  app.post("/api/coach", async (req: Request, res: Response) => {
    const body = CoachBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    // Always use the server's own copy (it has the solutions the leak guard needs).
    // The browser's copy is only for a mission the server doesn't know, and has no solutions.
    let mission: CoachMission | undefined = store.getMission(body.data.missionId);
    if (!mission) {
      const parsed = PublicMissionSchema.safeParse(body.data.mission);
      if (!parsed.success) return res.status(404).json({ error: "No mission with that id." });
      mission = parsed.data;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    const { missionId: _id, mission: _sent, ...coachReq } = body.data;
    const result = await runCoach(coachReq, mission, (chunk) => res.write(chunk), { signal: abort.signal });
    if (result.note) console.log(`[coach] ${result.source}: ${result.note}`);
    res.end();
  });

  // --- Challenge coach (streamed plain text) ---------------------------------------------------
  app.post("/api/challenges/:id/coach", async (req: Request, res: Response) => {
    const info = challengeCoachInfo[req.params.id];
    if (!info) return res.status(404).json({ error: "No challenge with that id." });
    const body = ChallengeCoachBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);

    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    const result = await runChallengeCoach(info, body.data, (chunk) => res.write(chunk), { signal: abort.signal });
    if (result.note) console.log(`[challenge-coach] ${result.source}: ${result.note}`);
    res.end();
  });

  // --- Proposals -----------------------------------------------------------------------------
  app.get("/api/proposals", (_req, res) => {
    res.json(store.listProposals());
  });

  app.get("/api/proposals/:id", (req, res) => {
    const p = store.getProposal(req.params.id);
    if (!p) return res.status(404).json({ error: "No proposal with that id." });
    res.json(p);
  });

  app.post("/api/proposals", (req, res) => {
    const body = ProposalBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    const proposal: Proposal = {
      ...body.data,
      // First name or nickname only.
      studentName: body.data.studentName.split(/\s+/)[0].slice(0, 20),
      summary: scrub(body.data.summary),
      code: scrubCode(body.data.code),
      id: newId("proposal"),
      createdAt: new Date().toISOString(),
    };
    res.status(201).json(store.saveProposal(proposal));
  });

  // --- City problems -------------------------------------------------------------------------
  const keepWords = (extra: string[] = []) => [...neighborhoodList(loadCity()).map((n) => n.name), ...extra];

  /** The poster's browser (matching key), or this computer for the sample problems. */
  const canReview = (req: Request, p: CityProblem) => {
    const key = req.header("x-poster-key") ?? undefined;
    return keyMatches(key, store.posterKeyHash(p.id)) || (!!p.sample && fromLocalhost(req));
  };

  app.get("/api/city-problems", (_req, res) => {
    res.json(store.listCityProblems().map(summarize));
  });

  app.get("/api/city-problems/:id", (req, res) => {
    const p = store.getCityProblem(req.params.id);
    if (!p) return res.status(404).json({ error: "No city problem with that id." });
    res.json(withSortedSolutions(p));
  });

  app.post("/api/city-problems", (req, res) => {
    const body = PostCityProblemBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    const b = body.data;
    const hoods = neighborhoodList(loadCity());
    // Accept a neighborhood id too, and show its name.
    const neighborhood = hoods.find((n) => n.id === b.neighborhood)?.name ?? b.neighborhood;
    const keep = { keepWords: keepWords([neighborhood]) };

    const files = b.files.map((f) => ({ path: f.path, content: f.content }));
    const unsafe = files.find((f) => !isSafePath(f.path));
    if (unsafe) return bad(res, `unsafe file path: ${JSON.stringify(unsafe.path.slice(0, PROJECT_LIMITS.maxPathLength))}`);
    // Every attached file lands at data/<basename>; README.md, main.py and the test file come too.
    const problemWithFiles = checkFiles(
      files.map((f) => ({ path: `data/${basename(f.path)}`, content: f.content })),
      [],
      3,
    );
    if (problemWithFiles) return bad(res, problemWithFiles);

    const title = scrub(b.title, keep);
    const summary = scrub(b.summary, keep);
    const details = scrub(b.details || b.summary, keep);
    const data = scrub(b.data ?? "", keep);
    const posterKey = newPosterKey();
    const problem: CityProblem = {
      id: newId("city"),
      title,
      postedBy: firstWord(scrub(b.postedBy, keep)) || "Neighbor",
      posterKind: b.posterKind,
      neighborhood,
      summary,
      details,
      data,
      skills: b.skills.map((s) => scrub(s)),
      status: "Open",
      reward: DEFAULT_REWARD,
      due: dueIn(21),
      starter: buildStarter({ title, details, data, files: files.map((f) => ({ path: f.path, content: scrubCode(f.content, keep) })) }),
      solutions: [],
      createdAt: new Date().toISOString(),
    };
    store.saveCityProblem(problem, hashKey(posterKey));
    const out: PostCityProblemResponse = { problem, posterKey };
    res.status(201).json(out);
  });

  app.post("/api/city-problems/:id/solutions", (req, res) => {
    const p = store.getCityProblem(req.params.id);
    if (!p) return res.status(404).json({ error: "No city problem with that id." });
    const body = SubmitSolutionBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    if (p.status === "Solved") return res.status(409).json({ error: "This problem is already solved." });
    const b = body.data;

    const folders = b.project.folders ?? [];
    const problemWithFiles = checkFiles(b.project.files, folders);
    if (problemWithFiles) return bad(res, problemWithFiles);
    if (!b.project.files.some((f) => f.path.toLowerCase().endsWith(".py"))) return bad(res, "project: needs at least one .py file");
    if (b.project.entry !== undefined && !b.project.files.some((f) => f.path === b.project.entry)) {
      return bad(res, "project.entry: must be one of the project's files");
    }

    const keep = { keepWords: keepWords([p.neighborhood]) };
    const project: CitySolution["project"] = {
      files: b.project.files.map((f) => ({ path: f.path, content: scrubCode(f.content, keep) })),
      ...(folders.length ? { folders } : {}),
      ...(b.project.entry ? { entry: b.project.entry } : {}),
    };
    const solution: CitySolution = {
      id: newId("sol"),
      problemId: p.id,
      author: firstWord(b.author),
      school: scrub(b.school, keep),
      approach: scrub(b.approach, keep),
      metric: scrub(b.metric, keep),
      skills: b.skills.map((s) => scrub(s)),
      votes: 0,
      project,
      ...(b.tests ? { tests: clampTests(b.tests) } : {}),
      createdAt: new Date().toISOString(),
    };
    store.addCitySolution(p.id, solution);
    res.status(201).json(solution);
  });

  app.post("/api/city-problems/:id/solutions/:sid/vote", (req, res) => {
    const body = VoteBody.safeParse(req.body);
    if (!body.success) return bad(res, body.error);
    const votes = store.voteCitySolution(req.params.id, req.params.sid, body.data.voterId);
    if (votes === undefined) return res.status(404).json({ error: "No solution with that id." });
    res.json({ votes });
  });

  app.get("/api/city-problems/:id/review", (req, res) => {
    const p = store.getCityProblem(req.params.id);
    if (!p) return res.status(404).json({ error: "No city problem with that id." });
    res.json({ canReview: canReview(req, p) });
  });

  app.post("/api/city-problems/:id/solutions/:sid/choose", (req, res) => {
    const p = store.getCityProblem(req.params.id);
    if (!p) return res.status(404).json({ error: "No city problem with that id." });
    if (!canReview(req, p)) return res.status(403).json({ error: "Only the person who posted this problem can choose a solution." });
    const updated = store.chooseCitySolution(p.id, req.params.sid);
    if (!updated) return res.status(404).json({ error: "No solution with that id." });
    res.json(withSortedSolutions(updated));
  });

  app.get("/api/leaderboard", (_req, res) => {
    res.json(store.leaderboard(10));
  });

  // --- Demo reset (this machine only) --------------------------------------------------------
  app.post("/api/admin/reset", (req, res) => {
    if (!fromLocalhost(req)) return res.status(403).json({ error: "Reset is only allowed from this computer." });
    store.reset();
    console.log("[admin] store reset to seed state");
    res.json({
      ok: true,
      missions: store.listMissions().length,
      problems: store.listProblems().length,
      proposals: 0,
      cityProblems: store.listCityProblems().length,
    });
  });

  return app;
}
