"use client";

import { Loader2 } from "lucide-react";

import {
  VTon_TRYON_PHASE_STEPS,
  vtonTryonPhaseIndex,
  vtonTryonProgressHeadline,
  type VtonTryonProgress,
} from "@/lib/vton-tryon-progress";
import { cn } from "@/lib/utils";

type Props = {
  active?: boolean;
  progress: VtonTryonProgress | null;
};

export function VtonTryonProgressStrip({ active, progress }: Props) {
  if (!active) return null;

  const phaseIdx = vtonTryonPhaseIndex(progress?.phase);
  const headline = vtonTryonProgressHeadline(progress);
  const failed = progress?.phase === "failed";

  return (
    <div className="rounded-xl border border-[#e8e8ed] bg-[var(--ecom-content-highlight)] px-3 py-2.5 space-y-2">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="试衣步骤">
        {VTon_TRYON_PHASE_STEPS.map((step, index) => {
          const done = !failed && index < phaseIdx;
          const current = !failed && index === phaseIdx;
          return (
            <li key={step.phase} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  className={cn("h-px w-3", done ? "bg-[#0071e3]/50" : "bg-[#d2d2d7]")}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  done && "bg-[#0071e3]/10 text-[#0071e3]",
                  current && "bg-[#0071e3]/15 text-[#0071e3]",
                  !done && !current && "bg-[#f5f5f7] text-[#86868b]",
                  failed && index === phaseIdx && "bg-[#fff0f0] text-[#c0392b]",
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
      <p
        className={cn(
          "text-xs leading-relaxed",
          failed ? "text-[#c0392b]" : "text-[#6e6e73]",
        )}
      >
        {headline}
      </p>
    </div>
  );
}
