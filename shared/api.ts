// Request and response shapes for the Express API.
import type { Mission } from "./mission";

export interface ProblemCard {
  id: string;
  text: string; // scrubbed resident words
  neighborhood: string | null; // Neighborhood.id
  status: "new" | "mission" | "needs_new_type";
  missionId?: string;
  createdAt: string;
}

export interface GenerateRequest {
  text: string;
  neighborhood?: string;
}

export type GenerateResponse =
  | { status: "ok"; mission: Mission; problem: ProblemCard; source: "ai" | "fallback" }
  | { status: "unsupported"; reason: string; problem: ProblemCard };

/** A mission with every level's solution removed. The only mission shape the browser may send to the server. */
export type PublicMission = Omit<Mission, "levels"> & {
  levels: Omit<Mission["levels"][number], "solution">[];
};

export interface CoachRequest {
  missionId: string; // the server uses its own stored copy
  mission?: PublicMission; // only for a mission the server doesn't have; never carries solutions
  levelIndex: number;
  code: string;
  lastError?: string;
  lastCoverage?: number;
  question?: string; // what the student typed to Sparks
  hintsGiven: number; // 0,1,2 -> nudge, idea, worked example
}
// POST /api/coach streams plain text (text/plain; chunked).

/** One earlier turn in the challenge coach chat. */
export interface ChallengeCoachTurn {
  role: "student" | "coach";
  text: string;
}

/** What the student asks the coach to do. "chat" = a free question. */
export type ChallengeCoachAction = "hint" | "explain-failure" | "review" | "concept" | "chat";

export interface ChallengeCoachRequest {
  challengeId: string; // the server uses its own copy of the challenge (with the solution, for the leak guard)
  action: ChallengeCoachAction;
  code: string;
  question?: string;
  /** The test the student is looking at, if it has run. */
  verdict?: { ok: boolean; title: string; detail: string; line?: number; testName?: string };
  flood?: boolean;
  history?: ChallengeCoachTurn[]; // the last few turns, oldest first
  hintsGiven: number; // 0,1,2 -> nudge, idea, worked example
}
// POST /api/challenges/:id/coach streams plain text (text/plain; chunked).

export interface Proposal {
  id: string;
  studentName: string; // first name or nickname only
  missionId: string;
  missionTitle: string;
  partner: string;
  neighborhood: string;
  levelIndex: number;
  code: string; // the exact code that produced before/after
  thing?: string; // mission.thing, e.g. "pickup hub"
  hubs?: number; // how many were placed
  before: number; // coverage 0..1
  after: number;
  helped: number;
  summary: string;
  createdAt: string;
}
