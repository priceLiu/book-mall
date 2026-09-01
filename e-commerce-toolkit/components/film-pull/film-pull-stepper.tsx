"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilmPullPhase } from "@/lib/film-pull-types";

const STEPS: { id: FilmPullPhase; label: string }[] = [
  { id: "analyze", label: "拉片" },
  { id: "review", label: "审校" },
  { id: "replace", label: "换角" },
  { id: "output", label: "成片" },
];

type Props = {
  phase: FilmPullPhase;
  /** 服务端任务进行中时高亮对应步骤（如 analyzing → 拉片） */
  pendingStep?: FilmPullPhase;
  className?: string;
};

export function FilmPullStepper({ phase, pendingStep, className }: Props) {
  const idx = STEPS.findIndex((s) => s.id === phase);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {STEPS.map((step, i) => {
        const active = step.id === phase;
        const pending = step.id === pendingStep;
        const done = i < idx;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 min-w-7 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-[#34c759] text-white",
                active && !done && !pending && "bg-[#0071e3] text-white",
                pending && "bg-[#0071e3] text-white",
                !active && !done && !pending && "bg-[#e8e8ed] text-[#6e6e73]",
              )}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : done ? (
                "✓"
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                active || pending ? "text-[#1d1d1f]" : "text-[#6e6e73]",
              )}
            >
              {pending ? `${step.label}中…` : step.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="mx-1 h-px w-8 bg-[#d2d2d7]" aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
