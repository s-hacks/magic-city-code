// Hold-to-compare: while the B key or the Compare button is held, `comparing` is
// true (show the city today). Release to see the student's result again.
// The key is ignored while typing in the editor or any text field.
//
//   const { comparing, buttonProps } = useCompare();
//   <button {...buttonProps}>Compare</button>
import { useCallback, useEffect, useMemo, useState } from "react";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable || !!el.closest?.(".cm-editor");
}

export function useCompare(key = "b") {
  const [keyHeld, setKeyHeld] = useState(false);
  const [pointerHeld, setPointerHeld] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      setKeyHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key) setKeyHeld(false);
    };
    const reset = () => {
      setKeyHeld(false);
      setPointerHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, [key]);

  const press = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setPointerHeld(true);
  }, []);
  const release = useCallback(() => setPointerHeld(false), []);

  const buttonProps = useMemo(
    () => ({
      onPointerDown: press,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      "aria-pressed": pointerHeld,
    }),
    [press, release, pointerHeld],
  );

  return { comparing: keyHeld || pointerHeld, buttonProps };
}
