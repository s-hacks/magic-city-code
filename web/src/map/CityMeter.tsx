// The city-light meter: a small skyline that fills with gold light from left to
// right as coverage rises, the number beside it ("62% lit · 1,240 families"), and
// a Vulcan-style torch that turns green when the goal is met. The number and a
// "Goal reached" label are always shown, so the result never depends on color.
//
// Props
//   coverage          0..1, the student's result
//   baselineCoverage  0..1, the city today (zero actions)
//   families          families within reach in the student's result (needCovered)
//   target            0..1, the level goal
//   goalMet           true when the goal is reached
//   comparing         true while Compare is held: fill shows today, text shows "38% → 62%"
import { useTween } from "./useTween";
import { TOKENS } from "./theme";
import "./map.css";

export interface CityMeterProps {
  coverage: number;
  baselineCoverage: number;
  families: number;
  target: number;
  goalMet: boolean;
  comparing?: boolean;
}

const W = 230; // skyline width; the torch sits to the right
const H = 64;
// [x, width, height] of each building, left to right.
const BUILDINGS: [number, number, number][] = [
  [0, 16, 22], [17, 12, 34], [30, 20, 28], [51, 10, 46], [62, 18, 30], [81, 14, 52],
  [96, 22, 38], [119, 12, 58], [132, 18, 32], [151, 14, 44], [166, 20, 26], [187, 12, 40], [200, 30, 30],
];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function CityMeter({ coverage, baselineCoverage, families, target, goalMet, comparing }: CityMeterProps) {
  const shown = useTween(comparing ? baselineCoverage : coverage, comparing ? 400 : 1400);
  const fam = useTween(families, 1400);
  const fillW = Math.max(0, Math.min(1, shown)) * W;
  const goalX = Math.max(0, Math.min(1, target)) * W;
  const flame = goalMet ? TOKENS.go : TOKENS.gold;
  const path = BUILDINGS.map(([x, w, h]) => `M${x} ${H}V${H - h}h${w}V${H}z`).join("");

  return (
    <div className="mcc-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(coverage * 100)} aria-label="Share of the neighborhood lit up">
      <svg width={W + 40} height={H + 18} viewBox={`0 0 ${W + 40} ${H + 18}`} aria-hidden="true">
        <defs>
          <clipPath id="mcc-meter-clip">
            <rect x={0} y={0} width={fillW} height={H} />
          </clipPath>
          <filter id="mcc-meter-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* dark city */}
        <path d={path} fill={TOKENS.steel} stroke="rgba(242,245,255,0.18)" strokeWidth={1} />
        {/* lit part */}
        <g clipPath="url(#mcc-meter-clip)" filter="url(#mcc-meter-glow)">
          <path d={path} fill={TOKENS.gold} />
        </g>
        {/* goal line */}
        <line x1={goalX} x2={goalX} y1={2} y2={H + 2} stroke={TOKENS.paper} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.8} />
        <text x={goalX} y={H + 15} fill="#aeb8d6" fontSize={11} textAnchor="middle" fontFamily="Space Grotesk, system-ui, sans-serif">
          goal {pct(target)}
        </text>
        {/* Vulcan-style torch: pedestal, raised arm, flame */}
        <g transform={`translate(${W + 8}, 0)`}>
          <rect x={6} y={H - 14} width={16} height={14} fill={TOKENS.steel} stroke="rgba(242,245,255,0.25)" />
          <rect x={11} y={H - 34} width={6} height={20} fill={TOKENS.steel} stroke="rgba(242,245,255,0.25)" />
          <rect x={15} y={H - 46} width={3} height={14} fill={TOKENS.steel} />
          <path
            className="flame"
            d={`M16.5 ${H - 47} c-6 -6 -3 -12 0 -17 c1 5 6 7 4 12 c-1 3 -2 4 -4 5z`}
            fill={flame}
            filter={goalMet ? "url(#mcc-meter-glow)" : undefined}
          />
        </g>
      </svg>
      <div className="row">
        <span className="big">{comparing ? `${pct(baselineCoverage)} → ${pct(coverage)}` : `${pct(shown)} lit`}</span>
        {!comparing && <span className="families">· {Math.round(fam).toLocaleString()} families</span>}
      </div>
      <div className={`goal${goalMet ? " met" : ""}`}>{goalMet ? `✓ Goal reached: ${pct(target)}` : `Goal: light up ${pct(target)}`}</div>
    </div>
  );
}
