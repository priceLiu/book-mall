"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** 弹层整体可拖。点在按钮或输入上时不拖动。 */
export function useFloatDrag() {
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const shiftRef = useRef(shift);
  shiftRef.current = shift;

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, select, a, label")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const base = shiftRef.current;
    const move = (ev: PointerEvent) => {
      setShift({ x: base.x + ev.clientX - startX, y: base.y + ev.clientY - startY });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const reset = useCallback(() => setShift({ x: 0, y: 0 }), []);
  return { shift, onPointerDown, reset };
}
