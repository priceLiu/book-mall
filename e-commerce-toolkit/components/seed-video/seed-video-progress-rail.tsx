"use client";

import { Check } from "lucide-react";

import type { SeedVideoProject } from "@/lib/seed-video-types";
import { SEED_VIDEO_STEPS } from "@/lib/seed-video-types";
import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
} from "@/lib/ecom-progress-rail-theme";
import { inferWorkflowPhase, stepVisual } from "@/lib/seed-video-workflow";

type Props = {
  project: SeedVideoProject;
  onStepClick?: (id: (typeof SEED_VIDEO_STEPS)[number]["id"]) => void;
};

export function SeedVideoProgressRail({ project, onStepClick }: Props) {
  const phase = inferWorkflowPhase(project);

  return (
    <nav
      className={ECOM_PROGRESS_RAIL_SHELL}
      aria-label="种草视频创作进度（点击跳转到对应区块）"
    >
      {SEED_VIDEO_STEPS.map((step) => {
        const state = stepVisual(phase, step.id);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick?.(step.id)}
            className={progressRailStepButtonClass(state)}
            title={step.label}
          >
            <span className={progressRailStepDotClass(state)}>
              {state === "done" ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                step.short
              )}
            </span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
