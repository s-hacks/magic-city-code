// Turns problem cards into map flares. A flare sits at its neighborhood's centre with a
// small offset that depends only on the card id, so flares never stack and never jump.
import type { Neighborhood, ProblemCard } from "@mcc/shared";
import type { Flare } from "../map/MapView";
import { shortLabel } from "../mission/text";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function flareFor(card: ProblemCard, hoods: Neighborhood[], label?: string): Flare | null {
  const hood = hoods.find((n) => n.id === card.neighborhood);
  if (!hood) return null;
  const dx = (hash(card.id + "x") - 0.5) * 0.012;
  const dy = (hash(card.id + "y") - 0.5) * 0.009;
  return { id: card.id, lon: hood.center[0] + dx, lat: hood.center[1] + dy, label: label ?? shortLabel(card.text) };
}

export function flaresFor(cards: ProblemCard[], hoods: Neighborhood[], labels: Record<string, string> = {}): Flare[] {
  return cards.map((c) => flareFor(c, hoods, labels[c.id])).filter((f): f is Flare => !!f);
}
