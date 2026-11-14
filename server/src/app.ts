// The Express app and all routes. index.ts starts it; tests can build one without listening.
import cors from "cors";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { MissionSchema, type CoachRequest, type Mission, type Proposal } from "@mcc/shared";
import { loadCity, neighborhoodList } from "./city";
import { runCoach } from "./coach";
import { aiEnabled } from "./config";
import { generateMission, MAX_PROBLEM_CHARS } from "./generator";
import { scrub } from "./scrub";
import { newId, type Store } from "./store";

const ProblemBody = z.object({
  text: z.string().trim().min(1).max(MAX_PROBLEM_CHARS),
  neighborhood: z.string().nullish(),
});

const CoachBody = z.object({
  mission: z.unknown(),
  levelIndex: z.number().int().min(0).default(0),
  code: z.string().max(20000).default(""),
  lastError: z.string().max(4000).optional(),
  lastCoverage: z.number().min(0).max(1).optional(),
  question: z.string().max(1000).optional(),
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
});

function bad(res: Response, error: z.ZodError | string) {
  const message = typeof error === "string" ? error : error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  res.status(400).json({ error: message });
}

export function createApp(store: Store) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

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

  app.get("/api/missions", (_req, res) => {
    res.json(store.listMissions());
  });

  app.get("/api/missions/:id", (req, res) => {
    const m = store.getMission(req.params.id);
    if (!m) return res.status(404).json({ error: "No mission with that id." });
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
    // Prefer the server's copy of the mission; otherwise check the one the browser sent.
    const sentId = (body.data.mission as { id?: unknown } | null)?.id;
    let mission: Mission | undefined = typeof sentId === "string" ? store.getMission(sentId) : undefined;
    if (!mission) {
      const parsed = MissionSchema.safeParse(body.data.mission);
      if (!parsed.success) return bad(res, "mission: not a valid mission");
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

    const coachReq: CoachRequest = { ...body.data, mission };
    const result = await runCoach(coachReq, mission, (chunk) => res.write(chunk), { signal: abort.signal });
    if (result.note) console.log(`[coach] ${result.source}: ${result.note}`);
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
      id: newId("proposal"),
      createdAt: new Date().toISOString(),
    };
    res.status(201).json(store.saveProposal(proposal));
  });

  return app;
}
