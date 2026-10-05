"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";

type PendingFlush = Map<string, (id: string) => void>;

const lastScheduledKeyByNode = new Map<string, string>();
let pendingFlush: PendingFlush | null = null;
let flushRaf = 0;

/** 每帧最多刷新一个节点：同帧连续 updateNodeInternals 会经 RF→zustand 打出 Maximum update depth */
function flushScheduledNodeInternals() {
  flushRaf = 0;
  if (!pendingFlush?.size) {
    pendingFlush = null;
    return;
  }
  const next = pendingFlush.entries().next();
  if (next.done) {
    pendingFlush = null;
    return;
  }
  const [nodeId, update] = next.value;
  pendingFlush.delete(nodeId);
  update(nodeId);
  if (pendingFlush.size > 0) {
    flushRaf = requestAnimationFrame(flushScheduledNodeInternals);
  } else {
    pendingFlush = null;
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

const RESIZE_MIN_DELTA_PX = 4;
const RESIZE_MIN_INTERVAL_MS = 48;

/** ResizeObserver → updateNodeInternals：忽略亚像素抖动；生成扫光等动效时建议 enabled=false */
export function useObserveNodeInternalsResize(
  nodeId: string | null | undefined,
  elementRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const schedule = useScheduleUpdateNodeInternals(nodeId);

  useEffect(() => {
    if (!enabled) return;
    const el = elementRef.current;
    if (!el || !nodeId) return;

    let lastW = 0;
    let lastH = 0;
    let roRaf = 0;
    let lastScheduleAt = 0;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (
        Math.abs(w - lastW) < RESIZE_MIN_DELTA_PX &&
        Math.abs(h - lastH) < RESIZE_MIN_DELTA_PX
      ) {
        return;
      }
      lastW = w;
      lastH = h;
      cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(() => {
        const now = performance.now();
        if (now - lastScheduleAt < RESIZE_MIN_INTERVAL_MS) return;
        lastScheduleAt = now;
        schedule(`resize:${w}x${h}`);
      });
    });

    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(roRaf);
    };
  }, [nodeId, elementRef, schedule, enabled]);
}
