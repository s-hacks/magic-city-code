// The left glass panel: the resident's words, story, partner, level tabs, instructions,
// goal, city-light meter, the honesty note when the mission counts a stand-in group,
// the plan comparison, and hints with Sparks.
import type { CityData, FormerStore, Mission, Result } from "@mcc/shared";
import { CityMeter } from "../map/CityMeter";
import { Coach } from "./Coach";
import { ComparePlans } from "./ComparePlans";
import { needsHonestyNote, NEED_LABEL, pct } from "./text";

export interface MissionPanelProps {
  mission: Mission;
  levelIndex: number;
  unlocked: number;
  onLevel(i: number): void;
  baseline: Result;
  shown: Result | null; // the last finished successful run for this level
  comparing: boolean;
  data: CityData;
  formerStores: FormerStore[];
  code: string;
  lastError?: string;
  onProposal(): void;
}

export const MissionPanel = ({ mission, levelIndex, unlocked, onLevel, baseline, shown, comparing, data, formerStores, code, lastError, onProposal }: MissionPanelProps) => {
  const level = mission.levels[levelIndex];
  const view = shown ?? baseline;
  return (
    <div className="panel-inner">
      <div className="panel-head">
        <h2>{mission.title}</h2>
        <p className="quote">“{mission.residentQuote}” <span className="muted">— a neighbor</span></p>
        <div className="partner">Partner: {mission.partner}</div>
      </div>

      <div className="tabs" role="tablist" aria-label="Levels">
        {mission.levels.map((l, i) => {
          const locked = i > unlocked;
          return (
            <button key={i} role="tab" aria-selected={i === levelIndex} className={`tab ${i === levelIndex ? "on" : ""}`} disabled={locked} onClick={() => onLevel(i)} title={locked ? "Finish the last level to unlock" : l.title}>
              <b>{locked ? "🔒" : ""} {i + 1}</b>
              <span>{l.concept}</span>
            </button>
          );
        })}
      </div>

      <div className="meter-box">
        <CityMeter coverage={view.metrics.coverage} baselineCoverage={baseline.metrics.coverage} families={view.metrics.needCovered} target={level.goal.target} goalMet={!!shown?.goalMet} comparing={comparing} />
        <div className="muted small">Counting {NEED_LABEL[mission.needColumn]} within a {mission.walkMinutes}-minute walk (straight-line estimate).</div>
      </div>

      <div className="panel-scroll">
        <h3>{level.title}</h3>
        <p className="instructions">{renderTicks(level.instructions)}</p>
        <p className="goal-line">Goal: light up {pct(level.goal.target)}</p>
        {needsHonestyNote(mission) && (
          <p className="note-box">Honest note: there is no public data on where people sleeping outside are. This mission counts low-income households instead, so it is a starting point, not the whole picture.</p>
        )}
        <details className="story">
          <summary>Read the story</summary>
          <p>{mission.story}</p>
        </details>
        {shown?.ok && <ComparePlans mission={mission} data={data} formerStores={formerStores} levelIndex={levelIndex} result={shown} />}
        {shown?.goalMet && <button className="big-btn small-btn" onClick={onProposal}>📄 Make a proposal</button>}
        <Coach key={`${mission.id}-${levelIndex}`} mission={mission} levelIndex={levelIndex} code={code} lastError={lastError} lastCoverage={shown?.metrics.coverage} />
      </div>
    </div>
  );
};

/** Show `code` spans from the instructions in code style. */
function renderTicks(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>));
}
