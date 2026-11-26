"use client";

import { Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import {
  formatSeedVideoRenderElapsed,
  seedVideoRenderPhaseTitle,
  type SeedVideoRenderProgressState,
} from "@/lib/seed-video-render-progress";
import { cn } from "@/lib/utils";

type Props = {
  state: SeedVideoRenderProgressState | null;
  onPanelOpenChange: (open: boolean) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  /** 成功态自动收起后清空父级 state */
  onDismiss?: () => void;
};

const SUCCESS_HOLD_MS = 2000;
const SUCCESS_FADE_MS = 1400;

export function SeedVideoRenderProgressPanel({
  state,
  onPanelOpenChange,
  onCollapsedChange,
  onDismiss,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [, tick] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state?.phase !== "done") {
      setDismissing(false);
      return;
    }
    const hold = window.setTimeout(() => setDismissing(true), SUCCESS_HOLD_MS);
    return () => window.clearTimeout(hold);
  }, [state?.phase, state?.jobId]);

  useEffect(() => {
    if (!dismissing) return;
    const fade = window.setTimeout(() => onDismiss?.(), SUCCESS_FADE_MS);
    return () => window.clearTimeout(fade);
  }, [dismissing, onDismiss]);

  useEffect(() => {
    if (!state || state.phase === "done" || state.phase === "failed") return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  if (!mounted || !state) return null;

  const active = state.phase !== "done" && state.phase !== "failed";
  const pct = Math.max(0, Math.min(100, Math.round(state.progress)));

  if (!state.panelOpen) {
    if (!active) return null;
    return createPortal(
      <button
        type="button"
        className={cn(
          "fixed bottom-4 right-4 z-[90] flex max-w-[min(100vw-2rem,320px)] items-center gap-2 rounded-full border border-[var(--ecom-divider)] bg-white px-4 py-2 text-xs font-medium text-[var(--ecom-ink)] shadow-lg transition-all ease-in-out",
          dismissing &&
            "pointer-events-none translate-y-6 opacity-0 duration-[1400ms]",
        )}
        onClick={() => onPanelOpenChange(true)}
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--ecom-primary)]" />
        <span className="truncate">
          合成中 {pct}% · {state.progressLabel}
        </span>
      </button>,
      document.body,
    );
  }

  const completedSteps = state.stepLog.slice(0, -1);
  const currentStep = state.stepLog[state.stepLog.length - 1] ?? state.progressLabel;

  return createPortal(
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[90] w-[min(100vw-2rem,380px)] overflow-hidden rounded-xl border border-[var(--ecom-divider)] bg-white shadow-lg transition-all ease-in-out",
        dismissing && "pointer-events-none translate-y-8 opacity-0 duration-[1400ms]",
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--ecom-divider)] bg-[var(--ecom-parchment)] px-3 py-2">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-xs font-semibold text-[var(--ecom-ink)]">
            {seedVideoRenderPhaseTitle(state.phase)}
          </p>
          <p className="truncate text-[10px] text-[var(--ecom-muted)]">
            {active ? `已用时 ${formatSeedVideoRenderElapsed(state.startedAt)}` : "任务已结束"}
            {active ? ` · ${pct}%` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded p-1 text-[var(--ecom-muted)] hover:bg-white"
            aria-label={state.collapsed ? "展开" : "折叠"}
            onClick={() => onCollapsedChange(!state.collapsed)}
          >
            {state.collapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className="rounded p-1 text-[var(--ecom-muted)] hover:bg-white"
            aria-label="收起为小窗"
            onClick={() => onPanelOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--ecom-divider)]">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              state.phase === "failed" ? "bg-[#ff3b30]" : "bg-[var(--ecom-primary)]",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] font-medium text-[var(--ecom-ink)]">{currentStep}</p>
      </div>

      {!state.collapsed ? (
        <ul className="max-h-52 overflow-y-auto border-t border-[var(--ecom-divider)] px-3 py-2">
          {completedSteps.length === 0 ? (
            <li className="py-2 text-[11px] text-[var(--ecom-subtle)]">步骤详情将在此显示…</li>
          ) : (
            completedSteps.map((step, i) => (
              <li
                key={`${i}-${step}`}
                className="mb-1.5 flex items-start gap-2 text-[11px] text-[var(--ecom-muted)] last:mb-0"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34c759]" />
                <span className="leading-relaxed">{step}</span>
              </li>
            ))
          )}
          {active ? (
            <li className="mt-1 flex items-start gap-2 text-[11px] font-medium text-[var(--ecom-primary)]">
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
              <span className="leading-relaxed">{currentStep}</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>,
    document.body,
  );
}
