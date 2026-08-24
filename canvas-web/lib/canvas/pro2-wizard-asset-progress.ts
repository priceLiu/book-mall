"use client";

import { useEffect, useState } from "react";
import type { Pro2WizardAssetKind } from "@/lib/canvas/pro2-production-wizard-assets";
import type { Pro2WizardShotMediaKind } from "@/lib/canvas/pro2-production-wizard-shot-drafts";

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
};

export type WizardAssetProgressState = {
  open: boolean;
  items: WizardAssetProgressItem[];
};

const INITIAL: WizardAssetProgressState = { open: false, items: [] };
const AUTO_DISMISS_MS = 6000;

let state: WizardAssetProgressState = INITIAL;
const listeners = new Set<(s: WizardAssetProgressState) => void>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(next: WizardAssetProgressState) {
  state = next;
  for (const fn of listeners) fn(state);
}

export function subscribeWizardAssetProgress(
  fn: (s: WizardAssetProgressState) => void,
): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function upsertWizardAssetProgressItem(
  item: WizardAssetProgressItem,
): void {
  const items = [...state.items];
  const idx = items.findIndex((x) => x.jobId === item.jobId);
  if (idx >= 0) items[idx] = item;
  else items.unshift(item);
  emit({ open: true, items: items.slice(0, 8) });
}

export function patchWizardAssetProgressItem(
  jobId: string,
  patch: Partial<WizardAssetProgressItem>,
): void {
  const items = state.items.map((x) =>
    x.jobId === jobId ? { ...x, ...patch } : x,
  );
  emit({ open: items.length > 0, items });
}

export function finishWizardAssetProgressItem(
  jobId: string,
  status: Exclude<WizardAssetProgressStatus, "running">,
  detail?: string,
): void {
  patchWizardAssetProgressItem(jobId, {
    status,
    detail,
    finishedAt: Date.now(),
  });
  const prev = dismissTimers.get(jobId);
  if (prev) clearTimeout(prev);
  if (status === "succeeded") {
    dismissTimers.set(
      jobId,
      setTimeout(() => {
        dismissTimers.delete(jobId);
        removeWizardAssetProgressItem(jobId);
      }, AUTO_DISMISS_MS),
    );
  }
}

export function removeWizardAssetProgressItem(jobId: string): void {
  const items = state.items.filter((x) => x.jobId !== jobId);
  emit({ open: items.length > 0, items });
}

export function clearWizardAssetProgress(): void {
  for (const t of dismissTimers.values()) clearTimeout(t);
  dismissTimers.clear();
  emit(INITIAL);
}

export function wizardAssetProgressRunningCount(
  s: WizardAssetProgressState = state,
): number {
  return s.items.filter((x) => x.status === "running").length;
}

/** 向导卡片 · 与右下角进度面板同源，避免 draft sessionOnly 写回滞后 */
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
