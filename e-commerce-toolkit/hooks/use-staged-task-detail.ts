"use client";

import { useEffect, useState } from "react";

/** 长任务等待期间按阶段轮换说明文案（动效不变，仅更新 detail 小字） */
export function useStagedTaskDetail(
  steps: readonly string[],
  active: boolean,
  intervalMs = 2800,
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || steps.length === 0) {
      setIndex(0);
      return;
    }
    setIndex(0);
    const timer = window.setInterval(() => {
      setIndex((i) => (i < steps.length - 1 ? i + 1 : i));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs, steps]);

  if (!active || steps.length === 0) return "";
  return steps[Math.min(index, steps.length - 1)] ?? "";
}
