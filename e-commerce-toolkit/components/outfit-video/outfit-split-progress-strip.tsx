"use client";

import { Loader2 } from "lucide-react";

import {
  OUTFIT_SPLIT_PHASE_STEPS,
  outfitSplitPhaseIndex,
  outfitSplitProgressBar,
  outfitSplitProgressHeadline,
  type OutfitSplitProgress,
} from "@/lib/outfit-video-split-progress";
import { cn } from "@/lib/utils";

type Props = {
  active?: boolean;
  progress: OutfitSplitProgress | null;
};

/** 拆解进行中 · 轻量步骤轨 + 当前状态行（无扫光、无折叠标题） */
export function OutfitSplitProgressStrip({ active, progress }: Props) {
  if (!active) return null;

  const phaseIdx = outfitSplitPhaseIndex(progress?.phase);
  const headline = outfitSplitProgressHeadline(progress);
  const bar = outfitSplitProgressBar(progress);

  return (
    <div className="rounded-xl border border-[var(--ecom-divider)] bg-[var(--ecom-content-highlight)] px-3 py-2.5 space-y-2">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="拆镜步骤">
        {OUTFIT_SPLIT_PHASE_STEPS.map((step, index) => {
          const done = index < phaseIdx;
          const current = index === phaseIdx;
          return (
            <li key={step.phase} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  className={cn(
                    "h-px w-3",
                    done ? "bg-[var(--ecom-primary)]/50" : "bg-[var(--ecom-border-soft)]",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  done && "bg-[var(--ecom-primary)]/10 text-[var(--ecom-primary)]",
                  current && "bg-[var(--ecom-primary)]/15 text-[var(--ecom-primary)]",
                  !done && !current && "bg-[var(--ecom-parchment)] text-[var(--ecom-subtle)]",
                )}
              >
                {current ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      done ? "bg-[var(--ecom-primary)]" : "bg-[#c7c7cc]",
                    )}
                    aria-hidden
                  />
                )}
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs leading-relaxed text-[var(--ecom-muted)]">{headline}</p>

      {bar ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--ecom-subtle)]">
            <span>{bar.label}</span>
            <span>
              {bar.current}/{bar.total}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[var(--ecom-divider)]">
            <div
              className="h-full rounded-full bg-[var(--ecom-primary)] transition-[width] duration-300"
              style={{ width: `${Math.min(100, (bar.current / bar.total) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
