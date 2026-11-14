// The mission's description card (left column, same layout as a code challenge): where and
// which coding idea, the title, the resident's words, the goal, the honesty note when the
// mission counts a stand-in group, the story and the partner. The city-light meter and the
// plan comparison live in the results card under the map (MissionScreen).
import type { Mission } from "@mcc/shared";
import { needsHonestyNote, pct } from "./text";

export interface MissionPanelProps {
  mission: Mission;
  hood: string;
  levelIndex: number;
}

export const MissionPanel = ({ mission, hood, levelIndex }: MissionPanelProps) => {
  const level = mission.levels[levelIndex];
  return (
    <>
      <p className="eyebrow grad-text">{hood} · Mission</p>
      <h1>{mission.title}</h1>
      <div className="tags">
        <span className="tag">Level {levelIndex + 1}: {level.concept}</span>
      </div>
      <blockquote className="quote">
        “{mission.residentQuote}”
        <cite>— a neighbor in {hood}</cite>
      </blockquote>

      <div className="goal">
        <span className="goal-label">Goal · {level.title}</span>
        <span>{renderTicks(level.instructions)}</span>
        <span>Light up <strong>{pct(level.goal.target)}</strong> of {hood}.</span>
      </div>

      {needsHonestyNote(mission) && (
        <p className="note-box">Honest note: no public data shows where people sleep outside, so this counts low-income households instead.</p>
      )}
      <details className="story">
        <summary>Read the story</summary>
        <p>{mission.story}</p>
      </details>
      <p className="partner">With {mission.partner}</p>
    </>
  );
};

/** Show `code` spans from the instructions in code style. */
function renderTicks(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>));
}
