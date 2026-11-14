// Bottom legend: what the two light colors mean, in words, with the mission's walk time.
import { NIGHT, DAY } from "./theme";
import "./map.css";

export interface LegendProps {
  walkMinutes?: number; // from mission.walkMinutes (default 10)
  dayMode?: boolean;
  showStores?: boolean; // add the grocery-store key (default true)
}

const css = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export function Legend({ walkMinutes = 10, dayMode, showStores = true }: LegendProps) {
  const p = dayMode ? DAY : NIGHT;
  const dot = (c: number[], size: number) => (
    <span className="dot" style={{ width: size, height: size, background: css(c), boxShadow: dayMode ? "none" : `0 0 8px ${css(c)}` }} />
  );
  return (
    <div className="mcc-legend" role="note" aria-label="Map legend">
      <span className="item">{dot(p.residentFar, 10)} far from food</span>
      <span className="item">{dot(p.residentMid, 12)} longer walk</span>
      <span className="item">
        {dot(p.residentNear, 14)} within a {walkMinutes}-minute walk <span className="note">(estimated)</span>
      </span>
      {showStores && <span className="item">{dot(p.store, 12)} grocery store</span>}
    </div>
  );
}
