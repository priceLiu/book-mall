"use client";

import { useEffect, useState } from "react";
import type { Pro2WizardAssetKind } from "@/lib/canvas/pro2-production-wizard-assets";
import type { Pro2WizardShotMediaKind } from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import { canvasNotify } from "@/lib/canvas/canvas-notify";
import {
  BACKGROUND_DOCK_LONG_TASK_MS,
  BACKGROUND_DOCK_SUCCESS_FLASH_MS,
} from "@/lib/canvas/background-generation-dock-policy";

export type WizardProgressKind = Pro2WizardAssetKind | Pro2WizardShotMediaKind;

export type WizardAssetProgressStatus = "running" | "succeeded" | "failed";

export type WizardAssetProgressItem = {
  jobId: string;
  label: string;
  kind: WizardProgressKind;
  status: WizardAssetProgressStatus;
  detail?: string;
  startedAt: number;
  finishedAt?: number;
  /** 运行中默认最小化为右下角胶囊 */
  minimized?: boolean;
};

export type WizardAssetProgressState = {
  expanded: boolean;
  items: WizardAssetProgressItem[];
};

const INITIAL: WizardAssetProgressState = { expanded: false, items: [] };

let state: WizardAssetProgressState = INITIAL;
const listeners = new Set<(s: WizardAssetProgressState) => void>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
const longRunningNotified = new Set<string>();

function emit(next: WizardAssetProgressState) {
  state = next;
  for (const fn of listeners) fn(state);
}

function clearDismissTimer(jobId: string) {
  const prev = dismissTimers.get(jobId);
  if (prev) clearTimeout(prev);
  dismissTimers.delete(jobId);
}

function maybeNotifyLongRunning(item: WizardAssetProgressItem): void {
  if (item.status !== "running") return;
  if (longRunningNotified.has(item.jobId)) return;
  if (Date.now() - item.startedAt < BACKGROUND_DOCK_LONG_TASK_MS) return;
  longRunningNotified.add(item.jobId);
  emit({ ...state, expanded: true });
  canvasNotify({
    title: "仍在生成",
    message: `${item.label} 已等待超过 10 分钟，仍在厂商侧生成。可在右下角查看进度，或打开「后台视频」加载成片。`,
    variant: "info",
  });
}

function scanLongRunningItems(): void {
  for (const item of state.items) {
    maybeNotifyLongRunning(item);
  }
}

let longRunningScanTimer: ReturnType<typeof setInterval> | null = null;

function ensureLongRunningScan(): void {
  const hasRunning = state.items.some((x) => x.status === "running");
  if (hasRunning && !longRunningScanTimer) {
    longRunningScanTimer = setInterval(scanLongRunningItems, 5000);
  }
  if (!hasRunning && longRunningScanTimer) {
    clearInterval(longRunningScanTimer);
    longRunningScanTimer = null;
  }
}

export function subscribeWizardAssetProgress(
  fn: (s: WizardAssetProgressState) => void,
): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function setWizardAssetProgressExpanded(expanded: boolean): void {
  emit({ ...state, expanded });
}

export function upsertWizardAssetProgressItem(
  item: WizardAssetProgressItem,
): void {
  const items = [...state.items];
  const idx = items.findIndex((x) => x.jobId === item.jobId);
  const nextItem: WizardAssetProgressItem = {
    ...item,
    minimized: item.minimized ?? item.status === "running",
  };
  if (idx >= 0) items[idx] = { ...items[idx], ...nextItem };
  else items.unshift(nextItem);
  emit({
    expanded: nextItem.status === "running" ? false : state.expanded,
    items: items.slice(0, 8),
  });
  ensureLongRunningScan();
  scanLongRunningItems();
}

export function patchWizardAssetProgressItem(
  jobId: string,
  patch: Partial<WizardAssetProgressItem>,
): void {
  const items = state.items.map((x) =>
    x.jobId === jobId ? { ...x, ...patch } : x,
  );
  emit({ ...state, items });
  ensureLongRunningScan();
  scanLongRunningItems();
}

export function finishWizardAssetProgressItem(
  jobId: string,
  status: Exclude<WizardAssetProgressStatus, "running">,
  detail?: string,
): void {
  const existing = state.items.find((x) => x.jobId === jobId);
  patchWizardAssetProgressItem(jobId, {
    status,
    detail,
    finishedAt: Date.now(),
    minimized: status === "succeeded",
  });
  clearDismissTimer(jobId);
  longRunningNotified.delete(jobId);

  if (status === "failed") {
    emit({ ...state, expanded: false });
    canvasNotify({
      title: "生成失败",
      message: detail?.trim() || `${existing?.label ?? "任务"}生成失败`,
      variant: "error",
    });
    return;
  }

  emit({ ...state, expanded: true });
  dismissTimers.set(
    jobId,
    setTimeout(() => {
      dismissTimers.delete(jobId);
      removeWizardAssetProgressItem(jobId);
    }, BACKGROUND_DOCK_SUCCESS_FLASH_MS),
  );
}

export function removeWizardAssetProgressItem(jobId: string): void {
  clearDismissTimer(jobId);
  longRunningNotified.delete(jobId);
  const items = state.items.filter((x) => x.jobId !== jobId);
  emit({
    expanded: items.length > 0 ? state.expanded : false,
    items,
  });
  ensureLongRunningScan();
}

export function clearWizardAssetProgress(): void {
  for (const t of dismissTimers.values()) clearTimeout(t);
  dismissTimers.clear();
  longRunningNotified.clear();
  if (longRunningScanTimer) {
    clearInterval(longRunningScanTimer);
    longRunningScanTimer = null;
  }
  emit(INITIAL);
}

export function wizardAssetProgressRunningCount(
  s: WizardAssetProgressState = state,
): number {
  return s.items.filter((x) => x.status === "running").length;
}

/** 向导卡片 · 与右下角进度面板同源 */
export function useWizardJobProgressStatus(
  jobId: string,
): WizardAssetProgressStatus | undefined {
  const [status, setStatus] = useState<WizardAssetProgressStatus | undefined>(
    () => state.items.find((x) => x.jobId === jobId)?.status,
  );
  useEffect(() => {
    return subscribeWizardAssetProgress((s) => {
      setStatus(s.items.find((x) => x.jobId === jobId)?.status);
    });
  }, [jobId]);
  return status;
}

/** 视频生成超时 · 转入后台等待（不记失败、弹出进度说明） */
export function markWizardShotVideoBackgroundWait(args: {
  jobId: string;
  label: string;
}): void {
  const startedAt =
    state.items.find((x) => x.jobId === args.jobId)?.startedAt ?? Date.now();
  upsertWizardAssetProgressItem({
    jobId: args.jobId,
    label: args.label,
    kind: "video",
    status: "running",
    startedAt,
    minimized: true,
  });
  if (longRunningNotified.has(args.jobId)) return;
  longRunningNotified.add(args.jobId);
  emit({ ...state, expanded: true });
  canvasNotify({
    title: "仍在生成",
    message: `${args.label} 已等待超过 10 分钟，仍在厂商侧生成。可在右下角查看进度，或打开「后台视频」加载成片。`,
    variant: "info",
  });
}
