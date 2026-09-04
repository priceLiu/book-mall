"use client";

import { Check } from "lucide-react";

import {
  OUTFIT_V1_PROGRESS_STEPS,
  type OutfitWorkflowPhase,
} from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import {
  ECOM_PROGRESS_RAIL_SHELL,
  progressRailStepButtonClass,
  progressRailStepDotClass,
  progressRailStepLabelClass,
} from "@/lib/ecom-progress-rail-theme";

import type { ProgressRailStepState } from "@/lib/ecom-progress-rail-theme";

function stepVisual(current: OutfitWorkflowPhase, stepId: OutfitWorkflowPhase): ProgressRailStepState {
  const order = OUTFIT_V1_PROGRESS_STEPS.map((s) => s.id);
  const ci = order.indexOf(current);
  const si = order.indexOf(stepId);
  if (si < ci || (current === "done" && stepId !== "compose")) return "done";
  if (stepId === current || (current === "done" && stepId === "compose")) return "active";
  return "pending";
}

type Props = {
  phase: OutfitWorkflowPhase;
};

export function OutfitVideoProgressRail({ phase }: Props) {
  const effectivePhase = phase === "edit_scenes" ? "edit_scenes" : phase;

  return (
    <nav className={ECOM_PROGRESS_RAIL_SHELL} aria-label="穿搭视频进度">
      {OUTFIT_V1_PROGRESS_STEPS.map((step) => {
        const state = stepVisual(effectivePhase, step.id);
        return (
          <div key={step.id} className={progressRailStepButtonClass(state)} title={step.label}>
            <span className={progressRailStepDotClass(state)}>
              {state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : step.label.slice(0, 1)}
            </span>
            <span className={progressRailStepLabelClass(state)}>{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
