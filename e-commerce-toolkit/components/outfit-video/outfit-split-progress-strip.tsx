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
    <div className="rounded-xl border border-[#e8e8ed] bg-[var(--ecom-content-highlight)] px-3 py-2.5 space-y-2">
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
                    done ? "bg-[#0071e3]/50" : "bg-[#d2d2d7]",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  done && "bg-[#0071e3]/10 text-[#0071e3]",
                  current && "bg-[#0071e3]/15 text-[#0071e3]",
                  !done && !current && "bg-[#f5f5f7] text-[#86868b]",
                )}
              >
                {current ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      done ? "bg-[#0071e3]" : "bg-[#c7c7cc]",
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

      <p className="text-xs leading-relaxed text-[#6e6e73]">{headline}</p>

      {bar ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#86868b]">
            <span>{bar.label}</span>
            <span>
              {bar.current}/{bar.total}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#e8e8ed]">
            <div
              className="h-full rounded-full bg-[#0071e3] transition-[width] duration-300"
              style={{ width: `${Math.min(100, (bar.current / bar.total) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
