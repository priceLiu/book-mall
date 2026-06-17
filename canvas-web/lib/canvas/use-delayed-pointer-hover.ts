"use client";

import { useEffect, useRef, useState } from "react";

/** hover 延迟隐藏，避免移向侧栏 + 时闪烁消失 */
export function useDelayedPointerHover(delayMs = 960) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPointerEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(true);
  };

  const onPointerLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHovered(false), delayMs);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { hovered, onPointerEnter, onPointerLeave, setHovered };
}
