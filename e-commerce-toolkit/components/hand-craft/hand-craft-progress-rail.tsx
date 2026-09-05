"use client";

import { Check } from "lucide-react";

import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
} from "@/lib/ecom-progress-rail-theme";
import type { HandCraftProject, HandCraftStepId } from "@/lib/hand-craft-types";
import {
  doneCount,
  HAND_CRAFT_STEPS,
  stepVisual,
} from "@/lib/hand-craft-workflow";

type Props = {
  project: HandCraftProject;
  currentStepId: HandCraftStepId;
  onStepClick?: (id: HandCraftStepId) => void;
};

export function HandCraftProgressRail({ project, currentStepId, onStepClick }: Props) {
  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="手伴创作 10 步进度（点击切换步骤）">
      {HAND_CRAFT_STEPS.map((step) => {
        const state = stepVisual(project, step.id, currentStepId);
        const done = doneCount(project, step.id);
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick?.(step.id)}
            className={progressRailStepButtonClass(state)}
            title={`第 ${step.no} 步 ${step.label}｜${step.summary}（${done}/${step.count}）`}
          >
            <span className={progressRailStepDotClass(state)}>
              {state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : step.short}
            </span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
            <span className="text-[8px] leading-none text-[#86868b]">
              {done}/{step.count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
