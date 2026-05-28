"use client";

import { cn } from "@/lib/utils";
import {
  PRO_NODE_ACCENT,
  PRO_STAGE_BADGE_CLASS,
  PRO_STAGE_CHIP_ACTIVE_CLASS,
  PRO_STAGE_CHIP_DONE_CLASS,
  PRO_STAGE_CHIP_IDLE_CLASS,
  PRO_STAGE_CONNECTOR_DONE_CLASS,
  PRO_STAGE_CONNECTOR_IDLE_CLASS,
  PRO_STAGE_LABEL_ACTIVE_CLASS,
  PRO_STAGE_LABEL_DONE_CLASS,
  PRO_STAGE_LABEL_IDLE_CLASS,
  PRO_STAGE_STEP_ACTIVE_CLASS,
  PRO_STAGE_STEP_DONE_CLASS,
  PRO_STAGE_STEP_IDLE_CLASS,
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
                  isDone ? PRO_STAGE_CONNECTOR_DONE_CLASS : PRO_STAGE_CONNECTOR_IDLE_CLASS,
                )}
                aria-hidden
              />
            ) : null}
            <div
              className={cn(
                "flex min-w-0 flex-col rounded-md border px-1.5 py-0.5 transition",
                isActive
                  ? PRO_STAGE_CHIP_ACTIVE_CLASS
                  : isDone
                    ? PRO_STAGE_CHIP_DONE_CLASS
                    : PRO_STAGE_CHIP_IDLE_CLASS,
              )}
              title={s.shortHint}
            >
              <span
                className={cn(
                  "text-[9px] font-mono tabular-nums",
                  isActive
                    ? PRO_STAGE_STEP_ACTIVE_CLASS
                    : isDone
                      ? PRO_STAGE_STEP_DONE_CLASS
                      : PRO_STAGE_STEP_IDLE_CLASS,
                )}
              >
                {String(s.step).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "truncate text-[10px] font-medium",
                  isActive
                    ? PRO_STAGE_LABEL_ACTIVE_CLASS
                    : isDone
                      ? PRO_STAGE_LABEL_DONE_CLASS
                      : PRO_STAGE_LABEL_IDLE_CLASS,
                )}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
      <span className={PRO_STAGE_BADGE_CLASS} style={{ color: `${PRO_NODE_ACCENT}66` }}>
        PRO
      </span>
    </div>
  );
}
