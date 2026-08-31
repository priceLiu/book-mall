"use client";

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
  className?: string;
};

export function FilmPullStepper({ phase, className }: Props) {
  const idx = STEPS.findIndex((s) => s.id === phase);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {STEPS.map((step, i) => {
        const active = step.id === phase;
        const done = i < idx;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 min-w-7 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-[#34c759] text-white",
                active && !done && "bg-[#0071e3] text-white",
                !active && !done && "bg-[#e8e8ed] text-[#6e6e73]",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                active ? "text-[#1d1d1f]" : "text-[#6e6e73]",
              )}
            >
              {step.label}
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
