"use client";

import { cn } from "@/lib/utils";
import {
  PRO_NODE_ACCENT,
  STORY_PRO_PIPELINE_STAGES,
  type StoryProStageId,
} from "@/lib/canvas/story-pro-node-chrome";

export function StoryProStageRail({
  activeStage,
  completedStages = [],
}: {
  activeStage: StoryProStageId;
  completedStages?: StoryProStageId[];
}) {
  const done = new Set(completedStages);
  return (
    <div className="nodrag flex shrink-0 items-center gap-0.5 overflow-x-auto pb-1">
      {STORY_PRO_PIPELINE_STAGES.map((s, i) => {
        const isActive = s.id === activeStage;
        const isDone = done.has(s.id);
        return (
          <div key={s.id} className="flex min-w-0 items-center">
            {i > 0 ? (
              <span
                className={cn(
                  "mx-0.5 h-px w-3 shrink-0",
                  isDone ? "bg-cyan-400/50" : "bg-white/10",
                )}
                aria-hidden
              />
            ) : null}
            <div
              className={cn(
                "flex min-w-0 flex-col rounded-md border px-1.5 py-0.5 transition",
                isActive
                  ? "border-cyan-400/50 bg-cyan-500/15"
                  : isDone
                    ? "border-emerald-400/30 bg-emerald-500/8"
                    : "border-white/8 bg-white/[0.03]",
              )}
              title={s.shortHint}
            >
              <span
                className={cn(
                  "text-[9px] font-mono tabular-nums",
                  isActive
                    ? "text-cyan-300"
                    : isDone
                      ? "text-emerald-300/80"
                      : "text-white/35",
                )}
              >
                {String(s.step).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "truncate text-[10px] font-medium",
                  isActive
                    ? "text-cyan-100"
                    : isDone
                      ? "text-emerald-200/90"
                      : "text-white/45",
                )}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
      <span
        className="ml-1 shrink-0 rounded px-1 py-0.5 font-mono text-[8px] uppercase tracking-widest text-cyan-400/40"
        style={{ color: `${PRO_NODE_ACCENT}66` }}
      >
        PRO
      </span>
    </div>
  );
}
