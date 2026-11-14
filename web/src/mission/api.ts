// Talks to the Express server at /api. If the server is not reachable, falls back to the
// static files in /data so the demo still works: seed missions, seed problems, and the
// coach falls back to the hints written in the mission (handled in Coach.tsx).
import type { CoachRequest, FormerStore, GenerateRequest, GenerateResponse, Mission, ProblemCard, Proposal, PublicMission } from "@mcc/shared";

export interface MissionSummary {
  id: string;
  title: string;
  neighborhood: string;
  partner: string;
  approved?: boolean;
  source?: "seed" | "resident";
}

async function getJson<T>(url: string, timeoutMs = 4000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const summarize = (m: Mission): MissionSummary => ({
  id: m.id,
  title: m.title,
  neighborhood: m.area.neighborhood,
  partner: m.partner,
  approved: m.approved,
  source: m.source.kind,
});

export async function listProblems(): Promise<ProblemCard[]> {
  try {
    return await getJson<ProblemCard[]>("/api/problems");
  } catch {
    return getJson<ProblemCard[]>("/data/problems.seed.json").catch(() => []);
  }
}

export async function listMissionSummaries(): Promise<MissionSummary[]> {
  try {
    const all = await getJson<Mission[]>("/api/missions");
    return all.filter((m) => m.approved).map(summarize);
  } catch {
    return getJson<MissionSummary[]>("/data/missions/index.json").catch(() => []);
  }
}

/** Mission ids the server refused because no adult has approved them yet. */
const pendingIds = new Set<string>();
export const isPendingApproval = (id: string) => pendingIds.has(id);

/** Copy of a mission with every level's solution removed: the only shape we send to the coach. */
export function toPublicMission(m: Mission): PublicMission {
  return { ...m, levels: m.levels.map(({ solution: _solution, ...rest }) => rest) };
}

export async function fetchMission(id: string): Promise<Mission | null> {
  const safe = encodeURIComponent(id);
  try {
    const res = await fetch(`/api/missions/${safe}`, { signal: AbortSignal.timeout(4000) });
    if (res.status === 403) {
      pendingIds.add(id);
      return null;
    }
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Mission;
  } catch {
    return getJson<Mission>(`/data/missions/${safe}.json`).catch(() => null);
  }
}

export async function loadFormerStores(): Promise<FormerStore[]> {
  return getJson<FormerStore[]>("/data/former_stores.json").catch(() => []);
}

/** Throws when the server cannot be reached or says no. */
export async function generateMission(req: GenerateRequest): Promise<GenerateResponse> {
  const res = await fetch("/api/missions/generate", {
    signal: AbortSignal.timeout(30000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`generate ${res.status}`);
  return (await res.json()) as GenerateResponse;
}

export async function approveMission(id: string): Promise<Mission | null> {
  try {
    const res = await fetch(`/api/missions/${encodeURIComponent(id)}/approve`, { method: "POST" });
    return res.ok ? ((await res.json()) as Mission) : null;
  } catch {
    return null;
  }
}

/** Streams the coach's reply. Resolves with the full text; throws if the server is unreachable. */
export async function streamCoach(req: CoachRequest, onText: (soFar: string) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`coach ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  if (!text.trim()) throw new Error("empty coach reply");
  return text;
}

export type ProposalInput = Omit<Proposal, "id" | "createdAt">;

export async function saveProposal(input: ProposalInput): Promise<Proposal> {
  const res = await fetch("/api/proposals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`proposal ${res.status}`);
  return (await res.json()) as Proposal;
}

export async function fetchProposal(id: string): Promise<Proposal | null> {
  return getJson<Proposal>(`/api/proposals/${encodeURIComponent(id)}`).catch(() => null);
}
