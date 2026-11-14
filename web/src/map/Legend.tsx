// Bottom legend (UI prototype look): each chip says what a light means in words and is
// also a switch — click it to show or hide that layer on the map.
import type { LayerGroup } from "./layerGroups";

export interface LegendProps {
  walkMinutes?: number; // from mission.walkMinutes (default 10)
  showStores?: boolean; // add the grocery-store chip (default true)
  hidden: ReadonlySet<LayerGroup>;
  onToggle(group: LayerGroup): void;
}

export function Legend({ walkMinutes = 10, showStores = true, hidden, onToggle }: LegendProps) {
  const Chip = ({ g, children }: { g: LayerGroup; children: React.ReactNode }) => (
    <button className="chip" aria-pressed={!hidden.has(g)} onClick={() => onToggle(g)}>{children}</button>
  );
  return (
    <footer className="legend glass" aria-label="Map layers — click to show or hide">
      <Chip g="residents">
        <i className="sw ash" /> far from food <i className="sw accent" /> within a {walkMinutes}-min walk <span className="muted">(est.)</span>
      </Chip>
      {showStores && <Chip g="stores"><i className="sw store" /> Grocery stores</Chip>}
      <Chip g="sites"><i className="sw ring" /> Hub sites</Chip>
      <Chip g="hubs"><i className="sw beam" /> Your hubs</Chip>
      <Chip g="need"><i className="sw haze" /> Need</Chip>
      <Chip g="streets">Streets</Chip>
      <Chip g="buildings">Buildings</Chip>
    </footer>
  );
}
