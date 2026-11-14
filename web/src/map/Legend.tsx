// Bottom legend: what the light colors mean, in words, with the mission's walk time.
// Labels can be changed per mission (e.g. "far from free Wi-Fi"); defaults are about food.
import { NIGHT, DAY } from "./theme";
import "./map.css";

export interface LegendProps {
  walkMinutes?: number; // from mission.walkMinutes (default 10)
  dayMode?: boolean;
  showStores?: boolean; // add the existing-source key (default true)
  farLabel?: string; // default "far from food"
  nearLabel?: string; // default "within a N-minute walk (estimated)"; shown as given when set
  storeLabel?: string; // default "grocery store"
}

const css = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export function Legend({ walkMinutes = 10, dayMode, showStores = true, farLabel = "far from food", nearLabel, storeLabel = "grocery store" }: LegendProps) {
  const p = dayMode ? DAY : NIGHT;
  const dot = (c: number[], size: number) => (
    <span className="dot" style={{ width: size, height: size, background: css(c), boxShadow: dayMode ? "none" : `0 0 8px ${css(c)}` }} />
  );
  return (
    <div className="mcc-legend" role="note" aria-label="Map legend">
      <span className="item">{dot(p.residentFar, 10)} {farLabel}</span>
      <span className="item">{dot(p.residentMid, 12)} longer walk</span>
      <span className="item">
        {dot(p.residentNear, 14)}{" "}
        {nearLabel ?? (
          <>
            within a {walkMinutes}-minute walk <span className="note">(estimated)</span>
          </>
        )}
      </span>
      {showStores && <span className="item">{dot(p.store, 12)} {storeLabel}</span>}
    </div>
  );
}
