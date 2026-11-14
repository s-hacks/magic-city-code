// "Compare plans": one new store at a closed store's old site versus the student's hubs,
// both worked out live by the engine on the same data. Shown only after a successful run.
// Nothing here is typed in by hand.
import { useMemo } from "react";
import type { CityData, FormerStore, Mission, Result } from "@mcc/shared";
import { simulate } from "../engine";
import { num, pct, plural } from "./text";

export function ComparePlans({ mission, data, formerStores, levelIndex, result }: { mission: Mission; data: CityData; formerStores: FormerStore[]; levelIndex: number; result: Result }) {
  const [minLon, minLat, maxLon, maxLat] = mission.area.bbox;
  const site = formerStores.find((s) => s.lon >= minLon && s.lon <= maxLon && s.lat >= minLat && s.lat <= maxLat);
  const planA = useMemo(() => {
    if (!site) return null;
    return simulate(mission, [], { ...data, stores: [...data.stores, site] }, levelIndex);
  }, [mission, data, site, levelIndex]);
  if (!site || !planA || mission.existingSources === "none") return null;
  const n = result.placed.length;
  return (
    <div className="compare-plans" aria-label="Compare plans">
      <h4>Compare plans</h4>
      <div>One new store at the old {site.name} site: <b>{pct(planA.metrics.coverage)}</b> <span className="muted">({num(planA.metrics.needCovered)} households)</span></div>
      <div>Your {n} {plural(mission.thing, n)}: <b>{pct(result.metrics.coverage)}</b> <span className="muted">({num(result.metrics.needCovered)} households)</span></div>
      <div className="muted small">Same data, same walking estimate. A starting point for discussion.</div>
    </div>
  );
}
