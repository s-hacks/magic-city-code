// The left glass panel (UI prototype look): the level's concept, the mission title, the
// resident's words, the goal, the city-light meter, then the extras the real app adds —
// the honesty note when the mission counts a stand-in group, the story, the plan
// comparison, and the proposal button. Level pills live in the top bar; Sparks lives at
// the bottom of the code panel.
import type { CityData, FormerStore, Mission, Result } from "@mcc/shared";
import { CityMeter } from "../map/CityMeter";
import { ComparePlans } from "./ComparePlans";
import { needsHonestyNote, needWords, pct } from "./text";

export interface MissionPanelProps {
  mission: Mission;
  hood: string;
  levelIndex: number;
  baseline: Result;
  shown: Result | null; // the last finished successful run for this level
  comparing: boolean;
  data: CityData;
  formerStores: FormerStore[];
  onProposal(): void;
}

export const MissionPanel = ({ mission, hood, levelIndex, baseline, shown, comparing, data, formerStores, onProposal }: MissionPanelProps) => {
  const level = mission.levels[levelIndex];
  const view = shown ?? baseline;
  const words = needWords(mission);
  return (
    <>
      <p className="eyebrow">Mission · {level.concept}</p>
      <h2 className="title">{mission.title}</h2>
      <blockquote className="quote">
        “{mission.residentQuote}”
        <cite>— a neighbor in {hood}</cite>
      </blockquote>

      <div className="goal">
        <span className="goal-label">Goal · {level.title}</span>
        <span>{renderTicks(level.instructions)}</span>
        <span>Light up <strong>{pct(level.goal.target)}</strong> of {hood}.</span>
      </div>

      <CityMeter
        coverage={view.metrics.coverage}
        baselineCoverage={baseline.metrics.coverage}
        families={view.metrics.needCovered}
        target={level.goal.target}
        goalMet={!!shown?.goalMet}
        comparing={comparing}
        unit={words.who}
      />
      <p className="tiny">Counting {words.who} within a {mission.walkMinutes}-minute walk of {words.place} (straight-line estimate).</p>

      {needsHonestyNote(mission) && (
        <p className="note-box">Honest note: no public data shows where people sleep outside, so this counts low-income households instead.</p>
      )}
      <details className="story">
        <summary>Read the story</summary>
        <p>{mission.story}</p>
      </details>
      {shown?.ok && <ComparePlans mission={mission} data={data} formerStores={formerStores} levelIndex={levelIndex} result={shown} />}
      {shown?.goalMet && <button className="btn primary" onClick={onProposal}>Make a proposal →</button>}

      <p className="partner">With {mission.partner}</p>
    </>
  );
};

/** Show `code` spans from the instructions in code style. */
function renderTicks(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>));
}
