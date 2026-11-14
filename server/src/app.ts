// The Express app and all routes. index.ts starts it; tests can build one without listening.
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { MissionSchema, type Proposal } from "@mcc/shared";
import { loadCity, neighborhoodList } from "./city";
import { runCoach } from "./coach";
import type { CoachMission } from "./prompts/coach";
import { aiEnabled } from "./config";
import { generateMission, MAX_PROBLEM_CHARS } from "./generator";
import { scrub } from "./scrub";
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
      code: scrub(body.data.code),
      id: newId("proposal"),
      createdAt: new Date().toISOString(),
    };
    res.status(201).json(store.saveProposal(proposal));
  });

  // --- Demo reset (this machine only) --------------------------------------------------------
  app.post("/api/admin/reset", (req, res) => {
    if (!fromLocalhost(req)) return res.status(403).json({ error: "Reset is only allowed from this computer." });
    store.reset();
    console.log("[admin] store reset to seed state");
    res.json({ ok: true, missions: store.listMissions().length, problems: store.listProblems().length, proposals: 0 });
  });

  return app;
}
