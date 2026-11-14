// Animates a number toward a target (ease-out), for the meter fill and the counters.
import { useEffect, useRef, useState } from "react";

export function useTween(target: number, durationMs = 1200): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    from.current = current.current;
    const start = performance.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / durationMs);
      const e = 1 - Math.pow(1 - p, 3);
      current.current = from.current + (target - from.current) * e;
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}
