// City problems: the community loop. A neighbor posts a problem (with a starter project),
// a student solves it in the in-app workspace (a small multi-file Python project), submits it,
// the poster reviews the submitted projects, re-runs them, and picks one. Chosen solutions
// and upvotes earn points on the leaderboard.

/** One file in a project. Paths use "/" and have no leading slash, e.g. "data/reports.csv". */
export interface ProjectFile {
  path: string;
  content: string;
}

/** A whole project: files plus folders that may be empty. */
export interface Project {
  files: ProjectFile[];
  /** Folder paths with no files in them yet (folders with files are implied by the paths). */
  folders?: string[];
  /** The file "Run" executes when the student hasn't picked one. Default "main.py". */
  entry?: string;
}

export type PosterKind = "Resident" | "Neighborhood group" | "Nonprofit" | "City department";
export type CityProblemStatus = "Open" | "Reviewing" | "Solved";

/** What the in-app runner found when the problem's own tests ran on the submitted code. */
export interface TestSummary {
  passed: number;
  total: number;
  /** One entry per test, in order. */
  results: { name: string; ok: boolean; message?: string }[];
}

export interface CitySolution {
  id: string;
  problemId: string;
  author: string; // first name or nickname only
  school: string;
  approach: string; // the write-up
  metric: string; // the result in one line, e.g. "Top 10 inlets cover 64% of flooded homes"
  skills: string[];
  votes: number;
  chosen?: boolean;
  /** The submitted project. Sample solutions from the seed may have none. */
  project?: Project;
  tests?: TestSummary;
  createdAt: string;
}

export interface CityProblem {
  id: string;
  title: string;
  postedBy: string;
  posterKind: PosterKind;
  neighborhood: string; // display name
  summary: string; // one or two lines for the card
  details: string; // the full ask
  data: string; // what data the poster has, in words
  skills: string[];
  status: CityProblemStatus;
  reward: string;
  due: string; // display text, e.g. "Dec 8"
  /** The project every solver starts from: README, data files, starter code, tests. */
  starter: Project;
  solutions: CitySolution[];
  /** true for the sample problems shipped with the app. */
  sample?: boolean;
  createdAt: string;
}

/** The list view: no projects, just counts. */
export type CityProblemSummary = Omit<CityProblem, "starter" | "solutions"> & { solutionCount: number };

export interface LeaderRow {
  name: string;
  school: string;
  points: number;
  chosen: number;
}

/** Points rules. */
export const POINTS_CHOSEN = 300;
export const POINTS_VOTE = 10;
export const INTERVIEW_AT = 1000;

// --- request bodies ------------------------------------------------------------------------------

export interface PostCityProblemRequest {
  title: string;
  summary: string;
  details?: string;
  neighborhood: string;
  posterKind: PosterKind;
  postedBy: string;
  skills: string[];
  data?: string;
  /** Data files the poster attached, saved under data/ in the starter project. */
  files?: ProjectFile[];
}
/** POST /api/city-problems -> the problem plus the key that lets this browser review it. */
export interface PostCityProblemResponse {
  problem: CityProblem;
  posterKey: string;
}

export interface SubmitSolutionRequest {
  author: string;
  school: string;
  approach: string;
  metric: string;
  skills: string[];
  project: Project;
  tests?: TestSummary;
}

/** Limits both sides agree on. */
export const PROJECT_LIMITS = {
  maxFiles: 40,
  maxFileBytes: 200_000,
  maxProjectBytes: 600_000,
  maxPathLength: 120,
};

/** True for a safe relative path: no leading slash, no "..", only plain characters. */
export function isSafePath(p: string): boolean {
  if (!p || p.length > PROJECT_LIMITS.maxPathLength) return false;
  if (p.startsWith("/") || p.endsWith("/")) return false;
  return p.split("/").every((part) => part !== "" && part !== "." && part !== ".." && /^[\w .\-]+$/.test(part));
}
