import { cn } from "@/lib/utils";

/** 工作台竖向进度轨 — 浅色，撑满列高 */
export const ECOM_PROGRESS_RAIL_SHELL =
  "flex h-full min-h-0 w-[4.75rem] shrink-0 flex-col items-center gap-0.5 overflow-x-hidden overflow-y-auto ecom-scrollbar-overlay border-r border-[var(--ecom-rail-border)] bg-[var(--ecom-rail-bg)] py-3";

export type ProgressRailStepState = "done" | "active" | "pending" | "skipped";

export function progressRailStepButtonClass(state: ProgressRailStepState): string {
  return cn(
    "relative flex w-full flex-col items-center gap-0.5 px-0.5 py-1.5 text-center transition-colors",
    "cursor-pointer hover:bg-[#f5f5f7]",
    state === "pending"
      ? "text-[var(--ecom-rail-label-muted)]"
      : "text-[var(--ecom-rail-label)]",
  );
}

export function progressRailStepDotClass(state: ProgressRailStepState): string {
  return cn(
    "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold transition-colors",
    state === "active" &&
      "bg-[var(--ecom-rail-dot-active-bg)] text-[#1d1d1f] ring-2 ring-[#1d1d1f]",
    state === "done" && "bg-[#1d1d1f] text-white",
    state === "skipped" &&
      "border border-[#d2d2d7] bg-[var(--ecom-rail-dot-skipped-bg)] text-[var(--ecom-rail-label-muted)]",
    state === "pending" &&
      "border border-[var(--ecom-rail-dot-pending-border)] bg-white text-[var(--ecom-rail-label-muted)]",
  );
}

export function progressRailStepLabelClass(state: ProgressRailStepState): string {
  return cn(
    "text-[9px] font-bold leading-tight",
    state === "active" && "text-[var(--ecom-rail-label)]",
    state === "done" && "text-[var(--ecom-rail-label)]",
    state === "skipped" && "text-[var(--ecom-rail-label-muted)]",
    state === "pending" && "text-[var(--ecom-rail-label-muted)]",
  );
}
