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

export interface CoachRequest {
  mission: Mission;
  levelIndex: number;
  code: string;
  lastError?: string;
  lastCoverage?: number;
  question?: string; // what the student typed to Sparks
  hintsGiven: number; // 0,1,2 -> nudge, idea, worked example
}
// POST /api/coach streams plain text (text/plain; chunked).

export interface Proposal {
  id: string;
  studentName: string; // first name or nickname only
  missionId: string;
  missionTitle: string;
  partner: string;
  neighborhood: string;
  levelIndex: number;
  code: string;
  before: number; // coverage 0..1
  after: number;
  helped: number;
  summary: string;
  createdAt: string;
}
