// The city-light meter (UI prototype look): a skyline of bars that fill with gold light
// from left to right as coverage rises, a dashed goal line, a Vulcan torch that lights at
// the goal, and the big number ("62% lit · 1,240 families"). The number and the torch's
// label are always shown, so the result never depends on color.
//
// Props
//   coverage          0..1, the student's result
//   baselineCoverage  0..1, the city today (zero actions)
//   families          families within reach in the student's result (needCovered)
//   target            0..1, the level goal
//   goalMet           true when the goal is reached
//   comparing         true while Compare is held: shows today, with "38% → 62%"
//   unit              what is counted, e.g. "households without a car" (default "families")
import { useTween } from "./useTween";
import { Torch } from "../app/icons";

export interface CityMeterProps {
  coverage: number;
  baselineCoverage: number;
  families: number;
  target: number;
  goalMet: boolean;
  comparing?: boolean;
  unit?: string;
}

// Bar heights (% of the skyline), left to right.
const BARS = [34, 52, 40, 70, 46, 88, 60, 100, 74, 50, 82, 44, 64, 38, 56, 30];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function CityMeter({ coverage, baselineCoverage, families, target, goalMet, comparing, unit = "families" }: CityMeterProps) {
  const value = comparing ? baselineCoverage : coverage;
  const shown = useTween(value, comparing ? 400 : 900);
  const fam = useTween(families, 900);
  const hasRun = coverage !== baselineCoverage;

  return (
    <>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label="Share of the neighborhood lit up">
        <div className="skyline">
          {BARS.map((h, i) => (
            <span key={i} className={(i + 0.5) / BARS.length <= value ? "on" : ""} style={{ height: `${h}%`, transitionDelay: `${i * 40}ms` }} />
          ))}
          <span className="target" style={{ left: `${Math.min(1, Math.max(0, target)) * 100}%` }} title={`Goal ${pct(target)}`} />
        </div>
        <Torch lit={goalMet && !comparing} />
      </div>
      <div className="score" aria-live="polite">
        <span className="score-num">{pct(shown)}</span>
        <span className="score-sub">
          {comparing ? "lit today" : `lit · ${Math.round(fam).toLocaleString()} ${unit}`}
          {hasRun && <span className="delta">{pct(baselineCoverage)} → {pct(coverage)}</span>}
        </span>
      </div>
      {comparing && <p className="compare-note">Showing the city as it is today</p>}
    </>
  );
}
