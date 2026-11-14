// Small helpers for things kept in the browser (unlocked levels, day mode, proposals
// saved on this laptop). Every read and write is wrapped, so the app still works when
// storage is blocked.
import type { Proposal } from "@mcc/shared";

export function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Highest unlocked level index for a mission (0 = only the first level). */
export function getUnlocked(missionId: string, maxIndex: number): number {
  const n = Number(readStore(`mcc.unlocked.${missionId}`));
  return Number.isFinite(n) ? Math.max(0, Math.min(maxIndex, Math.floor(n))) : 0;
}
export function setUnlocked(missionId: string, index: number) {
  writeStore(`mcc.unlocked.${missionId}`, String(index));
}

export function getLocalProposals(): Proposal[] {
  try {
    return JSON.parse(readStore("mcc.proposals") ?? "[]") as Proposal[];
  } catch {
    return [];
  }
}
export function saveLocalProposal(p: Proposal) {
  writeStore("mcc.proposals", JSON.stringify([p, ...getLocalProposals().filter((x) => x.id !== p.id)].slice(0, 30)));
}

// The map picture is too big for localStorage; keep it for this tab only.
export function saveSnapshot(missionId: string, dataUrl: string) {
  try {
    sessionStorage.setItem(`mcc.snap.${missionId}`, dataUrl);
  } catch {
    /* ignore */
  }
}
export function getSnapshot(missionId: string): string | null {
  try {
    return sessionStorage.getItem(`mcc.snap.${missionId}`);
  } catch {
    return null;
  }
}
