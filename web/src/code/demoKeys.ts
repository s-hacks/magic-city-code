// Hidden demo shortcuts: Ctrl+Shift+1 / 2 / 3 types the prepared solution of the
// 1st / 2nd / 3rd level into the editor (levels[0].solution, levels[1].solution, ...).
// Handy when presenting: no typing under stage lights. Students never see this.
// Uses the physical key (Digit1..Digit3) so it also works on Mac, where Shift+1 types "!".
import { useEffect, useRef } from "react";

export function useDemoKeys(levels: { solution: string }[], setCode: (code: string) => void) {
  // Keep the latest values without re-attaching the listener on every render.
  const latest = useRef({ levels, setCode });
  latest.current = { levels, setCode };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (!m) return;
      const level = latest.current.levels[Number(m[1]) - 1];
      if (!level) return;
      e.preventDefault();
      latest.current.setCode(level.solution);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
