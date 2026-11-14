// City problems API client (server routes in server/src/app.ts), plus the per-browser keys:
// the poster keys for problems posted here, a voter id, and the solutions sent from here.
import type {
  CityProblem,
  CityProblemSummary,
  CitySolution,
  LeaderRow,
  PostCityProblemRequest,
  PostCityProblemResponse,
  SubmitSolutionRequest,
} from "@mcc/shared";
import { local } from "./project";

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    signal: rest.signal ?? AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const msg = await res.json().then((b: { error?: string }) => b.error, () => null);
    throw new Error(msg || (res.status >= 500 || res.status === 404 ? `The server said ${res.status}.` : "That didn't work."));
  }
  return (await res.json()) as T;
}

/** A friendlier message when the server isn't running at all. */
export function explain(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Failed to fetch|NetworkError|timed? ?out|aborted|502|504/i.test(m)) return "Can't reach the Magic City Code server. Start it with pnpm dev, then try again.";
  return m;
}

const posterKeys = () => local.get<Record<string, string>>("mcc.posterKeys", {});
export const posterKeyFor = (problemId: string) => posterKeys()[problemId];
const keyHeader = (problemId: string): Record<string, string> => {
  const k = posterKeyFor(problemId);
  return k ? { "x-poster-key": k } : {};
};

export function voterId(): string {
  let id = local.get<string>("mcc.voterId", "");
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
    local.set("mcc.voterId", id);
  }
  return id;
}
const votedKey = "mcc.voted";
export const hasVoted = (solutionId: string) => local.get<string[]>(votedKey, []).includes(solutionId);

export interface MySolution { problemId: string; solutionId: string; title: string }
export const mySolutions = () => local.get<MySolution[]>("mcc.mySolutions", []);

export const cityApi = {
  list: () => call<CityProblemSummary[]>("/api/city-problems"),
  get: (id: string) => call<CityProblem>(`/api/city-problems/${encodeURIComponent(id)}`),
  leaderboard: () => call<LeaderRow[]>("/api/leaderboard"),

  async post(body: PostCityProblemRequest): Promise<CityProblem> {
    const out = await call<PostCityProblemResponse>("/api/city-problems", { method: "POST", json: body });
    local.set("mcc.posterKeys", { ...posterKeys(), [out.problem.id]: out.posterKey });
    return out.problem;
  },

  async submit(problem: Pick<CityProblem, "id" | "title">, body: SubmitSolutionRequest): Promise<CitySolution> {
    const sol = await call<CitySolution>(`/api/city-problems/${encodeURIComponent(problem.id)}/solutions`, { method: "POST", json: body });
    local.set("mcc.mySolutions", [{ problemId: problem.id, solutionId: sol.id, title: problem.title }, ...mySolutions()].slice(0, 30));
    return sol;
  },

  async vote(problemId: string, solutionId: string): Promise<number> {
    const out = await call<{ votes: number }>(`/api/city-problems/${encodeURIComponent(problemId)}/solutions/${encodeURIComponent(solutionId)}/vote`, {
      method: "POST",
      json: { voterId: voterId() },
    });
    local.set(votedKey, [...new Set([...local.get<string[]>(votedKey, []), solutionId])]);
    return out.votes;
  },

  canReview: (problemId: string) =>
    call<{ canReview: boolean }>(`/api/city-problems/${encodeURIComponent(problemId)}/review`, { headers: keyHeader(problemId) }).then(
      (r) => r.canReview,
      () => false,
    ),

  choose: (problemId: string, solutionId: string) =>
    call<CityProblem>(`/api/city-problems/${encodeURIComponent(problemId)}/solutions/${encodeURIComponent(solutionId)}/choose`, {
      method: "POST",
      headers: keyHeader(problemId),
      json: {},
    }),
};
