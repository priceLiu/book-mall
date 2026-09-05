"use client";

import { useEffect, useRef, useState } from "react";

/** 移出节点后收起 hover 描边；侧 + 在同一节点壳内，不必长时间挂着 */
export const LIBTV_NODE_HOVER_HIDE_MS = 120;

/** hover 延迟隐藏，避免移向侧栏 + 时闪烁消失 */
export function useDelayedPointerHover(delayMs = LIBTV_NODE_HOVER_HIDE_MS) {
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
