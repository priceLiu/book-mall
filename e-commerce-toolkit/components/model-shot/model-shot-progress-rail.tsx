"use client";

import { Check } from "lucide-react";

import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
} from "@/lib/ecom-progress-rail-theme";
import type { ModelShotPhase, ModelShotProject } from "@/lib/model-shot-types";
import { MODEL_SHOT_RAIL_STEPS, railStepState } from "@/lib/model-shot-workflow";

type Props = {
  project: ModelShotProject;
};

export function ModelShotProgressRail({ project }: Props) {
  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="服装模特图进度">
      {MODEL_SHOT_RAIL_STEPS.map((step) => {
        const state = railStepState(project, step.id as ModelShotPhase);
        return (
          <div
            key={step.id}
            className={progressRailStepButtonClass(state)}
            title={step.label}
          >
            <span className={progressRailStepDotClass(state)}>
              {state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : step.short}
            </span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
