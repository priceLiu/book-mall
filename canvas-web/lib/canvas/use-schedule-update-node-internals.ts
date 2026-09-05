"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";

type PendingFlush = Map<string, (id: string) => void>;

const lastScheduledKeyByNode = new Map<string, string>();
let pendingFlush: PendingFlush | null = null;
let flushRaf = 0;

function flushScheduledNodeInternals() {
  flushRaf = 0;
  const batch = pendingFlush;
  pendingFlush = null;
  if (!batch?.size) return;
  for (const [nodeId, update] of batch) {
    update(nodeId);
  }
}

/** 全画布共用 · rAF 合并 + 按 key 去重，避免 RF→zustand 嵌套更新死循环 */
export function scheduleUpdateNodeInternals(
  nodeId: string,
  key: string,
  update: (id: string) => void,
) {
  if (lastScheduledKeyByNode.get(nodeId) === key) return;
  lastScheduledKeyByNode.set(nodeId, key);

  if (!pendingFlush) pendingFlush = new Map();
  pendingFlush.set(nodeId, update);

  if (flushRaf) return;
  flushRaf = requestAnimationFrame(flushScheduledNodeInternals);
}

export function useScheduleUpdateNodeInternals(nodeId: string | null | undefined) {
  const updateNodeInternals = useUpdateNodeInternals();
  const updateRef = useRef(updateNodeInternals);
  updateRef.current = updateNodeInternals;

  const schedule = useCallback(
    (key: string) => {
      if (!nodeId) return;
      scheduleUpdateNodeInternals(nodeId, key, (id) => {
        updateRef.current(id);
      });
    },
    [nodeId],
  );

  useEffect(() => {
    return () => {
      if (nodeId) {
        lastScheduledKeyByNode.delete(nodeId);
        pendingFlush?.delete(nodeId);
      }
    };
  }, [nodeId]);

  return schedule;
}

/** ResizeObserver → updateNodeInternals：忽略亚像素抖动，仅尺寸变化 ≥2px 时调度 */
export function useObserveNodeInternalsResize(
  nodeId: string | null | undefined,
  elementRef: RefObject<HTMLElement | null>,
) {
  const schedule = useScheduleUpdateNodeInternals(nodeId);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !nodeId) return;

    let lastW = 0;
    let lastH = 0;
    let roRaf = 0;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      lastW = w;
      lastH = h;
      cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(() => {
        schedule(`resize:${w}x${h}`);
      });
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(roRaf);
    };
  }, [nodeId, elementRef, schedule]);
}
