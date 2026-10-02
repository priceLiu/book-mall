"use client";

import { Check } from "lucide-react";

import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
} from "@/lib/ecom-progress-rail-theme";
import type { BrandViProject, BrandViStepId } from "@/lib/brand-vi-types";
import {
  doneCount,
  brandViVisibleSteps,
  stepVisual,
} from "@/lib/brand-vi-workflow";

type Props = {
  project: BrandViProject;
  currentStepId: BrandViStepId;
  onStepClick?: (id: BrandViStepId) => void;
};

export function BrandViProgressRail({ project, currentStepId, onStepClick }: Props) {
  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="品牌 VI · 表情包 8 步进度（点击切换步骤）">
      {brandViVisibleSteps(project).map((step) => {
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
