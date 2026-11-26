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
    <div className="rounded-xl border border-[var(--ecom-divider)] bg-[var(--ecom-content-highlight)] px-3 py-2.5 space-y-2">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label="试衣步骤">
        {VTon_TRYON_PHASE_STEPS.map((step, index) => {
          const done = !failed && index < phaseIdx;
          const current = !failed && index === phaseIdx;
          return (
            <li key={step.phase} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span
                  className={cn("h-px w-3", done ? "bg-[var(--ecom-primary)]/50" : "bg-[var(--ecom-border-soft)]")}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  done && "bg-[var(--ecom-primary)]/10 text-[var(--ecom-primary)]",
                  current && "bg-[var(--ecom-primary)]/15 text-[var(--ecom-primary)]",
                  !done && !current && "bg-[var(--ecom-parchment)] text-[var(--ecom-subtle)]",
                  failed && index === phaseIdx && "bg-[#fff0f0] text-[#c0392b]",
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
      <p
        className={cn(
          "text-xs leading-relaxed",
          failed ? "text-[#c0392b]" : "text-[var(--ecom-muted)]",
        )}
      >
        {headline}
      </p>
    </div>
  );
}
